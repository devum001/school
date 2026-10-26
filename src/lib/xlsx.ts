import { formatExportCell } from './displayFormat';
/** Minimal XLSX interchange for the student template, using browser ZIP/XML APIs. */
export type ExcelCell = string | number;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_BYTES = 20 * 1024 * 1024;
const xml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const entries = Object.entries(files).map(([path, content]) => ({
    name: encoder.encode(path),
    bytes: encoder.encode(content),
  }));
  const size = entries.reduce(
    (total, entry) => total + 30 + entry.name.length + entry.bytes.length + 46 + entry.name.length,
    22,
  );
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  const records: { offset: number; crc: number; name: Uint8Array; size: number }[] = [];
  for (const entry of entries) {
    const crc = crc32(entry.bytes);
    records.push({ offset, crc, name: entry.name, size: entry.bytes.length });
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0x0800, true);
    view.setUint16(offset + 12, 0x21, true);
    view.setUint32(offset + 14, crc, true);
    view.setUint32(offset + 18, entry.bytes.length, true);
    view.setUint32(offset + 22, entry.bytes.length, true);
    view.setUint16(offset + 26, entry.name.length, true);
    bytes.set(entry.name, offset + 30);
    bytes.set(entry.bytes, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.bytes.length;
  }
  const centralOffset = offset;
  for (const entry of records) {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 14, 0x21, true);
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, entry.size, true);
    view.setUint32(offset + 24, entry.size, true);
    view.setUint16(offset + 28, entry.name.length, true);
    view.setUint32(offset + 42, entry.offset, true);
    bytes.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  }
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, records.length, true);
  view.setUint16(offset + 10, records.length, true);
  view.setUint32(offset + 12, offset - centralOffset, true);
  view.setUint32(offset + 16, centralOffset, true);
  return bytes;
}
export function excelColumnName(index: number): string {
  let value = index + 1,
    name = '';
  while (value > 0) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}
function sheet(rows: ExcelCell[][]) {
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, index) => `<row r="${index + 1}">${row.map((value, column) => `<c r="${excelColumnName(column)}${index + 1}"${typeof value === 'number' ? '' : ' t="inlineStr"'}>${typeof value === 'number' ? `<v>${value}</v>` : `<is><t xml:space="preserve">${xml(value)}</t></is>`}</c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
}
export function studentWorkbook(
  rows: ExcelCell[][],
  instructions: string[] = [],
  sheetName = 'Students',
): Blob {
  return new Blob(
    [
      zip({
        '[Content_Types].xml':
          '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        '_rels/.rels':
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml': `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 31) || 'Data'}" sheetId="1" r:id="rId1"/><sheet name="Instructions" sheetId="2" r:id="rId2"/></sheets></workbook>`,
        'xl/_rels/workbook.xml.rels':
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
        'xl/worksheets/sheet1.xml': sheet(rows),
        'xl/worksheets/sheet2.xml': sheet(instructions.map((line) => [line])),
      }),
    ],
    { type: MIME },
  );
}
async function unzip(file: File): Promise<Map<string, string>> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an XLSX file under 10 MB.');
  const buffer = await file.arrayBuffer(),
    view = new DataView(buffer),
    bytes = new Uint8Array(buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  if (end < 0) throw new Error('This file is not a valid XLSX workbook.');
  const count = view.getUint16(end + 10, true);
  if (count > 500 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true))
    throw new Error('Use a standard, single-file XLSX workbook.');
  let offset = view.getUint32(end + 16, true),
    total = 0;
  const files = new Map<string, string>();
  for (let entry = 0; entry < count; entry++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('The workbook archive is damaged.');
    const flags = view.getUint16(offset + 8, true),
      method = view.getUint16(offset + 10, true),
      expectedCrc = view.getUint32(offset + 16, true),
      compressed = view.getUint32(offset + 20, true),
      size = view.getUint32(offset + 24, true);
    const nameSize = view.getUint16(offset + 28, true),
      extra = view.getUint16(offset + 30, true),
      comment = view.getUint16(offset + 32, true),
      local = view.getUint32(offset + 42, true);
    if (offset + 46 + nameSize + extra + comment > end)
      throw new Error('The workbook archive is damaged.');
    const path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameSize));
    offset += 46 + nameSize + extra + comment;
    total += size;
    if (flags & 1) throw new Error('Password-protected workbooks cannot be imported.');
    if (total > MAX_BYTES || size > MAX_BYTES)
      throw new Error('The expanded workbook is too large. Use the sample template.');
    if (!path.endsWith('.xml') && !path.endsWith('.rels')) continue;
    if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50)
      throw new Error('The workbook archive is damaged.');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + compressed > bytes.length) throw new Error('The workbook archive is damaged.');
    const packed = bytes.slice(start, start + compressed);
    let unpacked: Uint8Array;
    if (method === 0) unpacked = packed;
    else if (method === 8) {
      const reader = new Blob([packed])
        .stream()
        .pipeThrough(new DecompressionStream('deflate-raw'))
        .getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.length;
          if (length > size || length > MAX_BYTES) {
            await reader.cancel();
            throw new Error('The expanded workbook is too large or damaged.');
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      unpacked = new Uint8Array(length);
      let write = 0;
      for (const chunk of chunks) {
        unpacked.set(chunk, write);
        write += chunk.length;
      }
    } else throw new Error('Unsupported workbook compression. Save the file again as XLSX.');
    if (unpacked.length !== size || crc32(unpacked) !== expectedCrc)
      throw new Error('The workbook archive is damaged.');
    if (files.has(path))
      throw new Error('The workbook contains duplicate files. Save it again as XLSX.');
    files.set(path, decoder.decode(unpacked));
  }
  return files;
}
function documentXml(content: string | undefined) {
  if (!content || /<!DOCTYPE|<!ENTITY/i.test(content))
    throw new Error('The workbook XML is invalid.');
  const document = new DOMParser().parseFromString(content, 'application/xml');
  if (document.getElementsByTagName('parsererror').length)
    throw new Error('The workbook XML is damaged.');
  return document;
}
const tags = (parent: Document | Element, name: string) =>
  Array.from(parent.getElementsByTagNameNS('*', name));
