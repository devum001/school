import { imageArtworkBounds, fitArtwork } from './artwork';
import type { GeneratedDocument, TemplateId } from '../types/ledger';
import { money } from './config';
import {
  documentLayout,
  paintTemplateBase,
  paintTemplateAccent,
  type DocumentRect,
} from './documentLayout';
export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  classic: 'Classic',
  ribbon: 'Ribbon',
  ledger: 'Ledger',
  minimal: 'Minimal',
  frame: 'Formal Frame',
  sidebar: 'Side Accent',
};
const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const loading = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Document image could not be loaded.'));
    image.src = src;
  });
  if (imageCache.size >= 24) imageCache.delete(imageCache.keys().next().value!);
  imageCache.set(src, loading);
  loading.catch(() => imageCache.delete(src));
  return loading;
}
function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight = 28,
  maxLines = 2,
) {
  const words = text.split(/\s+/).flatMap((word) => {
      const chunks: string[] = [];
      let chunk = '';
      for (const character of word) {
        if (context.measureText(chunk + character).width > width && chunk) {
          chunks.push(chunk);
          chunk = '';
        }
        chunk += character;
      }
      if (chunk) chunks.push(chunk);
      return chunks;
    }),
    lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > width && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((value, index) => {
    let fitted = value;
    while (context.measureText(fitted).width > width && fitted.length > 1)
      fitted = fitted.slice(0, -1);
    if (fitted !== value || (index === maxLines - 1 && lines.length > maxLines))
      fitted = `${fitted.slice(0, -2)}…`;
    context.fillText(fitted, x, y + index * lineHeight);
  });
}
export async function renderDocumentCanvas(documentData: GeneratedDocument, width = 1600) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round((width * 1697) / 1200);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Document rendering is unavailable.');
  context.scale(width / 1200, width / 1200);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const background = await loadImage(
    `/document-templates/${documentData.kind === 'Fee Receipt' ? 'fee' : 'salary'}-${documentData.template.templateId}.png`,
  );
  context.drawImage(background, 0, 0, 1200, 1697);
  const id = documentData.template.templateId,
    layout = documentLayout(documentData.kind, id),
    hex = documentData.template.accent;
  paintTemplateAccent(context, documentData.kind, id, hex);
  const light =
    parseInt(hex.slice(1, 3), 16) * 0.299 +
      parseInt(hex.slice(3, 5), 16) * 0.587 +
      parseInt(hex.slice(5, 7), 16) * 0.114 >
    160;
  const ink = light ? '#173b42' : hex,
    contrast = light ? '#173b42' : '#ffffff';
  const drawAsset = async (
    src: string | null | undefined,
    box: DocumentRect,
    preserveCanvas = false,
  ) => {
    if (!src) return;
    const image = await loadImage(src);
    const crop = imageArtworkBounds(image, preserveCanvas);
    const fitted = fitArtwork(crop, box);
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      fitted.x,
      fitted.y,
      fitted.width,
      fitted.height,
    );
  };
  await drawAsset(documentData.branding?.header, layout.header, true);
  const logo = documentData.branding?.logo ?? documentData.schoolLogo;
  if (layout.centered) {
    await drawAsset(logo, { x: 556, y: 179, width: 88, height: 88 });
    context.fillStyle = ink;
    context.textAlign = 'center';
    context.font = '600 32px Inter, Arial, sans-serif';
    wrapText(context, documentData.schoolName, 600, logo ? 307 : 258, 1000, 36, 2);
    context.textAlign = 'left';
  } else {
    await drawAsset(logo, { x: layout.identity.x + 16, y: 204, width: 105, height: 105 });
    context.fillStyle = ink;
    context.font = '600 32px Inter, Arial, sans-serif';
    const x = layout.identity.x + (logo ? 145 : 20);
    wrapText(
      context,
      documentData.schoolName,
      x,
      257,
      layout.identity.width - (logo ? 165 : 40),
      37,
      2,
    );
  }
  context.fillStyle = id === 'ribbon' ? contrast : ink;
  context.font = '600 30px Inter, Arial, sans-serif';
  if (layout.centered) context.textAlign = 'center';
  context.fillText(
    documentData.kind.toUpperCase(),
    layout.centered ? 600 : layout.title.x + 18,
    layout.title.y + 41,
  );
  context.textAlign = 'left';
  context.fillStyle = '#52686b';
  context.font = '19px Inter, Arial, sans-serif';
  wrapText(
    context,
    `No. ${documentData.number}`,
    layout.title.x + 18,
    layout.title.y + 95,
    layout.title.width - 36,
    22,
    1,
  );
  const { fields } = layout,
    count = documentData.fields.length;
  if (layout.mode === 'cards') {
    const rows = Math.ceil(count / 2),
      height = Math.min(110, fields.height / Math.max(1, rows));
    documentData.fields.forEach((field, i) => {
      const x = fields.x + (i % 2) * (fields.width / 2) + 20,
        y = fields.y + Math.floor(i / 2) * height;
      context.fillStyle = '#52686b';
      context.font = '18px Inter, Arial, sans-serif';
      context.fillText(field.label, x, y + 25);
      context.fillStyle = '#173b42';
      context.font = '500 22px Inter, Arial, sans-serif';
      const valueWidth = fields.width / 2 - 55;
      const fitted = Math.max(
        10,
        Math.min(22, (22 * valueWidth * 1.8) / Math.max(1, context.measureText(field.value).width)),
      );
      context.font = `500 ${fitted}px Inter, Arial, sans-serif`;
      wrapText(context, field.value, x, y + 57, valueWidth, 25, 2);
      context.strokeStyle = '#dce5e7';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, y + height - 10);
      context.lineTo(x + fields.width / 2 - 50, y + height - 10);
      context.stroke();
    });
  } else {
    const height = Math.min(67, fields.height / Math.max(1, count));
    documentData.fields.forEach((field, i) => {
      const y = fields.y + i * height;
      if (layout.mode === 'table') {
        context.fillStyle = i % 2 ? '#ffffff' : '#f5f8fa';
        context.fillRect(fields.x + 1, y, fields.width - 2, height);
      }
      context.fillStyle = '#52686b';
      context.font = '18px Inter, Arial, sans-serif';
      context.fillText(field.label, fields.x + 20, y + 25);
      context.font = '500 22px Inter, Arial, sans-serif';
      const valueWidth = fields.width * 0.62 - 45;
      const font = Math.max(
        13,
        Math.min(
          22,
          (22 * valueWidth * 1.85) / Math.max(1, context.measureText(field.value).width),
        ),
      );
      context.font = `500 ${font}px Inter, Arial, sans-serif`;
      context.fillStyle = '#173b42';
      wrapText(context, field.value, fields.x + fields.width * 0.38, y + 25, valueWidth, 23, 2);
      context.strokeStyle = '#dce5e7';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(fields.x, y + height);
      context.lineTo(fields.x + fields.width, y + height);
      context.stroke();
    });
  }
  const darkAmount = id === 'ledger' || id === 'sidebar';
  context.fillStyle = darkAmount ? contrast : '#52686b';
  context.font = '21px Inter, Arial, sans-serif';
  context.fillText(documentData.amountLabel, layout.amount.x + 24, layout.amount.y + 35);
  context.fillStyle = darkAmount ? contrast : ink;
  context.font = '600 43px Inter, Arial, sans-serif';
  context.textAlign = 'right';
  context.fillText(
    money(documentData.amount),
    layout.amount.x + layout.amount.width - 24,
    layout.amount.y + 78,
  );
  context.textAlign = 'left';
  await drawAsset(documentData.branding?.signature, layout.signature);
  await drawAsset(documentData.branding?.stamp, layout.stamp);
  context.strokeStyle = '#bdcacc';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(layout.signature.x, 1469);
  context.lineTo(layout.signature.x + layout.signature.width, 1469);
  context.stroke();
  context.fillStyle = '#52686b';
  context.font = '18px Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText('Authorized Signatory', layout.signature.x + layout.signature.width / 2, 1494);
  if (documentData.branding?.stamp)
    context.fillText('School Stamp', layout.stamp.x + layout.stamp.width / 2, 1494);
  context.textAlign = 'left';
  if (documentData.branding?.footer) await drawAsset(documentData.branding.footer, layout.footer);
  else {
    context.fillStyle = '#52686b';
    context.font = '17px Inter, Arial, sans-serif';
    wrapText(
      context,
      'Generated from the recorded payment. Please retain for your records.',
      layout.footer.x + 18,
      layout.footer.y + 54,
      layout.footer.width - 36,
      22,
      2,
    );
  }
  return canvas;
}
export async function documentPng(data: GeneratedDocument, width = 1600) {
  return (await renderDocumentCanvas(data, width)).toDataURL('image/png');
}
export async function documentPdf(data: GeneratedDocument): Promise<Blob> {
  const canvas = await renderDocumentCanvas(data, 2480);
  const jpeg = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Unable to create PDF.'))),
      'image/jpeg',
      0.99,
    ),
  );
  const image = new Uint8Array(await jpeg.arrayBuffer()),
    encoder = new TextEncoder(),
    chunks: Uint8Array[] = [],
    offsets: number[] = [0];
  let offset = 0;
  const push = (value: string | Uint8Array) => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const object = (id: number, body: string) => {
    offsets[id] = offset;
    push(`${id} 0 obj\n${body}\nendobj\n`);
  };
  push('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(
    3,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Img 4 0 R >> >> /Contents 5 0 R >>',
  );
  offsets[4] = offset;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`,
  );
  push(image);
  push('\nendstream\nendobj\n');
  const content = 'q\n595 0 0 842 0 0 cm\n/Img Do\nQ';
  object(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
  const xref = offset;
  push('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const bytes = new Uint8Array(offset);
  let position = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, position);
    position += chunk.length;
  }
  return new Blob([bytes], { type: 'application/pdf' });
}
export async function downloadDocumentPdf(data: GeneratedDocument) {
  const blob = await documentPdf(data),
    url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${data.kind.replaceAll(' ', '-')}-${data.number.replace(/[^A-Za-z0-9-]/g, '_')}.pdf`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function printGeneratedDocument(data: GeneratedDocument) {
  const popup = window.open('', '_blank', 'width=900,height=1000');
  if (!popup) throw new Error('Allow the print window to open, then try again.');
  try {
    const png = await documentPng(data, 2480);
    popup.document.title = `${data.kind} ${data.number}`;
    const style = popup.document.createElement('style');
    style.textContent =
      '@page{size:A4;margin:0}body{margin:0}img{display:block;width:210mm;height:297mm;object-fit:contain}';
    popup.document.head.append(style);
    const image = popup.document.createElement('img');
    image.alt = data.kind;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to prepare print.'));
      image.src = png;
      popup.document.body.append(image);
    });
    popup.focus();
    popup.print();
  } catch (cause) {
    popup.close();
    throw cause;
  }
}

export function templateBackdrop(kind: GeneratedDocument['kind'], id: TemplateId, accent: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1697;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas unavailable');
  paintTemplateBase(c, kind, id);
  paintTemplateAccent(c, kind, id, accent);
  return canvas.toDataURL('image/png');
}
