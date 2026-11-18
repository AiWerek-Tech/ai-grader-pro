import { dbGetAll, isMySqlEnabled } from '@/lib/google-sheets';
import { getAcademicSessionAction, getSettingsAction } from '@/lib/actions/settings';
import {
  buildClassAbsenMap,
  KartuStudentItem,
  parseKartuConfigFromSettings,
  parseKartuOverridesFromSettings,
  resolveParticipantMeta,
} from '@/lib/kartu-peserta-utils';
import { verifyKartuQrToken } from '@/lib/kartu-qr-token';

export type MapelPortalStatus =
  | 'BELUM_TERINTEGRASI'
  | 'MENUNGGU_UJIAN'
  | 'REVIEW_GURU'
  | 'SELESAI';

export interface PortalAssessmentItem {
  idKunci: string;
  judulUjian: string;
  guruNama: string;
  status: Exclude<MapelPortalStatus, 'BELUM_TERINTEGRASI'>;
  skor: number | null;
  kkm: number;
  predikat: string | null;
  lulus: boolean | null;
  benar?: number;
  salah?: number;
  kosong?: number;
  updatedAt?: string;
}

export interface PortalMapelRow {
  idMapel: string;
  namaMapel: string;
  guruNama: string;
  isIntegrated: boolean;
  overallStatus: MapelPortalStatus;
  kkm: number;
  assessments: PortalAssessmentItem[];
}

export type KartuPortalResult =
  | {
      valid: false;
      reason: 'INVALID_TOKEN' | 'DISABLED' | 'NOT_FOUND';
      schoolName: string;
    }
  | {
      valid: true;
      portalShowScore: boolean;
      checkedAtIso: string;
      schoolBranding: {
        yayasan: string;
        akademi: string;
        sekolah: string;
        alamat: string;
        npsn: string;
        kota: string;
        logoKiri: string;
        logoKanan: string;
      };
      academicSession: {
        tahunAjaran: string;
        semester: string;
      };
      configSummary: {
        judulUjian: string;
        kurikulumLabel: string;
        tanggalCetak: string;
      };
      student: {
        id_siswa: string;
        nis: string;
        nama: string;
        nama_kelas: string;
        jenjang: 'SMP' | 'SMA';
        noAbsen: string;
        noPeserta: string;
        ruang: string;
        meja: string;
        initials: string;
        avatarBg: string;
        themeVariant: 'NAVY_BLUE' | 'MAROON';
        primaryDark: string;
        primaryMid: string;
        goldAccent: string;
        pillBg: string;
        pillBorder: string;
        pillText: string;
      };
      stats: {
        totalMapel: number;
        integratedCount: number;
        notIntegratedCount: number;
        completedCount: number;
      };
      mapelList: PortalMapelRow[];
    };

