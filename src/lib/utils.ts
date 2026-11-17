/**
 * utils.ts
 * Kumpulan fungsi helper utilitas untuk aplikasi.
 */

/**
 * transformDriveLink
 * Mengonversi link Google Drive (view/edit) menjadi direct thumbnail link 
 * agar dapat ditampilkan di Next.js Image component.
 */
export function transformDriveLink(url: string): string {
  if (!url) return '';
  
  // Jika bukan link Google Drive, kembalikan apa adanya
  if (!url.includes('drive.google.com')) return url;

  try {
    // Regex untuk mengambil File ID dari berbagai format link Drive
    // Format 1: https://drive.google.com/file/d/FILE_ID/view
    // Format 2: https://drive.google.com/open?id=FILE_ID
    const fileIdMatch = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
    
    if (fileIdMatch && fileIdMatch[1]) {
      const fileId = fileIdMatch[1];
      // Menggunakan thumbnail link (lebih cepat dan handal untuk preview)
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
    }
    
    return url;
  } catch (e) {
    console.error('Error transforming Drive link:', e);
    return url;
  }
}
