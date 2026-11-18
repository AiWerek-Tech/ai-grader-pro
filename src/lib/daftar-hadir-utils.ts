import {
  buildClassAbsenMap,
  KartuPesertaConfig,
  KartuStudentItem,
  KartuStudentOverride,
  resolveParticipantMeta,
} from '@/lib/kartu-peserta-utils';
import {
  JadwalUjianUnitConfig,
  resolveMatchingScheduleColumn,
} from '@/lib/jadwal-ujian-utils';

export type DaftarHadirMode = 'PER_SESI' | 'PER_HARI' | 'BLANGKO';
export type DaftarHadirGroupMode = 'PER_KELAS' | 'PER_RUANG';
export type DaftarHadirSignerMode = 'PANITIA' | 'KEPSEK' | 'NONE';

export interface DaftarHadirConfig {
  mode: DaftarHadirMode;
  groupMode: DaftarHadirGroupMode;
  includeBeritaAcara: boolean;
  jumlahPengawas: 1 | 2;
  pengawas1Nama: string;
  pengawas1Nip: string;
  pengawas2Nama: string;
  pengawas2Nip: string;
  signerMode: DaftarHadirSignerMode;
  customHariTanggal: string;
  customWaktu: string;
  customMapel: string;
}

export interface DaftarHadirParticipantRow {
  student: KartuStudentItem;
  noUrut: string;
  noPeserta: string;
  ruang: string;
  meja: string;
}

export interface DaftarHadirParticipantGroup {
  key: string;
  label: string;
  ruangLabel: string;
  kelasLabel: string;
  jenjang: 'SMP' | 'SMA';
  participants: DaftarHadirParticipantRow[];
}

export interface DaftarHadirSessionSlot {
  slotId: string;
  waktu: string;
  mapel: string;
}

export interface DaftarHadirDocumentSpec {
  id: string;
  group: DaftarHadirParticipantGroup;
  mode: DaftarHadirMode;
  hariTanggal: string;
  waktu: string;
  mapel: string;
  daySessions: DaftarHadirSessionSlot[];
}

export function getDefaultDaftarHadirConfig(): DaftarHadirConfig {
  return {
    mode: 'PER_SESI',
    groupMode: 'PER_KELAS',
    includeBeritaAcara: false,
    jumlahPengawas: 2,
    pengawas1Nama: '',
    pengawas1Nip: '',
    pengawas2Nama: '',
    pengawas2Nip: '',
    signerMode: 'PANITIA',
    customHariTanggal: '',
    customWaktu: '07.30 - 09.00',
    customMapel: '',
  };
}

export function parseDaftarHadirConfigFromSettings(
  settings: Record<string, string> = {}
): DaftarHadirConfig {
  const defaults = getDefaultDaftarHadirConfig();
  const raw = settings['daftar_hadir_config_json'];
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return {
      mode:
        parsed.mode === 'PER_HARI'
          ? 'PER_HARI'
          : parsed.mode === 'BLANGKO'
            ? 'BLANGKO'
            : 'PER_SESI',
      groupMode: parsed.groupMode === 'PER_RUANG' ? 'PER_RUANG' : 'PER_KELAS',
      includeBeritaAcara: Boolean(parsed.includeBeritaAcara),
      jumlahPengawas: Number(parsed.jumlahPengawas) === 1 ? 1 : 2,
      pengawas1Nama: String(parsed.pengawas1Nama || ''),
      pengawas1Nip: String(parsed.pengawas1Nip || ''),
      pengawas2Nama: String(parsed.pengawas2Nama || ''),
      pengawas2Nip: String(parsed.pengawas2Nip || ''),
      signerMode:
        parsed.signerMode === 'KEPSEK'
          ? 'KEPSEK'
          : parsed.signerMode === 'NONE'
            ? 'NONE'
            : 'PANITIA',
      customHariTanggal: String(parsed.customHariTanggal || ''),
      customWaktu: String(parsed.customWaktu || defaults.customWaktu),
      customMapel: String(parsed.customMapel || ''),
    };
  } catch {
    return defaults;
  }
}

