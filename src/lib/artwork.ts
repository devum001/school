import type { DocumentRect } from './documentLayout';

// Trim only empty white/transparent outside margins. Artwork itself is never cropped.
export function artworkContentBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): DocumentRect {
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] > 16 && (pixels[i] < 250 || pixels[i + 1] < 250 || pixels[i + 2] < 250)) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  if (right < left) return { x: 0, y: 0, width, height };
  // A small safety edge preserves anti-aliasing at the artwork boundary.
  left = Math.max(0, left - 2);
  top = Math.max(0, top - 2);
  right = Math.min(width - 1, right + 2);
  bottom = Math.min(height - 1, bottom + 2);
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
const boundsCache = new WeakMap<HTMLImageElement, DocumentRect>();
export function imageArtworkBounds(image: HTMLImageElement, preserveCanvas = false): DocumentRect {
  if (preserveCanvas) return { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
  const cached = boundsCache.get(image);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Image processing is unavailable.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const sample = artworkContentBounds(
    context.getImageData(0, 0, canvas.width, canvas.height).data,
    canvas.width,
    canvas.height,
  );
  const bounds = {
    x: (sample.x / canvas.width) * image.naturalWidth,
    y: (sample.y / canvas.height) * image.naturalHeight,
    width: (sample.width / canvas.width) * image.naturalWidth,
    height: (sample.height / canvas.height) * image.naturalHeight,
  };
  boundsCache.set(image, bounds);
  return bounds;
}
export function fitArtwork(
  source: Pick<DocumentRect, 'width' | 'height'>,
  box: DocumentRect,
): DocumentRect {
  const scale = Math.min(box.width / source.width, box.height / source.height);
  const width = source.width * scale,
    height = source.height * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}
