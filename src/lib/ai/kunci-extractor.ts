import zlib from 'zlib';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveApiKeyPool } from '@/lib/ai/gemini-fallback';
import {
  buildMatchingSingleOptions,
  getTipeMeta,
  JENIS_ASESMEN_KM,
  JenisAsesmenKode,
  MATCHING_SINGLE_LETTERS,
  SemesterKode,
  TipeSoalKode,
} from '@/lib/constants/tipe-soal';

export type AiExtractMode = 'auto' | 'extract_only' | 'solve_questions';

export interface AiExtractInputFile {
  name: string;
  base64: string;
  mimeType: string;
}

export interface ExtractedKunciItem {
  no: number;
  tipe: TipeSoalKode;
  opsi: string[];
  poin: number;
  jawaban: any;
  jumlah_pernyataan?: number;
  jumlah_pasang?: number;
  panjang_jawaban?: number;
}

export interface SanitizedAiExtraction {
  judul_saran: string;
  jenis_asesmen_saran?: JenisAsesmenKode;
  semester_saran?: SemesterKode;
  catatan_ai: string;
  mode_terdeteksi: 'kunci_tertulis' | 'naskah_soal' | 'campuran';
  uncertainNumbers: number[];
  modelUsed: string;
  items: ExtractedKunciItem[];
}

const VALID_PG_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Baca entri file tertentu dari buffer arsip ZIP (.docx) menggunakan zlib bawaan Node. */
function readZipEntries(buffer: Buffer, entryPredicate: (name: string) => boolean): Array<{ name: string; content: Buffer }> {
  const results: Array<{ name: string; content: Buffer }> = [];
  // Cari End of Central Directory signature (0x06054b50) dari belakang
  const minOffset = Math.max(0, buffer.length - 65558);
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= minOffset; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return results;

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < totalEntries && cdOffset + 46 <= buffer.length; i++) {
    if (buffer.readUInt32LE(cdOffset) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(cdOffset + 10);
    const compSize = buffer.readUInt32LE(cdOffset + 20);
    const nameLen = buffer.readUInt16LE(cdOffset + 28);
    const extraLen = buffer.readUInt16LE(cdOffset + 30);
    const commentLen = buffer.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(cdOffset + 42);
    const name = buffer.toString('utf8', cdOffset + 46, cdOffset + 46 + nameLen);

    cdOffset += 46 + nameLen + extraLen + commentLen;
    if (!entryPredicate(name)) continue;
    if (localHeaderOffset + 30 > buffer.length) continue;
    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

    const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > buffer.length) continue;

    const slice = buffer.subarray(dataStart, dataEnd);
    try {
      const content = method === 0 ? Buffer.from(slice) : method === 8 ? zlib.inflateRawSync(slice) : null;
      if (content) results.push({ name, content });
    } catch {
      // Lewati entri XML yang gagal didekompresi
    }
  }

  return results;
}

function extractWordParagraphRuns(paraXml: string): string {
  const withBreaks = paraXml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, ' ')
    .replace(/<w:cr\b[^>]*\/>/g, ' ');

  const runs = withBreaks.match(/<w:r\b[\s\S]*?<\/w:r>/g);
  if (!runs) {
    return decodeXmlEntities(withBreaks.replace(/<[^>]+>/g, '')).trim();
  }

  let lineBuf = '';
  for (const run of runs) {
    const textMatches = run.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g);
    if (!textMatches) continue;
    const runText = textMatches
      .map((t) => decodeXmlEntities(t.replace(/<w:t\b[^>]*>|<\/w:t>/g, '')))
      .join('');
    if (!runText) continue;

    const rPrMatch = run.match(/<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/);
    const rPr = rPrMatch ? rPrMatch[1] : '';
    const hasBold = /<w:b(?:\s+w:val="(?:1|true)"|\s*\/>)/.test(rPr);
    const hasHighlight = /<w:highlight\b/.test(rPr) && !/<w:highlight\s+w:val="none"/.test(rPr);
    const hasColorMatch = rPr.match(/<w:color\b[^>]*w:val="([^"]+)"/);
    const colorHex = hasColorMatch ? hasColorMatch[1].toUpperCase() : '';
    const hasDistinctColor = Boolean(
      colorHex && colorHex !== 'AUTO' && colorHex !== '000000' && colorHex !== 'FFFFFF'
    );
    const hasUnderline = /<w:u\b/.test(rPr) && !/<w:u\s+w:val="none"/.test(rPr);

    const trimmed = runText.trim();
    const isShort = trimmed.length > 0 && trimmed.length <= 60;
    const isLabeledOption = /^[a-eA-E]\s*[.):]/.test(trimmed) && (hasBold || hasUnderline);
    if (isShort && (hasHighlight || hasDistinctColor || isLabeledOption)) {
      lineBuf += `${runText} [DITANDAI]`;
    } else {
      lineBuf += runText;
    }
  }

  return lineBuf.trim();
}

