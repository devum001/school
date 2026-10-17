import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('recommended header dimensions survive import and match table edges in all twelve layouts', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto('/settings?tab=Templates');
  const card = page
    .locator('.branding-asset')
    .filter({ has: page.getByText('Header', { exact: true }) });
  await expect(card).toContainText('Recommended size: 2080 × 280 px');
  const header = await page.evaluate(async () => {
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = 2080;
    canvas.height = 280;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 2080, 280);
    // White top/bottom spacing belongs to the design and must not be auto-trimmed.
    c.fillStyle = '#19494d';
    c.fillRect(0, 20, 2080, 240);
    c.fillStyle = '#e6c777';
    c.fillRect(0, 252, 2080, 8);
    c.fillStyle = '#ffffff';
    c.font = '600 65px Arial';
    c.fillText('VIDYA NIKETAN PUBLIC SCHOOL', 100, 117);
    c.font = '30px Arial';
    c.fillText('Education, care and progress', 102, 180);
    return canvas.toDataURL('image/png');
  });
  await page
    .getByLabel('Import Header', { exact: true })
    .setInputFiles({
      name: 'header-2080x280.png',
      mimeType: 'image/png',
      buffer: Buffer.from(header.split(',')[1], 'base64'),
    });
  await expect(page.getByRole('button', { name: 'Save templates', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save templates', exact: true }).click();
  await page.reload();
  await expect(card).toContainText('2080 × 280 px');
  const imported = await page
    .getByRole('img', { name: 'Header artwork', exact: true })
    .getAttribute('src');
  expect(imported).toBe(header);
  const output = await page.evaluate(async (header) => {
    const { repository } = await import('/src/lib/repository.ts');
    const { feeReceiptFor } = await import('/src/lib/documentData.ts');
    const { renderDocumentCanvas, documentPdf, documentPng } =
      await import('/src/lib/documentRendering.ts');
    const { documentLayout } = await import('/src/lib/documentLayout.ts');
    const { TEMPLATE_IDS } = await import('/src/lib/ledgerSchemas.ts');
    const state = repository.getSnapshot();
    const base = feeReceiptFor(state, state.payments[0]);
    const results: {
      kind: string;
      id: string;
      left: number[];
      right: number[];
      outside: number[];
    }[] = [];
    const documents: { kind: string; bytes: number[]; png: string }[] = [];
    for (const kind of ['Fee Receipt', 'Salary Slip'] as const) {
      const data = {
        ...base,
        kind,
        branding: { ...base.branding, header },
        ...(kind === 'Salary Slip'
          ? {
              recipientName: 'Neha Sharma',
              fields: [
                { label: 'Staff', value: 'Neha Sharma' },
                { label: 'Department', value: 'Academics' },
                { label: 'Designation', value: 'Teacher' },
                { label: 'Salary month', value: 'October 2026' },
                { label: 'Salary', value: '₹38,000' },
                { label: 'Leave deduction', value: '₹1,267' },
                { label: 'Payment mode', value: 'Bank' },
                { label: 'Payment date', value: '15 Oct 2026' },
              ],
              amount: 3673300,
              amountLabel: 'Net salary paid',
            }
          : {}),
      };
      for (const id of TEMPLATE_IDS) {
        const documentData = { ...data, template: { templateId: id, accent: '#19494d' } };
        const canvas = await renderDocumentCanvas(documentData, 1200);
        const c = canvas.getContext('2d')!;
        const layout = documentLayout(kind, id),
          y = layout.header.y + layout.header.height / 2;
        results.push({
          kind,
          id,
          left: [...c.getImageData(layout.fields.x, y, 1, 1).data],
          right: [...c.getImageData(layout.fields.x + layout.fields.width - 1, y, 1, 1).data],
          outside: [...c.getImageData(layout.fields.x - 1, y, 1, 1).data],
        });
        if (id === 'ledger')
          documents.push({
            kind,
            bytes: [...new Uint8Array(await (await documentPdf(documentData)).arrayBuffer())],
            png: await documentPng(documentData, 1600),
          });
      }
    }
    return { results, documents };
  }, imported!);
  for (const result of output.results) {
    expect(result.left, `${result.kind}/${result.id} left`).toEqual([25, 73, 77, 255]);
    expect(result.right, `${result.kind}/${result.id} right`).toEqual([25, 73, 77, 255]);
    expect(result.outside, `${result.kind}/${result.id} margin`).toEqual([255, 255, 255, 255]);
  }
  for (const document of output.documents) {
    await writeFile(info.outputPath(`${document.kind}.pdf`), Buffer.from(document.bytes));
    await writeFile(
      info.outputPath(`${document.kind}.png`),
      Buffer.from(document.png.split(',')[1], 'base64'),
    );
  }
});
