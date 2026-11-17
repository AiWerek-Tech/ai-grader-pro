import ExcelJS from 'exceljs';

function normalizeCellValue(value: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(item => normalizeCellValue(item as ExcelJS.CellValue)).filter(Boolean).join(', ');

  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return normalizeCellValue(value.result as ExcelJS.CellValue);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map(item => item.text).join('');
    }
    if ('hyperlink' in value && typeof value.hyperlink === 'string') return value.hyperlink;
  }

  return String(value);
}

export function createWorkbook() {
  return new ExcelJS.Workbook();
}

export async function loadWorkbookFromArrayBuffer(buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

export async function loadWorkbookFromFile(file: File) {
  return loadWorkbookFromArrayBuffer(await file.arrayBuffer());
}

export async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob(
    [buffer],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return blob.size;
}

export function worksheetToObjects(worksheet: ExcelJS.Worksheet) {
  const headerRow = worksheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
  const headers = headerValues
    .map((value: ExcelJS.CellValue) => String(normalizeCellValue(value) ?? '').trim());

  if (headers.length === 0 || headers.every(header => !header)) return [];

  const rows: Array<Record<string, string | number | boolean | Date | null>> = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowObject: Record<string, string | number | boolean | Date | null> = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      if (!header) return;
      const value = normalizeCellValue(row.getCell(index + 1).value);
      if (value !== null && value !== '') hasValue = true;
      rowObject[header] = value;
    });

    if (hasValue) rows.push(rowObject);
  });

  return rows;
}

export function worksheetToMatrix(worksheet: ExcelJS.Worksheet) {
  const rows: any[][] = [];

  worksheet.eachRow((row) => {
    const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
    const values = rowValues
      .map((value: ExcelJS.CellValue) => normalizeCellValue(value) ?? '');

    while (values.length > 0 && (values[values.length - 1] === '' || values[values.length - 1] === null)) {
      values.pop();
    }

    rows.push(values);
  });

  return rows;
}

export function appendObjectRows(
  worksheet: ExcelJS.Worksheet,
  rows: Record<string, any>[],
  options?: { headerStyle?: Partial<ExcelJS.Style>; columnWidths?: number[] }
) {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  worksheet.columns = headers.map((header, index) => ({
    header,
    key: header,
    width: options?.columnWidths?.[index] ?? Math.max(12, Math.min(40, header.length + 4))
  }));

  rows.forEach((row) => worksheet.addRow(row));

  if (options?.headerStyle) {
    worksheet.getRow(1).eachCell((cell) => {
      cell.style = { ...cell.style, ...options.headerStyle };
    });
  }

  return worksheet;
}
