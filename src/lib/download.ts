import { formatExportCell } from './displayFormat';
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const quote = (value: string | number) =>
    `"${String(value)
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`;
  const content = [
    headers,
    ...rows.map((row) => row.map((cell, i) => formatExportCell(headers[i], cell))),
  ]
    .map((row) => row.map(quote).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
