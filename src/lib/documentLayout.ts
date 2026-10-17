import type { DocumentKind, TemplateId } from '../types/ledger';
// Twice the standard 1040 × 140 document header, for sharp full-width artwork.
export const HEADER_IMPORT_SIZE = { width: 2080, height: 280 } as const;
export interface DocumentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface DocumentLayout {
  header: DocumentRect;
  identity: DocumentRect;
  title: DocumentRect;
  fields: DocumentRect;
  amount: DocumentRect;
  signature: DocumentRect;
  stamp: DocumentRect;
  footer: DocumentRect;
  mode: 'rows' | 'cards' | 'table';
  centered: boolean;
}
export function documentLayout(kind: DocumentKind, id: TemplateId): DocumentLayout {
  const left = id === 'sidebar' ? 180 : 80,
    width = id === 'sidebar' ? 940 : 1040;
  return {
    header: { x: left, y: 32, width, height: HEADER_IMPORT_SIZE.height / 2 },
    identity: { x: left, y: 190, width, height: 140 },
    title: { x: left, y: 355, width, height: 105 },
    fields: { x: left, y: 470, width, height: 650 },
    amount: { x: left, y: 1150, width, height: 105 },
    signature: { x: id === 'frame' ? 735 : 790, y: 1305, width: 260, height: 140 },
    stamp: { x: 465, y: 1305, width: 180, height: 155 },
    footer: { x: left, y: 1535, width, height: 110 },
    mode:
      id === 'minimal' || (id === 'ribbon' && kind === 'Fee Receipt')
        ? 'cards'
        : id === 'ledger' || id === 'frame'
          ? 'table'
          : 'rows',
    centered: id === 'classic' || id === 'frame',
  };
}
export function rectanglesOverlap(a: DocumentRect, b: DocumentRect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export function paintTemplateBase(c: CanvasRenderingContext2D, kind: DocumentKind, id: TemplateId) {
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, 1200, 1697);
  c.strokeStyle = '#dce5e7';
  c.lineWidth = 1;
  const l = documentLayout(kind, id);
  if (id === 'ledger') {
    c.fillStyle = '#f5f8fa';
    c.fillRect(l.fields.x, l.fields.y, l.fields.width, l.fields.height);
    c.strokeRect(l.fields.x, l.fields.y, l.fields.width, l.fields.height);
  }
  if (id === 'ribbon') {
    c.fillStyle = '#f4f6f8';
    c.fillRect(80, 190, 1040, 140);
  }
  if (id === 'minimal') {
    c.fillStyle = '#f7f9f9';
    c.fillRect(80, 1150, 1040, 105);
  }
  if (id === 'frame') {
    c.strokeStyle = '#dae0dd';
    c.strokeRect(48, 40, 1104, 1617);
  }
  if (id === 'sidebar') {
    c.fillStyle = '#f0f3f4';
    c.fillRect(0, 0, 135, 1697);
  }
  if (kind === 'Salary Slip' && id !== 'minimal') {
    c.fillStyle = '#f7f9fa';
    c.fillRect(l.fields.x, l.fields.y + 265, l.fields.width, 200);
  }
}
export function paintTemplateAccent(
  c: CanvasRenderingContext2D,
  kind: DocumentKind,
  id: TemplateId,
  accent: string,
) {
  const l = documentLayout(kind, id);
  c.fillStyle = accent;
  c.strokeStyle = accent;
  c.lineWidth = 3;
  if (id === 'classic') {
    c.fillRect(0, 0, 1200, 14);
    c.fillRect(l.title.x, l.title.y + 76, l.title.width, 3);
    c.fillRect(0, 1677, 1200, 20);
  }
  if (id === 'ribbon') {
    c.fillRect(l.title.x, l.title.y, l.title.width, 60);
    c.fillRect(0, 0, 1200, 24);
    c.fillRect(80, 1662, 1040, 4);
  }
  if (id === 'ledger') {
    c.fillRect(l.fields.x, l.fields.y - 12, l.fields.width, 8);
    c.fillRect(l.amount.x, l.amount.y, l.amount.width, 105);
    c.fillRect(80, 1662, 1040, 5);
  }
  if (id === 'minimal') {
    c.fillRect(80, 202, 5, 115);
    c.fillRect(80, 1662, 1040, 2);
  }
  if (id === 'frame') {
    c.strokeRect(28, 24, 1144, 1649);
    c.lineWidth = 1;
    c.strokeRect(38, 34, 1124, 1629);
    c.fillRect(l.title.x + 300, l.title.y + 76, l.title.width - 600, 2);
  }
  if (id === 'sidebar') {
    c.fillRect(0, 0, 28, 1697);
    c.fillRect(108, 190, 9, 140);
    c.fillRect(l.amount.x, l.amount.y, l.amount.width, 105);
  }
  if (kind === 'Salary Slip' && id === 'classic') {
    c.fillRect(l.amount.x, l.amount.y, l.amount.width, 4);
  }
}