export function buildDaftarHadirGroups(
  students: KartuStudentItem[],
  kartuConfig: KartuPesertaConfig,
  overrides: Record<string, KartuStudentOverride>,
  settings: Record<string, string>,
  academicSession: { tahunAjaran: string; semester: string },
  groupMode: DaftarHadirGroupMode
): DaftarHadirParticipantGroup[] {
  const classAbsenMap = buildClassAbsenMap(students);
  const groupsMap = new Map<string, DaftarHadirParticipantGroup>();

  students.forEach((student, idx) => {
    const meta = resolveParticipantMeta(
      student,
      idx,
      kartuConfig,
      overrides,
      classAbsenMap,
      settings,
      academicSession
    );

    const groupKey =
      groupMode === 'PER_RUANG'
        ? `${student.jenjang}::${meta.ruang}`
        : `${student.jenjang}::${student.nama_kelas}`;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        key: groupKey,
        label:
          groupMode === 'PER_RUANG'
            ? `${meta.ruang} (${student.jenjang})`
            : student.nama_kelas,
        ruangLabel: meta.ruang,
        kelasLabel: student.nama_kelas,
        jenjang: student.jenjang,
        participants: [],
      });
    }

    const grp = groupsMap.get(groupKey)!;
    grp.participants.push({
      student,
      noUrut: meta.noAbsen,
      noPeserta: meta.noPeserta,
      ruang: meta.ruang,
      meja: meta.meja,
    });
  });

  const groups = Array.from(groupsMap.values());
  groups.forEach((g) => {
    g.participants.sort((a, b) => {
      const numA = parseInt(a.noUrut, 10) || 0;
      const numB = parseInt(b.noUrut, 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.student.nama.localeCompare(b.student.nama, 'id');
    });
  });

  return groups.sort((a, b) => a.label.localeCompare(b.label, 'id', { numeric: true }));
}

export function buildDaftarHadirDocuments(
  groups: DaftarHadirParticipantGroup[],
  config: DaftarHadirConfig,
  jadwalMaster: { SMP: JadwalUjianUnitConfig; SMA: JadwalUjianUnitConfig },
  filterDayId: string = 'ALL',
  filterSlotKey: string = 'ALL'
): DaftarHadirDocumentSpec[] {
  const docs: DaftarHadirDocumentSpec[] = [];

  for (const group of groups) {
    if (config.mode === 'BLANGKO') {
      docs.push({
        id: `${group.key}::blangko`,
        group,
        mode: 'BLANGKO',
        hariTanggal: config.customHariTanggal || '........................................',
        waktu: config.customWaktu || '....................',
        mapel: config.customMapel || '........................................',
        daySessions: [],
      });
      continue;
    }

    const unitJadwal = group.jenjang === 'SMP' ? jadwalMaster.SMP : jadwalMaster.SMA;
    const matchedCol = resolveMatchingScheduleColumn(group.kelasLabel, unitJadwal.columns);

    for (const day of unitJadwal.days) {
      if (filterDayId !== 'ALL' && day.id !== filterDayId) continue;

      const validSessions: DaftarHadirSessionSlot[] = [];
      for (const slot of day.slots) {
        if (slot.type === 'BREAK') continue;
        const mapel = matchedCol ? String(slot.mapelByColumn?.[matchedCol] || '').trim() : '';
        if (!mapel || mapel === '-' || mapel === '—') continue;
        validSessions.push({
          slotId: slot.id,
          waktu: slot.waktu,
          mapel,
        });
      }

      if (validSessions.length === 0) continue;

      if (config.mode === 'PER_HARI') {
        docs.push({
          id: `${group.key}::${day.id}`,
          group,
          mode: 'PER_HARI',
          hariTanggal: day.hariTanggal,
          waktu: `${validSessions[0].waktu.split('-')[0] || ''} - ${
            validSessions[validSessions.length - 1].waktu.split('-')[1] || ''
          }`,
          mapel: validSessions.map((s) => s.mapel).join(', '),
          daySessions: validSessions,
        });
      } else {
        for (const sess of validSessions) {
          if (filterSlotKey !== 'ALL' && sess.slotId !== filterSlotKey && sess.mapel !== filterSlotKey) {
            continue;
          }
          docs.push({
            id: `${group.key}::${day.id}::${sess.slotId}`,
            group,
            mode: 'PER_SESI',
            hariTanggal: day.hariTanggal,
            waktu: sess.waktu,
            mapel: sess.mapel,
            daySessions: [sess],
          });
        }
      }
    }
  }

  return docs;
}
