/**
 * Enhanced Export Service
 * Professional PDF and Excel export for siswa data
 */

import { createWorkbook, downloadWorkbook } from '@/lib/utils/excel';

export interface ExportOptions {
  filename?: string;
  includeTimestamp?: boolean;
  format?: 'excel' | 'pdf';
  title?: string;
  subtitle?: string;
}

export interface SiswaExportData {
  siswa: any[];
  kelas: any[];
  title?: string;
  subtitle?: string;
}

class SiswaExportService {
  /**
   * Export to Excel with professional formatting
   */
  static async exportToExcel(data: SiswaExportData, options: ExportOptions = {}): Promise<void> {
    const { 
      filename = 'data-siswa', 
      includeTimestamp = true,
      title = 'Data Siswa',
      subtitle = 'Export dari WMVAA AI Grader Pro'
    } = options;

    const timestamp = includeTimestamp ? `_${new Date().toISOString().split('T')[0]}` : '';
    const fullFilename = `${filename}${timestamp}.xlsx`;

    // Prepare data
    const exportData = data.siswa.map(siswa => {
      const kelasData = data.kelas.find(k => k.id_kelas === siswa.id_kelas);
      return {
        'ID Siswa': siswa.id_siswa,
        'NIS': siswa.nis,
        'Nama Lengkap': siswa.nama,
        'Kelas': kelasData?.nama_kelas || siswa.id_kelas,
        'Jenjang': kelasData?.jenjang || '-',
        'Status': siswa.status || 'Aktif',
        'Tanggal Dibuat': siswa.created_at ? new Date(siswa.created_at).toLocaleDateString('id-ID') : '-'
      };
    });

    const workbook = createWorkbook();
    const worksheet = workbook.addWorksheet('Data Siswa');
    const columns = [
      { header: 'ID Siswa', key: 'ID Siswa', width: 15 },
      { header: 'NIS', key: 'NIS', width: 12 },
      { header: 'Nama Lengkap', key: 'Nama Lengkap', width: 30 },
      { header: 'Kelas', key: 'Kelas', width: 15 },
      { header: 'Jenjang', key: 'Jenjang', width: 10 },
      { header: 'Status', key: 'Status', width: 12 },
      { header: 'Tanggal Dibuat', key: 'Tanggal Dibuat', width: 18 }
    ];

    worksheet.columns = columns;
    worksheet.spliceRows(1, 1);
    worksheet.addRow([title]);
    worksheet.addRow([subtitle]);
    worksheet.addRow([`Total: ${data.siswa.length} siswa`]);
    worksheet.addRow([]);
    worksheet.addRow(columns.map(column => column.header));
    exportData.forEach((row) => worksheet.addRow(row));

    worksheet.mergeCells(1, 1, 1, columns.length);
    worksheet.mergeCells(2, 1, 2, columns.length);
    worksheet.mergeCells(3, 1, 3, columns.length);

    worksheet.getRow(1).font = { bold: true, size: 16 };
    worksheet.getRow(2).font = { italic: true, color: { argb: 'FF6B7280' } };
    worksheet.getRow(3).font = { bold: true };

    const headerRow = worksheet.getRow(5);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF10B981' }
      };
      cell.alignment = { horizontal: 'center' };
    });

    await downloadWorkbook(workbook, fullFilename);
  }

  /**
   * Export to PDF (simulated with print functionality)
   * In production, this would use a PDF generation library
   */
  static exportToPDF(data: SiswaExportData, options: ExportOptions = {}): void {
    const { title = 'Data Siswa' } = options;

    // Create print-friendly HTML
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup blocker prevented opening print window. Please allow popups for this site.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: A4 landscape; margin: 20mm; }
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            margin: 0; 
            padding: 20px;
            color: #333;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px;
            border-bottom: 3px solid #10B981;
            padding-bottom: 20px;
          }
          .header h1 { 
            margin: 0; 
            font-size: 24px; 
            color: #1f2937;
            font-weight: 700;
          }
          .header p { 
            margin: 10px 0 0 0; 
            color: #6b7280;
            font-size: 14px;
          }
          .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
            justify-content: center;
          }
          .stat-box {
            background: #f3f4f6;
            padding: 15px 25px;
            border-radius: 8px;
            text-align: center;
          }
          .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #10B981;
          }
          .stat-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
          }
          th { 
            background: #10B981; 
            color: white; 
            padding: 12px; 
            text-align: left; 
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td { 
            padding: 10px 12px; 
            border-bottom: 1px solid #e5e7eb;
            font-size: 13px;
          }
          tr:nth-child(even) { background: #f9fafb; }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p>WMVAA AI Grader Pro - Sistem Manajemen Siswa</p>
          <p>Dicetak pada: ${new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
        </div>
        
        <div class="stats">
          <div class="stat-box">
            <div class="stat-value">${data.siswa.length}</div>
            <div class="stat-label">Total Siswa</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${data.kelas.length}</div>
            <div class="stat-label">Total Kelas</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>NIS</th>
              <th>Nama Lengkap</th>
              <th>Kelas</th>
              <th>Jenjang</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.siswa.map((siswa, index) => {
              const kelasData = data.kelas.find(k => k.id_kelas === siswa.id_kelas);
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${siswa.nis}</td>
                  <td>${siswa.nama}</td>
                  <td>${kelasData?.nama_kelas || siswa.id_kelas}</td>
                  <td>${kelasData?.jenjang || '-'}</td>
                  <td>${siswa.status || 'Aktif'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>© ${new Date().getFullYear()} WMVAA AI Grader Pro. Data ini bersifat rahasia.</p>
        </div>

        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="
            background: #10B981;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            font-weight: 600;
          ">
            🖨️ Print / Save as PDF
          </button>
          <p style="margin-top: 10px; font-size: 12px; color: #6b7280;">
            Click the button above to print or save as PDF
          </p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  /**
   * Export to CSV (fallback option)
   */
  static exportToCSV(data: SiswaExportData, options: ExportOptions = {}): void {
    const { 
      filename = 'data-siswa', 
      includeTimestamp = true 
    } = options;

    const timestamp = includeTimestamp ? `_${new Date().toISOString().split('T')[0]}` : '';
    const fullFilename = `${filename}${timestamp}.csv`;

    const headers = ['ID Siswa', 'NIS', 'Nama', 'Kelas', 'Jenjang', 'Status'];
    
    const rows = data.siswa.map(siswa => {
      const kelasData = data.kelas.find(k => k.id_kelas === siswa.id_kelas);
      return [
        siswa.id_siswa,
        siswa.nis,
        `"${siswa.nama}"`, // Quote to handle commas
        kelasData?.nama_kelas || siswa.id_kelas,
        kelasData?.jenjang || '-',
        siswa.status || 'Aktif'
      ].join(',');
    });

    const csvContent = [
      headers.join(','),
      ...rows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fullFilename;
    link.click();
  }
}

export default SiswaExportService;
