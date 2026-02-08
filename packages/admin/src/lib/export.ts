/**
 * Excel export utility using SheetJS.
 * Generates .xlsx files client-side without server processing.
 */
import * as XLSX from 'xlsx';

/**
 * Export an array of objects to an Excel (.xlsx) file.
 * Triggers a browser download of the file.
 *
 * @param data - Array of row objects (keys become column headers)
 * @param filename - Output filename without extension
 * @param sheetName - Excel sheet name (default: "Datos")
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Datos'
): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
