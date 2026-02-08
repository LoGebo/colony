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

/**
 * Export an array of objects to a CSV file.
 * Triggers a browser download of the file.
 *
 * @param data - Array of row objects (keys become column headers)
 * @param filename - Output filename without extension
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string
): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
