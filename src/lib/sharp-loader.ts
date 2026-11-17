import { createRequire } from 'module';
import path from 'path';

let cachedSharp: any = undefined;

/**
 * Memuat modul native `sharp` secara lazy saat runtime.
 * Mengembalikan `null` bila `sharp` tidak tersedia (misalnya di shared hosting cPanel
 * tanpa binary native Linux) sehingga Server Actions dan halaman dashboard tidak gagal dimuat.
 */
export async function getSharp(): Promise<any | null> {
  if (cachedSharp !== undefined) return cachedSharp;

  try {
    const req = createRequire(path.join(process.cwd(), 'package.json'));
    const moduleName = ['sh', 'arp'].join('');
    const mod = req(moduleName);
    cachedSharp = mod?.default || mod || null;
  } catch {
    cachedSharp = null;
  }

  return cachedSharp;
}
