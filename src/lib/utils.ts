import { withBasePath } from '@/lib/base-path';

/**
 * utils.ts
 * Kumpulan fungsi helper utilitas untuk resolusi gambar/logo universal
 * (Upload File Lokal Base64, Google Drive berbagai format, URL Eksternal, dan Path Lokal).
 */

/**
 * Mengekstrak File ID Google Drive dari berbagai variasi tautan berbagi/unduhan:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID&export=view
 * - https://drive.google.com/thumbnail?id=FILE_ID&sz=w500
 * - https://drive.usercontent.google.com/download?id=FILE_ID
 * - https://lh3.googleusercontent.com/d/FILE_ID
 * - https://docs.google.com/uc?id=FILE_ID
 */
export function extractDriveFileId(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null;

  const isDriveDomain =
    trimmed.includes('drive.google.com') ||
    trimmed.includes('docs.google.com') ||
    trimmed.includes('drive.usercontent.google.com') ||
    trimmed.includes('googleusercontent.com/d/');

  if (!isDriveDomain) return null;

  const matchD = trimmed.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (matchD && matchD[1]) return matchD[1];

  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (matchId && matchId[1]) return matchId[1];

  return null;
}

/**
 * Menormalkan URL gambar dari sumber mana pun menjadi URL utama yang siap di-render:
 * - Data URI (`data:image/...`) atau Blob URL (`blob:...`) -> dikembalikan langsung
 * - Google Drive URL -> dikonversi ke direct CDN `https://lh3.googleusercontent.com/d/{FILE_ID}`
 * - Path relatif/lokal (`/logo/...`) -> otomatis dibungkus `withBasePath('/logo/...')`
 * - URL HTTP/HTTPS eksternal -> dikembalikan langsung
 */
export function resolveUniversalImageUrl(rawUrl?: string, fallbackPath: string = ''): string {
  const input = String(rawUrl || '').trim();
  if (!input) {
    return fallbackPath ? resolveUniversalImageUrl(fallbackPath, '') : '';
  }

  if (input.startsWith('data:image/') || input.startsWith('blob:')) {
    return input;
  }

  const driveId = extractDriveFileId(input);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }

  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }

  // Path lokal (mis. /logo/logo_advent.png atau logo/tut_wuri.png)
  return withBasePath(input);
}

/**
 * Menghasilkan daftar berurutan kandidat URL gambar untuk fallback otomatis pada `<img onError>`:
 * 1. URL utama hasil `resolveUniversalImageUrl`
 * 2. Jika Google Drive: endpoint `drive.google.com/thumbnail?id=FILE_ID&sz=w600`
 * 3. Jika URL eksternal/Drive: endpoint internal `/api/proxy?url=...` (bebas blokir CORS/hotlink)
 * 4. Jika `fallbackPath` disediakan: `resolveUniversalImageUrl(fallbackPath)`
 */
export function buildImageFallbackCandidates(rawUrl?: string, fallbackPath: string = ''): string[] {
  const candidates: string[] = [];
  const pushUnique = (u?: string) => {
    if (u && !candidates.includes(u)) candidates.push(u);
  };

  const trimmed = String(rawUrl || '').trim();
  if (trimmed) {
    const primary = resolveUniversalImageUrl(trimmed);
    pushUnique(primary);

    const driveId = extractDriveFileId(trimmed);
    if (driveId) {
      const thumbUrl = `https://drive.google.com/thumbnail?id=${driveId}&sz=w600`;
      pushUnique(thumbUrl);
      const ucUrl = `https://drive.google.com/uc?export=view&id=${driveId}`;
      pushUnique(`${withBasePath('/api/proxy')}?raw=1&url=${encodeURIComponent(ucUrl)}`);
    } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      pushUnique(`${withBasePath('/api/proxy')}?raw=1&url=${encodeURIComponent(trimmed)}`);
    }
  }

  if (fallbackPath) {
    pushUnique(resolveUniversalImageUrl(fallbackPath));
  }

  return candidates;
}

/**
 * transformDriveLink
 * Kompatibilitas mundur untuk seluruh pemanggil lama — kini mendukung penuh
 * Google Drive, path lokal dengan basePath, Data URI, maupun URL eksternal.
 */
export function transformDriveLink(url: string): string {
  return resolveUniversalImageUrl(url);
}

/**
 * Mengompresi file gambar yang diunggah dari perangkat (PNG/JPG/WebP/SVG) di sisi client
 * menjadi Data URI ringkas (< 42.000 karakter) agar aman disimpan di dalam sel Google Sheets
 * dan dapat langsung dicetak ke PDF tanpa ketergantungan jaringan eksternal.
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxDimension: number = 240,
  maxDataUrlLength: number = 42000
): Promise<string> {
  if (!file) throw new Error('File gambar tidak ditemukan.');
  if (!file.type.startsWith('image/')) {
    throw new Error('Format file harus berupa gambar (PNG, JPG, WebP, atau SVG).');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Ukuran file gambar maksimal 8 MB.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });

  // Jika file sudah sangat kecil dan di bawah batas karakter, gunakan langsung
  if (rawDataUrl.length <= maxDataUrlLength && file.type === 'image/svg+xml') {
    return rawDataUrl;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('File gambar rusak atau tidak didukung browser.'));
    image.src = rawDataUrl;
  });

  const origW = img.naturalWidth || img.width || maxDimension;
  const origH = img.naturalHeight || img.height || maxDimension;

  let targetDim = maxDimension;
  while (targetDim >= 96) {
    const scale = Math.min(1, targetDim / Math.max(origW, origH));
    const width = Math.max(1, Math.round(origW * scale));
    const height = Math.max(1, Math.round(origH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Gagal menginisialisasi kanvas pemroses gambar.');

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // Coba PNG terlebih dahulu untuk menjaga transparansi logo sekolah
    const pngUrl = canvas.toDataURL('image/png');
    if (pngUrl.length <= maxDataUrlLength) {
      return pngUrl;
    }

    // Jika PNG terlalu besar, gunakan WebP (mendukung transparansi & kompresi jauh lebih kecil)
    for (const quality of [0.86, 0.74, 0.62]) {
      const webpUrl = canvas.toDataURL('image/webp', quality);
      if (webpUrl.startsWith('data:image/webp') && webpUrl.length <= maxDataUrlLength) {
        return webpUrl;
      }
    }

    // Fallback ke JPEG dengan latar putih bersih jika browser tidak mendukung encode WebP
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    for (const quality of [0.84, 0.72, 0.6]) {
      const jpgUrl = canvas.toDataURL('image/jpeg', quality);
      if (jpgUrl.length <= maxDataUrlLength) {
        return jpgUrl;
      }
    }

    targetDim = Math.round(targetDim * 0.78);
  }

  throw new Error('Gambar terlalu kompleks untuk dikompresi. Gunakan gambar logo yang lebih sederhana.');
}