/** Ekstrak teks paragraf & tabel dari WordprocessingML sambil menjaga penanda visual (tebal/sorot/warna). */
function parseWordXmlToAnnotatedText(xml: string): string {
  const lines: string[] = [];
  // Pisahkan segmen tabel vs non-tabel secara berurutan
  const segments = xml.split(/(<w:tbl\b[\s\S]*?<\/w:tbl>)/g);

  for (const seg of segments) {
    if (!seg) continue;
    if (seg.startsWith('<w:tbl')) {
      const rows = seg.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
      for (const row of rows) {
        const cells = row.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
        const cellTexts = cells
          .map((cell) => {
            const paras = cell.split(/<\/w:p>/).map((p) => extractWordParagraphRuns(p)).filter(Boolean);
            return paras.join(' ');
          })
          .filter(Boolean);
        if (cellTexts.length > 0) {
          lines.push(cellTexts.join(' | '));
        }
      }
    } else {
      const paras = seg.split(/<\/w:p>/);
      for (const p of paras) {
        const text = extractWordParagraphRuns(p);
        if (text) lines.push(text);
      }
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Ekstrak naskah soal/kunci dari file Microsoft Word (.docx) dalam bentuk Buffer. */
export function extractTextFromDocxBuffer(buffer: Buffer): string {
  const entries = readZipEntries(buffer, (name) =>
    name === 'word/document.xml' ||
    /^word\/header\d*\.xml$/.test(name) ||
    /^word\/footnotes\.xml$/.test(name)
  );
  if (entries.length === 0) {
    throw new Error('File Word (.docx) tidak valid atau tidak berisi dokumen teks.');
  }

  // Urutkan header dulu, lalu document.xml, lalu footnotes
  const priority = (name: string) => (name.includes('header') ? 0 : name === 'word/document.xml' ? 1 : 2);
  entries.sort((a, b) => priority(a.name) - priority(b.name));

  const sections = entries
    .map((e) => parseWordXmlToAnnotatedText(e.content.toString('utf8')))
    .filter(Boolean);

  return sections.join('\n\n').trim();
}

/** Parse respons JSON dari Gemini dengan pemulihan otomatis apabila output array terpotong. */
export function parseAndRecoverAiJson(raw: string): any {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Coba pulihkan objek JSON bila bagian akhir array items terpotong karena panjang naskah
    const itemsIdx = cleaned.indexOf('"items"');
    if (itemsIdx === -1) {
      throw new Error('Respons AI tidak berbentuk JSON yang valid.');
    }

    const arrayStart = cleaned.indexOf('[', itemsIdx);
    if (arrayStart === -1) {
      throw new Error('Respons AI tidak memuat daftar soal.');
    }

    // Cari penutup objek item terakhir `}` di dalam array `items`
    const head = cleaned.slice(0, arrayStart + 1);
    const body = cleaned.slice(arrayStart + 1);
    const recoveredObjects: string[] = [];
    let depth = 0;
    let inString = false;
    let escaped = false;
    let objStart = -1;

    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') {
        if (depth === 0) objStart = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && objStart !== -1) {
          recoveredObjects.push(body.slice(objStart, i + 1));
          objStart = -1;
        }
      }
    }

    if (recoveredObjects.length === 0) {
      throw new Error('Output AI terpotong sebelum satu pun soal selesai diparsing.');
    }

    const patched = `${head}${recoveredObjects.join(',')}]}`;
    try {
      return JSON.parse(patched);
    } catch {
      return {
        items: recoveredObjects.map((o) => JSON.parse(o)),
      };
    }
  }
}