export async function resolvePublicKartuPortal(rawToken: string): Promise<KartuPortalResult> {
  const [settingsRes, sessionRes] = await Promise.all([
    getSettingsAction(),
    getAcademicSessionAction(),
  ]);

  const settings = settingsRes.data || {};
  const fallbackSchool =
    settings['sma_nama_sekolah_2'] ||
    settings['smp_nama_sekolah_2'] ||
    'WMVAA Adventist Academy';

  const portalEnabled =
    String(settings['kartu_portal_enabled'] ?? 'true').trim().toLowerCase() !== 'false';
  if (!portalEnabled) {
    return { valid: false, reason: 'DISABLED', schoolName: fallbackSchool };
  }

  const expectedEpoch = Math.max(1, Number(settings['kartu_qr_token_epoch']) || 1);
  const payload = verifyKartuQrToken(rawToken, expectedEpoch);
  if (!payload) {
    return { valid: false, reason: 'INVALID_TOKEN', schoolName: fallbackSchool };
  }

  const useSheetCache = !isMySqlEnabled();

  const [siswaRaw, kelasRaw, mapelRaw, tugasRaw, kunciRaw, hasilRaw, usersRaw] =
    await Promise.all([
      dbGetAll('SISWA', true),
      dbGetAll('KELAS', true),
      dbGetAll('MAPEL', true),
      dbGetAll('TUGAS_GURU', useSheetCache),
      dbGetAll('KUNCI_JAWABAN', useSheetCache),
      dbGetAll('HASIL', useSheetCache),
      dbGetAll('USERS', true),
    ]);

  const tahunAjaran = payload.ta || sessionRes.data?.tahunAjaran || '2026/2027';
  const semester = payload.sm || sessionRes.data?.semester || 'GANJIL';

  const kelasLookup = new Map<string, any>();
  (kelasRaw || []).forEach((k: any) => kelasLookup.set(String(k.id_kelas), k));

  const studentsPool: KartuStudentItem[] = (siswaRaw || [])
    .filter((s: any) => {
      const sTahun = String(s.tahun_ajaran || '').trim();
      return !sTahun || sTahun.toLowerCase() === tahunAjaran.toLowerCase();
    })
    .map((s: any) => {
      const kls = kelasLookup.get(String(s.id_kelas));
      return {
        id_siswa: String(s.id_siswa || ''),
        nis: String(s.nis || ''),
        nama: String(s.nama || ''),
        id_kelas: String(s.id_kelas || ''),
        nama_kelas: String(kls?.nama_kelas || s.id_kelas || ''),
        jenjang: (String(kls?.jenjang || 'SMA').toUpperCase() === 'SMP' ? 'SMP' : 'SMA') as
          | 'SMP'
          | 'SMA',
        tahun_ajaran: s.tahun_ajaran ? String(s.tahun_ajaran) : tahunAjaran,
        semester: s.semester ? String(s.semester) : semester,
      };
    })
    .sort((a: KartuStudentItem, b: KartuStudentItem) => {
      const klsCmp = a.nama_kelas.localeCompare(b.nama_kelas, 'id', { numeric: true });
      if (klsCmp !== 0) return klsCmp;
      return a.nama.localeCompare(b.nama, 'id');
    });

  const targetIdx = studentsPool.findIndex((s) => s.id_siswa === payload.s);
  if (targetIdx === -1) {
    return { valid: false, reason: 'NOT_FOUND', schoolName: fallbackSchool };
  }

  const student = studentsPool[targetIdx];
  const classAbsenMap = buildClassAbsenMap(studentsPool);
  const config = parseKartuConfigFromSettings(settings, semester, tahunAjaran);
  const overrides = parseKartuOverridesFromSettings(settings);
  const meta = resolveParticipantMeta(
    student,
    targetIdx,
    config,
    overrides,
    classAbsenMap,
    settings,
    { tahunAjaran, semester }
  );

  const prefix = student.jenjang === 'SMP' ? 'smp_' : 'sma_';
  const schoolBranding = {
    yayasan:
      config.kopYayasan?.trim() ||
      settings['nama_yayasan'] ||
      'YAYASAN PENDIDIKAN ADVENT PAPUA',
    akademi:
      config.kopAkademi?.trim() ||
      settings[prefix + 'nama_sekolah_1'] ||
      settings['nama_sekolah_1'] ||
      'Wamena Mountain View Adventist Academy',
    sekolah:
      config.kopNamaSekolah?.trim() ||
      settings[prefix + 'nama_sekolah_2'] ||
      settings['nama_sekolah_2'] ||
      (student.jenjang === 'SMP' ? 'SMP Advent Sogokmo' : 'SMA Advent Sogokmo'),
    alamat:
      config.kopAlamat?.trim() ||
      settings['alamat_sekolah'] ||
      'Jl. Wamena – Kurima, Kampung Sogokmo, Kec. Asotipo, Kab. Jayawijaya',
    npsn: student.jenjang === 'SMP' ? settings['smp_npsn'] || '' : settings['sma_npsn'] || '',
    kota: config.kotaCetak?.trim() || settings['kota_sekolah'] || 'Wamena',
    logoKiri: settings[prefix + 'logo_kiri_url'] || settings['logo_kiri_url'] || '/logo/logo_advent.png',
    logoKanan: settings[prefix + 'logo_kanan_url'] || settings['logo_kanan_url'] || '/logo/tut_wuri.png',
  };

  // Lookup maps (kurasi hanya kolom aman)
  const mapelLookup = new Map<string, string>();
  (mapelRaw || []).forEach((m: any) => {
    if (m.id_mapel) mapelLookup.set(String(m.id_mapel), String(m.nama_mapel || m.id_mapel));
  });

  const userNameLookup = new Map<string, string>();
  (usersRaw || []).forEach((u: any) => {
    if (u.id_user) userNameLookup.set(String(u.id_user), String(u.nama || ''));
  });

  const kkmEksakta = sessionRes.data?.kkmEksakta || 65;
  const kkmNonEksakta = sessionRes.data?.kkmNonEksakta || 70;
  const keywordsEksakta = sessionRes.data?.mapelEksakta || [];

  const matchesSession = (rowTahun?: string, rowSem?: string) => {
    const t = String(rowTahun || '').trim();
    const sm = String(rowSem || '').trim().toUpperCase();
    const okT = !t || t.toLowerCase() === tahunAjaran.toLowerCase();
    const okS = !sm || sm === semester.toUpperCase();
    return okT && okS;
  };

  // 1. Daftar mapel kelas dari TUGAS_GURU
  const guruByMapel = new Map<string, string>();
  const mapelIdsForClass = new Set<string>();

  (tugasRaw || []).forEach((t: any) => {
    if (String(t.id_kelas) !== student.id_kelas) return;
    if (!matchesSession(t.tahun_ajaran, t.semester)) return;
    const idMapel = String(t.id_mapel || '').trim();
    if (!idMapel) return;
    mapelIdsForClass.add(idMapel);
    const guruName = userNameLookup.get(String(t.id_user || '')) || '';
    if (guruName && !guruByMapel.has(idMapel)) {
      guruByMapel.set(idMapel, guruName);
    }
  });

  // 2. Kunci jawaban aktif untuk kelas & sesi siswa (mendukung id_kelas tunggal maupun daftar koma)
  const kunciByMapel = new Map<string, any[]>();
  (kunciRaw || []).forEach((k: any) => {
    const classTokens = String(k.id_kelas || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (!classTokens.includes(student.id_kelas)) return;
    if (!matchesSession(k.tahun_ajaran, k.semester)) return;
    const idMapel = String(k.id_mapel || '').trim();
    if (!idMapel) return;
    mapelIdsForClass.add(idMapel);
    if (!kunciByMapel.has(idMapel)) kunciByMapel.set(idMapel, []);
    kunciByMapel.get(idMapel)!.push(k);
  });

  // 3. Hasil siswa indexed by id_kunci
  const hasilByKunci = new Map<string, any>();
  (hasilRaw || []).forEach((h: any) => {
    if (String(h.id_siswa) !== student.id_siswa) return;
    if (!matchesSession(h.tahun_ajaran, h.semester)) return;
    const idKunci = String(h.id_kunci || '').trim();
    if (!idKunci) return;
    // Ambil entri terbaru bila ada lebih dari satu
    hasilByKunci.set(idKunci, h);
  });

  const portalShowScore = config.portalShowScore;

  const statusRank: Record<MapelPortalStatus, number> = {
    SELESAI: 0,
    REVIEW_GURU: 1,
    MENUNGGU_UJIAN: 2,
    BELUM_TERINTEGRASI: 3,
  };

  const mapelList: PortalMapelRow[] = Array.from(mapelIdsForClass)
    .map((idMapel) => {
      const namaMapel = mapelLookup.get(idMapel) || idMapel;
      const isEksakta = keywordsEksakta.some((kw: string) =>
        namaMapel.toLowerCase().includes(kw)
      );
      const kkm = isEksakta ? kkmEksakta : kkmNonEksakta;
      const kunciItems = kunciByMapel.get(idMapel) || [];

      const fallbackGuruFromKunci =
        kunciItems.length > 0 ? userNameLookup.get(String(kunciItems[0].id_guru || '')) || '' : '';
      const guruNama = guruByMapel.get(idMapel) || fallbackGuruFromKunci || 'Guru Pengampu';

      if (kunciItems.length === 0) {
        return {
          idMapel,
          namaMapel,
          guruNama,
          isIntegrated: false,
          overallStatus: 'BELUM_TERINTEGRASI' as const,
          kkm,
          assessments: [],
        };
      }

      const assessments: PortalAssessmentItem[] = kunciItems.map((k: any) => {
        const idKunci = String(k.id_kunci || '');
        const judulUjian = String(k.judul_ujian || 'Asesmen LJK');
        const kGuru = userNameLookup.get(String(k.id_guru || '')) || guruNama;
        const h = hasilByKunci.get(idKunci);

        if (!h) {
          return {
            idKunci,
            judulUjian,
            guruNama: kGuru,
            status: 'MENUNGGU_UJIAN',
            skor: null,
            kkm,
            predikat: null,
            lulus: null,
          };
        }

        let detail: any = {};
        try {
          detail = typeof h.detail_json === 'string' ? JSON.parse(h.detail_json) : h.detail_json || {};
        } catch {
          detail = {};
        }

        if (detail?.need_review === true) {
          return {
            idKunci,
            judulUjian,
            guruNama: kGuru,
            status: 'REVIEW_GURU',
            skor: null,
            kkm,
            predikat: null,
            lulus: null,
            updatedAt: h.timestamp ? String(h.timestamp) : undefined,
          };
        }

        const skorNum = Number(h.skor) || 0;
        const lulus = skorNum >= kkm;
        const predikat =
          skorNum >= 90 ? 'A' : skorNum >= 80 ? 'B' : skorNum >= kkm ? 'C' : 'D';

        return {
          idKunci,
          judulUjian,
          guruNama: kGuru,
          status: 'SELESAI',
          skor: portalShowScore ? skorNum : null,
          kkm,
          predikat: portalShowScore ? predikat : null,
          lulus: portalShowScore ? lulus : null,
          benar: portalShowScore && detail?.benar !== undefined ? Number(detail.benar) : undefined,
          salah: portalShowScore && detail?.salah !== undefined ? Number(detail.salah) : undefined,
          kosong:
            portalShowScore && detail?.tidak_dijawab !== undefined
              ? Number(detail.tidak_dijawab)
              : undefined,
          updatedAt: h.timestamp ? String(h.timestamp) : undefined,
        };
      });

      assessments.sort((a, b) => statusRank[a.status] - statusRank[b.status]);

      let overallStatus: MapelPortalStatus = 'MENUNGGU_UJIAN';
      if (assessments.some((a) => a.status === 'SELESAI')) {
        overallStatus = 'SELESAI';
      } else if (assessments.some((a) => a.status === 'REVIEW_GURU')) {
        overallStatus = 'REVIEW_GURU';
      }

      return {
        idMapel,
        namaMapel,
        guruNama,
        isIntegrated: true,
        overallStatus,
        kkm,
        assessments,
      };
    })
    .sort((a, b) => {
      if (a.isIntegrated !== b.isIntegrated) return a.isIntegrated ? -1 : 1;
      const rankDiff = statusRank[a.overallStatus] - statusRank[b.overallStatus];
      if (rankDiff !== 0) return rankDiff;
      return a.namaMapel.localeCompare(b.namaMapel, 'id');
    });

  const totalMapel = mapelList.length;
  const integratedCount = mapelList.filter((m) => m.isIntegrated).length;
  const notIntegratedCount = totalMapel - integratedCount;
  const completedCount = mapelList.filter(
    (m) => m.overallStatus === 'SELESAI' || m.overallStatus === 'REVIEW_GURU'
  ).length;

  return {
    valid: true,
    portalShowScore,
    checkedAtIso: new Date().toISOString(),
    schoolBranding,
    academicSession: { tahunAjaran, semester },
    configSummary: {
      judulUjian: config.judulUjian,
      kurikulumLabel: config.kurikulumLabel,
      tanggalCetak: config.tanggalCetak,
    },
    student: {
      id_siswa: student.id_siswa,
      nis: student.nis,
      nama: student.nama,
      nama_kelas: student.nama_kelas,
      jenjang: student.jenjang,
      noAbsen: meta.noAbsen,
      noPeserta: meta.noPeserta,
      ruang: meta.ruang,
      meja: meta.meja,
      initials: meta.initials,
      avatarBg: meta.avatarColors.bg,
      themeVariant: meta.theme.variant,
      primaryDark: meta.theme.primaryDark,
      primaryMid: meta.theme.primaryMid,
      goldAccent: meta.theme.goldAccent,
      pillBg: meta.theme.pillBg,
      pillBorder: meta.theme.pillBorder,
      pillText: meta.theme.pillText,
    },
    stats: {
      totalMapel,
      integratedCount,
      notIntegratedCount,
      completedCount,
    },
    mapelList,
  };
}
