import crypto from 'crypto';

export interface KartuQrPayload {
  /** id_siswa */
  s: string;
  /** tahun_ajaran */
  ta: string;
  /** semester */
  sm: string;
  /** kartu_qr_token_epoch */
  e: number;
}

function getQrSigningSecret(): string {
  return process.env.SESSION_SECRET || 'dev-session-secret-change-in-production';
}

function computeHmacSlice(dataPart: string, byteLen: number): string {
  return crypto
    .createHmac('sha256', getQrSigningSecret())
    .update(`wmvaa-kpu:${dataPart}`)
    .digest()
    .subarray(0, byteLen)
    .toString('base64url');
}

/**
 * Menandatangani token kapabilitas QR siswa menggunakan format ringkas (~52 karakter)
 * berbasis HMAC-SHA256 agar URL QR padat-minimal dan langsung terdeteksi kamera HP sebagai link browser.
 */
export function signKartuQrToken(payload: KartuQrPayload): string {
  const cleanS = String(payload.s || '').replace(/\|/g, '').trim();
  const cleanTa = String(payload.ta || '2026/2027').replace(/\|/g, '').trim();
  const cleanSm = String(payload.sm || 'GANJIL').replace(/\|/g, '').trim().toUpperCase();
  const cleanE = Math.max(1, Number(payload.e) || 1);

  const compactRaw = `${cleanS}|${cleanTa}|${cleanSm}|${cleanE}`;
  const encoded = Buffer.from(compactRaw, 'utf8').toString('base64url');
  const sig = computeHmacSlice(encoded, 12);
  return `${encoded}.${sig}`;
}

/**
 * Memverifikasi token QR dari URL /kartu/v/[token] secara timing-safe.
 * Mendukung format ringkas terbaru (s|ta|sm|e) maupun format JSON versi awal secara mundur.
 */
export function verifyKartuQrToken(
  rawToken: string,
  expectedEpoch: number
): KartuQrPayload | null {
  try {
    const token = String(rawToken || '').trim();
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [encoded, providedSig] = parts;
    if (!encoded || !providedSig) return null;

    const decodedStr = Buffer.from(encoded, 'base64url').toString('utf8');
    const isLegacyJson = decodedStr.startsWith('{');
    const expectedSig = computeHmacSlice(encoded, isLegacyJson ? 16 : 12);

    const bufProvided = Buffer.from(providedSig, 'utf8');
    const bufExpected = Buffer.from(expectedSig, 'utf8');
    if (bufProvided.length !== bufExpected.length) return null;
    if (!crypto.timingSafeEqual(bufProvided, bufExpected)) return null;

    let parsed: Partial<KartuQrPayload>;
    if (isLegacyJson) {
      parsed = JSON.parse(decodedStr) as Partial<KartuQrPayload>;
    } else {
      const fields = decodedStr.split('|');
      if (fields.length !== 4) return null;
      parsed = {
        s: fields[0],
        ta: fields[1],
        sm: fields[2],
        e: Number(fields[3]),
      };
    }

    if (!parsed?.s || !parsed?.ta || !parsed?.sm) return null;
    const tokenEpoch = Number(parsed.e) || 0;
    if (tokenEpoch !== Math.max(1, Number(expectedEpoch) || 1)) return null;

    return {
      s: String(parsed.s).trim(),
      ta: String(parsed.ta).trim(),
      sm: String(parsed.sm).trim().toUpperCase(),
      e: tokenEpoch,
    };
  } catch {
    return null;
  }
}
