import { imageArtworkBounds } from './artwork';
import type { BrandingAsset, StoredDocument } from '../types/ledger';
import { validFileSignature } from './entityDocuments';
const documentTypes: StoredDocument['mimeType'][] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];
export function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Unable to read file.'));
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}
export async function readDocumentFile(file: File) {
  const mimeType = documentTypes.find((type) => type === file.type);
  if (!mimeType || !file.size || file.size > 2 * 1024 * 1024)
    throw new Error('Choose a PDF, PNG, JPEG or WebP file up to 2 MB.');
  const dataUrl = await readFileDataUrl(file);
  if (!validFileSignature(mimeType, dataUrl.split(',')[1]))
    throw new Error('The file content does not match its document type.');
  return { mimeType, dataUrl, size: file.size, fileName: file.name.slice(0, 200) };
}
export async function readProfileImage(file: File): Promise<string> {
  if (
    !file.type.startsWith('image/') ||
    !documentTypes.some((type) => type === file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error('Choose a PNG, JPEG or WebP image up to 5 MB.');
  const source = await readFileDataUrl(file);
  if (!validFileSignature(file.type as StoredDocument['mimeType'], source.split(',')[1]))
    throw new Error('Choose a valid image file.');
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to open image.'));
    image.src = source;
  });
  const canvas = document.createElement('canvas'),
    scale = Math.min(1, 400 / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to process image.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
export function downloadStoredDocument(dataUrl: string, fileName: string) {
  const [header, base64] = dataUrl.split(','),
    binary = atob(base64),
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const blob = new Blob([bytes], { type: header.slice(5).split(';')[0] }),
    url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function readBrandingImage(file: File, asset?: BrandingAsset): Promise<string> {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    !file.size ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error('Choose a PNG, JPEG or WebP image up to 5 MB.');
  const source = await readFileDataUrl(file);
  if (!validFileSignature(file.type as StoredDocument['mimeType'], source.split(',')[1]))
    throw new Error('Choose a valid image file.');
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to open image.'));
    image.src = source;
  });
  const crop = imageArtworkBounds(image, asset === 'header');
  let scale = Math.min(1, 2480 / Math.max(crop.width, crop.height));
  // Keep already suitable originals; do not degrade them on every import.
  if (
    scale === 1 &&
    source.length <= 700000 &&
    crop.width === image.naturalWidth &&
    crop.height === image.naturalHeight
  )
    return source;
  for (let attempt = 0; attempt < 5; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(crop.width * scale));
    canvas.height = Math.max(1, Math.round(crop.height * scale));
    const c = canvas.getContext('2d');
    if (!c) throw new Error('Image processing is unavailable.');
    c.imageSmoothingQuality = 'high';
    c.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    const output = canvas.toDataURL('image/png');
    if (output.length <= 700000) return output;
    scale *= 0.75;
  }
  throw new Error('Choose a smaller image.');
}