function normalizeAiTipe(rawTipe: unknown): TipeSoalKode {
  const s = String(rawTipe || '').trim().toLowerCase();
  const aliasMap: Record<string, TipeSoalKode> = {
    pg: 'single_choice',
    'pg-e': 'single_choice',
    pg_e: 'single_choice',
    'a-e': 'single_choice',
    pilihan_ganda: 'single_choice',
    'pg-d': 'single_choice_4',
    pg_d: 'single_choice_4',
    pg4: 'single_choice_4',
    'a-d': 'single_choice_4',
    'b/s': 'true_false',
    bs: 'true_false',
    benar_salah: 'true_false',
    'benar-salah': 'true_false',
    pgk: 'multiple_select',
    pg_kompleks: 'multiple_select',
    kompleks: 'multiple_select',
    mtf: 'multiple_true_false',
    bs_majemuk: 'multiple_true_false',
    jdh: 'matching',
    menjodohkan: 'matching',
    'jdh-1': 'matching_single',
    jdh1: 'matching_single',
    jdh_1: 'matching_single',
    matching_single: 'matching_single',
    menjodohkan_tunggal: 'matching_single',
    menjodohkan_klasik: 'matching_single',
    isn: 'short_answer',
    isian: 'short_answer',
    isian_singkat: 'short_answer',
    esi: 'essay',
    esai: 'essay',
    uraian: 'essay',
  };
  if (aliasMap[s]) return aliasMap[s];
  return getTipeMeta(String(rawTipe || 'single_choice')).kode;
}

function isEmptyOrUncertainValue(raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    return (
      !t ||
      t === '?' ||
      t === '-' ||
      t === '—' ||
      t === 'null' ||
      t === 'none' ||
      t === 'n/a' ||
      t === 'unknown' ||
      t === 'tidak diketahui' ||
      t === 'ragu'
    );
  }
  return false;
}

function normalizeTfToken(raw: unknown): 'B' | 'S' | '' {
  const s = String(raw || '').trim().toUpperCase();
  if (!s || isEmptyOrUncertainValue(s)) return '';
  if (s === 'B' || s.startsWith('BENAR') || s.startsWith('BETUL') || s === 'TRUE' || s === 'T' || s === 'YA' || s === '✓' || s === 'V') {
    return 'B';
  }
  if (s === 'S' || s.startsWith('SALAH') || s.startsWith('KELIRU') || s === 'FALSE' || s === 'F' || s === 'TIDAK' || s === '✗' || s === 'X') {
    return 'S';
  }
  return '';
}

function normalizePgLetters(raw: unknown, allowed: readonly string[]): string[] {
  if (Array.isArray(raw)) {
    const found = raw
      .map((v) => String(v || '').trim().toUpperCase().match(/[A-E]/)?.[0] || '')
      .filter((ch) => allowed.includes(ch));
    return [...new Set(found)].sort();
  }
  if (typeof raw === 'string') {
    if (isEmptyOrUncertainValue(raw)) return [];
    const cleaned = raw.toUpperCase().replace(/\bJAWABAN\b|\bKUNCI\b/g, '').trim();
    // Dukung format "A, C", "A C", atau "ACD"
    const chars = cleaned.match(/[A-E]/g) || [];
    const uniqueValid = [...new Set(chars.filter((ch) => allowed.includes(ch)))].sort();
    return uniqueValid;
  }
  return [];
}

function scaleItemsTo100(items: ExtractedKunciItem[]): ExtractedKunciItem[] {
  if (items.length === 0) return items;
  const rawTotal = items.reduce((s, it) => s + (Number(it.poin) || 1), 0);
  if (rawTotal <= 0 || Math.abs(rawTotal - 100) < 0.05) return items;

  const scaled = items.map((it) => {
    const nextPoin = Math.max(0.05, Math.round(((Number(it.poin) || 1) / rawTotal) * 100 * 100) / 100);
    return { ...it, poin: nextPoin };
  });

  // Koreksi selisih pembulatan kecil agar jumlah presisi tepat 100.00
  const afterSum = scaled.reduce((s, it) => s + it.poin, 0);
  const diff = Math.round((100 - afterSum) * 100) / 100;
  if (Math.abs(diff) > 0 && Math.abs(diff) < 1) {
    scaled[scaled.length - 1].poin = Math.max(0.05, Math.round((scaled[scaled.length - 1].poin + diff) * 100) / 100);
  }
  return scaled;
}