export function excelBirthDate(serial: number, date1904 = false): string {
  if (!Number.isInteger(serial) || serial < 1 || serial > 100000 || (!date1904 && serial === 60))
    throw new Error('Use a real birth date in DD-MM-YYYY format.');
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
  return new Date(base + (serial - (!date1904 && serial > 60 ? 1 : 0)) * 86400000)
    .toISOString()
    .slice(0, 10);
}
export async function readStudentWorkbook(file: File): Promise<ExcelCell[][]> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Choose an Excel .xlsx file.');
  const files = await unzip(file),
    workbook = documentXml(files.get('xl/workbook.xml'));
  const sheets = tags(workbook, 'sheet');
  const selected = sheets.find((entry) => entry.getAttribute('name') === 'Students') ?? sheets[0];
  if (!selected) throw new Error('The workbook has no student worksheet.');
  const id = selected.getAttributeNS(
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'id',
  );
  const relations = documentXml(files.get('xl/_rels/workbook.xml.rels'));
  const relation = tags(relations, 'Relationship').find((entry) => entry.getAttribute('Id') === id);
  const target = relation?.getAttribute('Target');
  if (
    !target ||
    relation?.getAttribute('TargetMode') === 'External' ||
    !relation?.getAttribute('Type')?.endsWith('/worksheet') ||
    target.includes('..')
  )
    throw new Error('The student worksheet cannot be read.');
  const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  const source = documentXml(files.get(path));
  const shared = files.has('xl/sharedStrings.xml')
    ? tags(documentXml(files.get('xl/sharedStrings.xml')), 'si').map((entry) =>
        tags(entry, 't')
          .map((part) => part.textContent ?? '')
          .join(''),
      )
    : [];
  const rows: ExcelCell[][] = [];
  for (const row of tags(source, 'row')) {
    const index = Number(row.getAttribute('r')) - 1;
    if (!Number.isInteger(index) || index < 0 || index > 1000)
      throw new Error('Import up to 1,000 students per file, starting below the header row.');
    const values: ExcelCell[] = [];
    for (const cell of tags(row, 'c')) {
      const ref = cell.getAttribute('r') ?? '';
      const letters = ref.match(/^([A-Z]+)\d+$/)?.[1];
      if (!letters) throw new Error('The worksheet contains an invalid cell.');
      const column =
        [...letters].reduce((result, letter) => result * 26 + letter.charCodeAt(0) - 64, 0) - 1;
      if (column >= 30) throw new Error('Use the student sample columns only.');
      if (tags(cell, 'f').length)
        throw new Error(`Row ${index + 1}: replace formulas with plain values before importing.`);
      const raw = tags(cell, 'v')[0]?.textContent ?? '',
        type = cell.getAttribute('t');
      if (type === 'e') throw new Error(`Row ${index + 1} contains an Excel error.`);
      const value =
        type === 's'
          ? shared[Number(raw)]
          : type === 'inlineStr'
            ? tags(cell, 't')
                .map((part) => part.textContent ?? '')
                .join('')
            : raw !== '' && (!type || type === 'n')
              ? Number(raw)
              : raw;
      if (value === undefined || (typeof value === 'number' && !Number.isFinite(value)))
        throw new Error('The worksheet contains an invalid value.');
      values[column] = value;
    }
    rows[index] = values;
  }
  const date1904 = ['1', 'true'].includes(
    tags(workbook, 'workbookPr')[0]?.getAttribute('date1904') ?? '',
  );
  for (const header of ['birth date', 'joined on']) {
    const column = rows[0]?.findIndex((cell) => String(cell).trim().toLowerCase() === header) ?? -1;
    if (column >= 0)
      for (const row of rows)
        if (typeof row?.[column] === 'number')
          row[column] = excelBirthDate(row[column] as number, date1904);
  }
  return Array.from({ length: rows.length }, (_, index) => rows[index] ?? []);
}
export function downloadStudentWorkbook(
  filename: string,
  rows: ExcelCell[][],
  instructions: string[],
  sheetName = 'Students',
) {
  const url = URL.createObjectURL(
      studentWorkbook(
        rows.map((row, index) =>
          index === 0
            ? row
            : row.map((cell, i) => formatExportCell(String(rows[0]?.[i] ?? ''), cell)),
        ),
        instructions,
        sheetName,
      ),
    ),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
