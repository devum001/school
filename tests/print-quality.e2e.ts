import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('artwork margins, original proportions and 300 DPI document export stay consistent', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.goto('/settings?tab=Templates');
  await expect(page.locator('.brand-mark img')).toHaveCount(0);
  const mark = page.locator('.school-initial');
  await expect(mark.locator('img')).toBeVisible();
  const size = await mark.boundingBox();
  expect(size!.width).toBe(48);
  expect(size!.height).toBe(48);
  await expect(mark).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  const result = await page.evaluate(async () => {
    const { createSeed } = await import('/src/mocks/seed.ts');
    const { feeReceiptFor } = await import('/src/lib/documentData.ts');
    const { documentPdf, documentPng } = await import('/src/lib/documentRendering.ts');
    const { readBrandingImage } = await import('/src/lib/fileUploads.ts');
    const seed = createSeed('2026-10-14');
    const receipt = feeReceiptFor(seed, seed.payments[0]);
    // A padded round logo must remain round; importing must retain useful source pixels.
    const padded = document.createElement('canvas');
    padded.width = 2200;
    padded.height = 1800;
    const c = padded.getContext('2d')!;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, padded.width, padded.height);
    c.fillStyle = '#19494d';
    c.beginPath();
    c.arc(1100, 900, 600, 0, 2 * Math.PI);
    c.fill();
    const blob = await new Promise<Blob>((resolve) =>
      padded.toBlob((value) => resolve(value!), 'image/png'),
    );
    const imported = await readBrandingImage(new File([blob], 'logo.png', { type: 'image/png' }));
    const logo = new Image();
    await new Promise<void>((resolve) => {
      logo.onload = () => resolve();
      logo.src = imported;
    });
    const pdfs: { kind: string; bytes: number[]; preview: string }[] = [];
    for (const kind of ['Fee Receipt', 'Salary Slip'] as const) {
      const data =
        kind === 'Fee Receipt'
          ? receipt
          : {
              ...receipt,
              kind,
              number: 'SAMPLE-SS-001',
              recipientName: 'Sample Staff',
              template: { templateId: 'ledger' as const, accent: '#19494d' },
              fields: [
                { label: 'Staff', value: 'Sample Staff' },
                { label: 'Department', value: 'Academics' },
                { label: 'Designation', value: 'Teacher' },
                { label: 'Salary month', value: 'October 2026' },
                { label: 'Salary', value: '₹38,000' },
                { label: 'Leave deduction', value: '₹0' },
                { label: 'Payment date', value: '14 Oct 2026' },
                { label: 'Payment mode', value: 'Bank' },
              ],
              amountLabel: 'Net salary paid',
              amount: 3800000,
            };
      const bytes = [...new Uint8Array(await (await documentPdf(data)).arrayBuffer())];
      pdfs.push({ kind, bytes, preview: await documentPng(data, 1600) });
    }
    return { width: logo.naturalWidth, height: logo.naturalHeight, pdfs };
  });
  expect(result.width).toBeGreaterThan(1200);
  expect(Math.abs(result.width - result.height)).toBeLessThan(4);
  for (const item of result.pdfs) {
    expect(Buffer.from(item.bytes).toString('latin1')).toContain('/Width 2480 /Height 3507');
    await writeFile(info.outputPath(`${item.kind}.pdf`), Buffer.from(item.bytes));
    await writeFile(
      info.outputPath(`${item.kind}.png`),
      Buffer.from(item.preview.split(',')[1], 'base64'),
    );
  }
  await page.screenshot({ path: info.outputPath('school-identity-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(mark).toHaveCSS('width', '48px');
  await page.screenshot({ path: info.outputPath('school-identity-mobile.png') });
});