/** Validasi, normalisasi tanpa jawaban palsu, dedup nomor, dan penskalaan bobot hasil AI. */
export function sanitizeExtractedAiResult(
  parsed: any,
  modelUsed: string,
  options: { scaleTo100?: boolean } = {}
): SanitizedAiExtraction {
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
  const uncertainNumbers: number[] = [];

  // Cek apakah ujian PG secara konsisten memakai 4 opsi (A-D)
  const detectedPgOpsiRaw = String(parsed?.detected_pg_opsi || '').trim();
  const hasExplicitAnswerE = rawItems.some((it: any) => {
    const t = normalizeAiTipe(it?.tipe);
    if (t !== 'single_choice' && t !== 'single_choice_4') return false;
    return normalizePgLetters(it?.jawaban, VALID_PG_LETTERS).includes('E');
  });
  const countPg4 = rawItems.filter((it: any) => normalizeAiTipe(it?.tipe) === 'single_choice_4').length;
  const countPg5 = rawItems.filter((it: any) => normalizeAiTipe(it?.tipe) === 'single_choice').length;
  const prefer4Opsi =
    !hasExplicitAnswerE &&
    (detectedPgOpsiRaw === '4' || (countPg4 > 0 && countPg4 >= countPg5));

  const seenNos = new Set<number>();
  let needsSequentialRenumber = false;

  const preliminary: ExtractedKunciItem[] = rawItems.slice(0, 100).map((it: any, idx: number): ExtractedKunciItem => {
    let tipe = normalizeAiTipe(it?.tipe);
    if (prefer4Opsi && tipe === 'single_choice') {
      tipe = 'single_choice_4';
    }
    const meta = getTipeMeta(tipe);

    const parsedNo = Math.round(Number(it?.no));
    const isValidNo = Number.isFinite(parsedNo) && parsedNo >= 1 && parsedNo <= 200;
    if (!isValidNo || seenNos.has(parsedNo)) {
      needsSequentialRenumber = true;
    } else {
      seenNos.add(parsedNo);
    }

    const no = isValidNo ? parsedNo : idx + 1;
    const rawPoin = Number(it?.poin);
    const poin = Number.isFinite(rawPoin) && rawPoin > 0 ? Math.max(0.05, Math.round(rawPoin * 100) / 100) : 1;

    const item: ExtractedKunciItem = {
      no,
      tipe: meta.kode,
      opsi: [...meta.opsi],
      poin,
      jawaban: '',
    };

    if (meta.kode === 'multiple_true_false') {
      let arr: Array<'B' | 'S'> = [];
      if (Array.isArray(it?.jawaban)) {
        arr = it.jawaban.map((v: any) => normalizeTfToken(v)).filter((x: string): x is 'B' | 'S' => Boolean(x));
      } else if (typeof it?.jawaban === 'string' && !isEmptyOrUncertainValue(it.jawaban)) {
        const str = it.jawaban.trim();
        const tokens = /[\s,;|\-/]+/.test(str) ? str.split(/[\s,;|\-/]+/) : str.split('');
        arr = tokens.map((v: string) => normalizeTfToken(v)).filter((x: string): x is 'B' | 'S' => Boolean(x));
      }
      const jp = Math.max(2, Math.min(10, Number(it?.jumlah_pernyataan) || arr.length || 3));
      item.jumlah_pernyataan = jp;
      if (arr.length === 0) {
        item.jawaban = [];
        uncertainNumbers.push(idx + 1);
      } else {
        item.jawaban = Array.from({ length: jp }, (_, i) => arr[i] || '');
        if ((item.jawaban as string[]).some((v) => !v)) uncertainNumbers.push(idx + 1);
      }
    } else if (meta.kode === 'matching_single') {
      const validSet = new Set<string>(MATCHING_SINGLE_LETTERS);
      const rawOpsi = Array.isArray(it?.opsi)
        ? it.opsi.map((o: any) => String(o || '').trim().toUpperCase()).filter((o: string) => validSet.has(o))
        : [];
      const rawVal = isEmptyOrUncertainValue(it?.jawaban)
        ? ''
        : String(it.jawaban).trim().toUpperCase().replace(/[^A-L]/g, '').charAt(0);
      const ansIdx = rawVal ? MATCHING_SINGLE_LETTERS.indexOf(rawVal as any) : -1;
      const minCount = Math.max(5, rawOpsi.length || 10, ansIdx >= 0 ? ansIdx + 1 : 5);
      item.opsi = buildMatchingSingleOptions(minCount);
      item.jawaban = rawVal && item.opsi.includes(rawVal) ? rawVal : '';
      if (!item.jawaban) uncertainNumbers.push(idx + 1);
    } else if (meta.kode === 'matching') {
      const cleanMap: Record<string, string> = {};
      if (it?.jawaban && typeof it.jawaban === 'object' && !Array.isArray(it.jawaban)) {
        for (const [k, v] of Object.entries(it.jawaban)) {
          const cleanKey = String(k).match(/\d+/)?.[0];
          const cleanVal = String(v || '').trim().toUpperCase().match(/[A-E]/)?.[0];
          if (cleanKey && cleanVal) cleanMap[cleanKey] = cleanVal;
        }
      } else if (typeof it?.jawaban === 'string' && !isEmptyOrUncertainValue(it.jawaban)) {
        const pairs = it.jawaban.match(/(\d+)\s*[-:=>]\s*([A-Ea-e])/g) || [];
        for (const p of pairs) {
          const m = p.match(/(\d+)\s*[-:=>]\s*([A-Ea-e])/);
          if (m) cleanMap[m[1]] = m[2].toUpperCase();
        }
      }
      const jps = Math.max(2, Math.min(5, Number(it?.jumlah_pasang) || Object.keys(cleanMap).length || 3));
      item.jumlah_pasang = jps;
      item.jawaban = cleanMap;
      if (Object.keys(cleanMap).length < jps) {
        uncertainNumbers.push(idx + 1);
      }
    } else if (meta.kode === 'multiple_select') {
      const clean = normalizePgLetters(it?.jawaban, VALID_PG_LETTERS);
      item.jawaban = clean;
      if (clean.length === 0) uncertainNumbers.push(idx + 1);
    } else if (meta.kode === 'short_answer') {
      const val = Array.isArray(it?.jawaban)
        ? it.jawaban.map((v: any) => String(v || '').trim()).filter(Boolean).join(' | ')
        : isEmptyOrUncertainValue(it?.jawaban)
          ? ''
          : String(it.jawaban).trim();
      item.panjang_jawaban = Math.max(3, Math.min(20, Number(it?.panjang_jawaban) || Math.max(8, Math.min(20, val.length + 2)) || 10));
      item.jawaban = val;
      if (!val) uncertainNumbers.push(idx + 1);
    } else if (meta.kode === 'essay') {
      const val = Array.isArray(it?.jawaban)
        ? it.jawaban.map((v: any) => String(v || '').trim()).filter(Boolean).join(' | ')
        : isEmptyOrUncertainValue(it?.jawaban)
          ? ''
          : String(it.jawaban).trim();
      item.jawaban = val;
    } else if (meta.kode === 'true_false') {
      const tf = normalizeTfToken(it?.jawaban);
      item.jawaban = tf;
      if (!tf) uncertainNumbers.push(idx + 1);
    } else {
      const letters = normalizePgLetters(it?.jawaban, meta.opsi);
      // Untuk PG tunggal, hanya terima jika memang tepat 1 huruf valid (jangan asal pilih jika ragu!)
      const ch = letters.length === 1 ? letters[0] : '';
      item.jawaban = ch;
      if (!ch) uncertainNumbers.push(idx + 1);
    }

    return item;
  });

  // Terapkan penomoran berurutan jika ditemukan nomor duplikat (mis. Bagian I #1..20 + Bagian II #1..5)
  const renumbered = preliminary.map((item, idx) => {
    const finalNo = needsSequentialRenumber ? idx + 1 : item.no;
    return { ...item, no: finalNo };
  });

  const finalUncertain = uncertainNumbers
    .map((rawIdx) => renumbered[rawIdx - 1]?.no ?? rawIdx)
    .filter((n, i, arr) => arr.indexOf(n) === i);

  const finalItems = options.scaleTo100 === false ? renumbered : scaleItemsTo100(renumbered);

  const rawJenis = String(parsed?.jenis_asesmen_saran || '').trim().toUpperCase();
  const validJenis = JENIS_ASESMEN_KM.find((j) => j.kode === rawJenis)?.kode as JenisAsesmenKode | undefined;

  const rawSem = String(parsed?.semester_saran || '').trim().toUpperCase();
  const validSemester: SemesterKode | undefined =
    rawSem === 'GANJIL' || rawSem === 'GENAP' ? (rawSem as SemesterKode) : undefined;

  const rawModeDet = String(parsed?.mode_terdeteksi || '').trim().toLowerCase();
  const modeTerdeteksi: SanitizedAiExtraction['mode_terdeteksi'] =
    rawModeDet === 'naskah_soal' || rawModeDet === 'campuran' ? rawModeDet : 'kunci_tertulis';

  return {
    judul_saran: String(parsed?.judul_saran || '').trim(),
    jenis_asesmen_saran: validJenis,
    semester_saran: validSemester,
    catatan_ai: String(parsed?.catatan_ai || '').trim(),
    mode_terdeteksi: modeTerdeteksi,
    uncertainNumbers: finalUncertain,
    modelUsed,
    items: finalItems,
  };
}

