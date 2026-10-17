import { describe, it, expect } from 'vitest';
import { artworkContentBounds, fitArtwork } from './artwork';
import { HEADER_IMPORT_SIZE, documentLayout } from './documentLayout';
import { TEMPLATE_IDS } from './ledgerSchemas';
describe('letterhead artwork fitting', () => {
  it('fits the recommended header to the table width in every receipt and salary design', () => {
    for (const kind of ['Fee Receipt', 'Salary Slip'] as const)
      for (const id of TEMPLATE_IDS) {
        const layout = documentLayout(kind, id);
        const fit = fitArtwork(HEADER_IMPORT_SIZE, layout.header);
        expect(fit.x).toBeCloseTo(layout.fields.x);
        expect(fit.width).toBeCloseTo(layout.fields.width);
        expect(fit.height).toBeLessThanOrEqual(layout.header.height);
        expect(fit.y + fit.height).toBeLessThan(179);
      }
  });
  it('keeps round logos round and wide banners at their original proportions', () => {
    expect(fitArtwork({ width: 100, height: 100 }, { x: 0, y: 0, width: 100, height: 66 })).toEqual(
      { x: 17, y: 0, width: 66, height: 66 },
    );
    const banner = fitArtwork(
      { width: 1100, height: 100 },
      { x: 80, y: 48, width: 1040, height: 120 },
    );
    expect(banner.width / banner.height).toBeCloseTo(11);
    expect(banner.x).toBe(80);
    expect(banner.y).toBeGreaterThan(48);
    expect(banner.y + banner.height).toBeLessThan(168);
  });
  it('removes only outside empty margins and leaves safety pixels around artwork', () => {
    const pixels = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    for (let y = 30; y < 70; y++) for (let x = 20; x < 80; x++) pixels[(y * 100 + x) * 4] = 20;
    expect(artworkContentBounds(pixels, 100, 100)).toEqual({ x: 18, y: 28, width: 64, height: 44 });
    expect(artworkContentBounds(new Uint8ClampedArray(40 * 10 * 4), 40, 10)).toEqual({
      x: 0,
      y: 0,
      width: 40,
      height: 10,
    });
    pixels.fill(255);
    expect(artworkContentBounds(pixels, 100, 100)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});