function buildExtractorPrompt(mode: AiExtractMode, rawText: string, fileCount: number): string {
  const modeInstruction =
    mode === 'extract_only'
      ? `MODE EKSTRAKSI KETAT (Hanya Ambil Kunci Tertulis):
- Ekstrak HANYA jawaban yang tertulis jelas di tabel kunci, pembahasan, atau opsi bertanda [DITANDAI] / ditebalkan / dilingkari / disorot.
- DILARANG menebak atau mengarang jawaban jika soal tidak mencantumkan kunci atau tulisannya buram; isi jawaban dengan "" (string kosong).`
      : mode === 'solve_questions'
        ? `MODE PEMECAH SOAL (Ekstrak Soal & Jawab dengan AI):
- Materi berisi naskah soal ujian (mungkin belum ada halaman kunci).
- Kenali setiap nomor & tipe soal, lalu KERJAKAN dan TENTUKAN kunci jawaban yang paling tepat berdasarkan kaidah keilmuan sekolah Indonesia.
- Jika terdapat rujukan kunci tertulis atau tanda [DITANDAI], prioritaskan kunci tersebut.
- Jika suatu soal bergantung mutlak pada gambar/diagram yang terpotong/tidak terlihat sehingga mustahil dijawab, isi "" (kosong) dan jelaskan di "catatan_ai".`
        : `MODE OTOMATIS (Cerdas):
1. Periksa apakah materi sudah memiliki kunci jawaban tertulis, pembahasan, atau penanda [DITANDAI]. Jika ADA, ekstrak kunci tersebut dengan akurat tanpa mengubahnya.
2. Jika materi HANYA berisi naskah soal tanpa kunci tertulis, analisis dan kerjakan setiap butir soal secara cermat untuk menyusun kunci jawabannya.
3. Jika sebuah butir soal tidak memiliki kunci tertulis DAN gambarnya tidak jelas/tidak dapat dipecahkan secara pasti, jangan mengarang — isi "" (string kosong) dan catat nomornya di "catatan_ai".`;

  const truncatedText = rawText ? rawText.slice(0, 80000) : '';

  return `Anda adalah sistem ekstraktor naskah soal & kunci jawaban asesmen sekolah Indonesia (Kurikulum Merdeka & AKM).
${modeInstruction}

${fileCount > 1 ? `Materi lampiran terdiri dari ${fileCount} halaman gambar/dokumen berurutan. Gabungkan semua nomor soal secara berurutan tanpa melewatkan halaman mana pun.\n` : ''}
Aturan Skema Kode Tipe Soal (WAJIB gunakan kode persis ini):
- "single_choice": Pilihan Ganda 5 opsi (A–E) -> jawaban berupa 1 huruf: "A" | "B" | "C" | "D" | "E" | ""
- "single_choice_4": Pilihan Ganda 4 opsi (A–D, umumnya SD/SMP) -> jawaban berupa 1 huruf: "A" | "B" | "C" | "D" | ""
- "true_false": Benar / Salah tunggal -> jawaban: "B" | "S" | ""
- "multiple_select": PG Kompleks (>1 jawaban benar) -> jawaban array huruf: ["A","C"]
- "multiple_true_false": B/S Majemuk per pernyataan -> jawaban array: ["B","S","B"], wajib sertakan "jumlah_pernyataan" (2..10)
- "matching": Menjodohkan Matriks AKM (beberapa pasangan dalam 1 nomor soal) -> jawaban objek: {"1":"A","2":"B"}, wajib sertakan "jumlah_pasang" (2..5)
- "matching_single": Menjodohkan Klasik 1-ke-1 (setiap nomor soal mencocokkan 1 item ke daftar pilihan huruf bersama, misal No. 16–25 pilih huruf a–j) -> jawaban 1 huruf kapital: "J", sertakan "opsi": ["A","B",...,"J"] (5 sampai 12 huruf sesuai jumlah pilihan di kolom kanan)
- "short_answer": Isian Singkat -> jawaban teks/angka ringkas (pisahkan variasi sinonim dengan " | ", contoh: "Soekarno | Ir. Soekarno")
- "essay": Uraian / Esai -> jawaban berupa kata kunci penilaian ringkas dipisah " | ", atau "" bila penilaian manual guru

Aturan Penomoran, Opsi & Bobot:
- Urutkan seluruh soal dari awal hingga akhir (jika naskah mengulang nomor 1 di Bagian B/II/Esai, teruskan penomoran berurutan secara kumulatif 1..N agar setiap butir punya "no" unik).
- Jika soal PG hanya punya opsi A–D secara konsisten, gunakan "single_choice_4" dan set "detected_pg_opsi": "4". Jika ada opsi E, gunakan "single_choice" dan set "detected_pg_opsi": "5".
- Jika naskah mencantumkan poin/bobot eksplisit per bagian atau per nomor, isi "poin" sesuai dokumen; jika tidak ada, gunakan bobot proporsional (misal PG=1, PGK/MTF/JDH=2, Isian=2, Esai=5).
- Deteksi metadata asesmen jika tertera pada kop dokumen:
  * "jenis_asesmen_saran": pilih salah satu dari STS, SAS, SAT, SUMATIF_LM, FORMATIF, DIAGNOSTIK_KOG, DIAGNOSTIK_NON, ASAJ, TRYOUT, atau "".
  * "semester_saran": "GANJIL" atau "GENAP" atau "".

Format Output JSON WAJIB:
{
  "judul_saran": "Materi / Keterangan singkat atau judul asesmen jika terbaca, atau kosong",
  "jenis_asesmen_saran": "STS",
  "semester_saran": "GANJIL",
  "detected_pg_opsi": "4",
  "mode_terdeteksi": "kunci_tertulis",
  "catatan_ai": "Catatan singkat bila ada soal yang ragu/gambar kurang jelas atau pembobotan otomatis",
  "items": [
    { "no": 1, "tipe": "single_choice_4", "jawaban": "B", "poin": 2 }
  ]
}
Maksimal 100 butir soal. Keluarkan JSON murni tanpa teks atau markdown di luar JSON.${
    truncatedText ? `\n\nMATERI DOKUMEN:\n${truncatedText}` : ''
  }`;
}

export function formatAiExtractError(err: any): string {
  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('api_key_invalid') || msg.includes('api key not valid')) {
    return 'API Key Gemini tidak valid. Periksa kembali API Key di menu Pengaturan Sistem.';
  }
  if (msg.includes('429') || msg.includes('quota') || msg.includes('resource exhausted')) {
    return 'Kuota / batas kecepatan API Gemini sedang penuh (429). Coba lagi beberapa saat atau tambahkan API Key cadangan di Pengaturan.';
  }
  if (msg.includes('503') || msg.includes('overloaded') || msg.includes('high demand')) {
    return 'Server Gemini AI sedang padat (503). Silakan coba klik Ekstrak ulang beberapa detik lagi.';
  }
  if (msg.includes('timeout')) {
    return 'Proses pembacaan AI melebihi batas waktu karena dokumen sangat panjang/padat. Coba bagi dokumen per bagian atau perkecil jumlah halaman sekali proses.';
  }
  if (msg.includes('too large') || msg.includes('payload') || msg.includes('request entity')) {
    return 'Ukuran dokumen/foto terlalu besar. Gunakan maksimal ~8 MB atau pecah menjadi beberapa foto.';
  }
  return err?.message || 'Gemini AI gagal mengekstrak naskah atau kunci jawaban.';
}

/** Ekstrak soal & kunci jawaban menggunakan Gemini AI dengan rotasi multi-key, multi-model fallback, dan timeout aman. */
export async function runAiKeyExtraction(params: {
  rawText: string;
  mediaFiles: AiExtractInputFile[];
  mode: AiExtractMode;
  scaleTo100: boolean;
  settings: Record<string, string>;
}): Promise<SanitizedAiExtraction> {
  const apiKeys = resolveApiKeyPool(params.settings).filter((k) => k && k.trim().length >= 10);
  if (apiKeys.length === 0) {
    throw new Error('API Key Gemini belum dikonfigurasi di Pengaturan atau .env.local.');
  }

  const configuredModel = params.settings?.ai_model?.trim();
  const candidateModels = Array.from(
    new Set([
      configuredModel || 'gemini-3-flash-preview',
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ])
  ).filter(Boolean);

  const prompt = buildExtractorPrompt(params.mode, params.rawText, params.mediaFiles.length);
  const parts: any[] = [
    ...params.mediaFiles.map((f) => ({
      inlineData: { data: f.base64, mimeType: f.mimeType || 'image/jpeg' },
    })),
    prompt,
  ];

  const temperature = params.mode === 'solve_questions' ? 0.15 : 0.05;
  const timeoutMs = 55000;

  let rawResponse = '';
  let usedModel = '';
  let lastError: any = null;

  outer: for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const modelName = candidateModels[mIdx];
    const keyAttempts = Math.min(apiKeys.length, 3);

    for (let kIdx = 0; kIdx < keyAttempts; kIdx++) {
      const apiKey = apiKeys[(mIdx + kIdx) % apiKeys.length];
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel(
          {
            model: modelName,
            generationConfig: {
              temperature,
              maxOutputTokens: 16384,
              responseMimeType: 'application/json',
            },
          },
          { apiVersion: 'v1beta' }
        );

        const callPromise = model.generateContent(parts).then((res) => res.response.text());
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout membaca dokumen pada model ${modelName}`)), timeoutMs);
        });

        rawResponse = await Promise.race([callPromise, timeoutPromise]);
        if (rawResponse && rawResponse.trim()) {
          usedModel = modelName;
          break outer;
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '').toLowerCase();
        // Jika key tidak valid, langsung lanjut coba key berikutnya; kalau bukan error key/429, pindah model
        const isKeyOrQuotaIssue =
          msg.includes('429') ||
          msg.includes('quota') ||
          msg.includes('resource exhausted') ||
          msg.includes('api_key');
        if (!isKeyOrQuotaIssue) break;
      }
    }
  }

  if (!rawResponse) {
    throw new Error(formatAiExtractError(lastError));
  }

  const parsed = parseAndRecoverAiJson(rawResponse);
  const sanitized = sanitizeExtractedAiResult(parsed, usedModel, {
    scaleTo100: params.scaleTo100,
  });

  if (sanitized.items.length === 0) {
    throw new Error(
      'AI tidak menemukan butir soal atau kunci jawaban yang jelas pada materi tersebut. Pastikan tulisan terbaca atau pilih mode "Ekstrak Soal & Jawab dengan AI".'
    );
  }

  return sanitized;
}
