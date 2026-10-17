import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { createSeed } from '../src/mocks/seed';
import { STORAGE_KEY } from '../src/lib/config';
import { saveStaffMember } from '../src/lib/staffStructure';
import { saveStaffAttendance } from '../src/lib/staffAttendance';
import { defaultStaffPayroll } from '../src/lib/settings';
import { saveFeePlan } from '../src/lib/feePlans';
import { roster } from '../src/lib/selectors';
import type { DemoState } from '../src/types/domain';
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-14T06:30:00Z'));
});
function fixture() {
  let state = saveStaffMember(createSeed('2026-10-14'), defaultStaffPayroll, {
    name: 'Branding Staff',
    designation: 'Helper',
    departmentId: 'department-support',
    phone: '',
    email: '',
    status: 'active',
    joinedOn: '2026-04-01',
    salary: { effectiveFrom: '2026-04', basic: 200000, allowance: 0, bonus: 0, deduction: 0 },
  });
  return { state, member: state.staffMembers![0], student: roster(state)[0] };
}
async function load(page: Page, state: DemoState) {
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state },
  );
}
async function audit(page: Page) {
  expect(
    (
      await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    ).violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

test('teacher has one profile, staff controls align and leave department carries into attendance', async ({
  page,
}, info) => {
  const { state: initial, member } = fixture();
  let state = saveStaffAttendance(initial, defaultStaffPayroll, '2026-10-06', {
    [member.id]: 'half-day',
  });
  await load(page, state);
  await page.goto('/teachers/teacher-2');
  await expect(page.locator('.profile-hero')).toHaveCount(0);
  await expect(page.locator('.teacher-overview .avatar')).toHaveCount(1);
  await audit(page);
  await page.goto('/staff?tab=Attendance');
  const date = await page
      .getByRole('heading', { name: 'Staff attendance', exact: true })
      .locator('..')
      .locator('..')
      .boundingBox(),
    button = await page
      .getByRole('button', { name: 'Mark all present', exact: true })
      .boundingBox();
  expect(Math.abs(date!.y + date!.height / 2 - (button!.y + button!.height / 2))).toBeLessThan(3);
  await page.getByRole('tab', { name: 'Leave', exact: true }).click();
  await page.getByLabel('Leave department').selectOption('department-support');
  await expect(
    page.getByRole('region', { name: 'Staff leave counts' }).locator('tbody tr'),
  ).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Staff leave counts' })).toContainText(
    '0.5 leaves',
  );
  const month = await page.getByLabel('Leave cycle month').boundingBox(),
    open = await page
      .getByRole('link', { name: 'Open Staff Attendance', exact: true })
      .boundingBox();
  expect(Math.abs(month!.y + month!.height - open!.y - open!.height)).toBeLessThan(3);
  await page.screenshot({ path: info.outputPath('leave-controls.png'), fullPage: true });
  await page.getByRole('link', { name: 'Open Staff Attendance', exact: true }).click();
  await expect(page).toHaveURL(/department=department-support/);
  await expect(
    page.getByRole('region', { name: 'Staff attendance register' }).locator('tbody tr'),
  ).toHaveCount(1);
});

test('letterhead imports, independent colors, enlarged preview and both branded PDFs work', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const { state, student } = fixture();
  await load(page, state);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/settings?tab=Templates');
  const fixtures = await page.evaluate(() =>
    [
      ['School logo', '#d99000', 100, 100],
      ['Header', '#b32b31', 1100, 100],
      ['Footer', '#174aab', 1100, 70],
      ['Official signature', '#198542', 300, 90],
      ['School stamp', '#a4259a', 150, 150],
    ].map(([label, color, w, h]) => {
      const canvas = document.createElement('canvas');
      canvas.width = Number(w);
      canvas.height = Number(h);
      const c = canvas.getContext('2d')!;
      c.fillStyle = String(color);
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = '#ffffff';
      c.font = '20px Arial';
      c.fillText(String(label), 10, 30);
      return { label: String(label), url: canvas.toDataURL('image/png') };
    }),
  );
  for (const file of fixtures) {
    await page.getByLabel(`Import ${file.label}`, { exact: true }).setInputFiles({
      name: `${file.label}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(file.url.split(',')[1], 'base64'),
    });
    await expect(
      page.getByRole('img', { name: `${file.label} artwork`, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: 'Save templates', exact: true }).click();
  const logo = await page
    .getByRole('img', { name: 'School logo artwork', exact: true })
    .getAttribute('src');
  await expect(page.locator('.brand-mark img')).toHaveCount(0);
  await expect(page.locator('.school-initial img')).toHaveAttribute('src', logo!);
  await page.goto('/settings?tab=General');
  await expect(page.locator('.settings-school-mark img')).toHaveAttribute('src', logo!);
  await page.reload();
  await expect(page.locator('.settings-school-mark img')).toHaveAttribute('src', logo!);
  await page.goto('/settings?tab=Templates');
  await page.getByRole('button', { name: 'Ribbon Fee Receipt template', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Enlarged document preview' }).getByRole('img'),
  ).toBeVisible();
  await page.getByLabel('Template accent color').fill('#13579a');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.template-zoom-controls')).toContainText('125%');
  await audit(page);
  await page.screenshot({ path: info.outputPath('branded-template-preview.png'), fullPage: true });
  await page.getByRole('button', { name: 'Use this template', exact: true }).click();
  await page.getByRole('button', { name: 'Classic Fee Receipt template', exact: true }).click();
  await page.getByLabel('Template accent color').fill('#6f3c91');
  await page.getByRole('button', { name: 'Use this template', exact: true }).click();
  await page.getByRole('button', { name: 'Ribbon Fee Receipt template', exact: true }).click();
  await expect(page.getByLabel('Template accent color')).toHaveValue('#13579a');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('tab', { name: 'Salary Slip', exact: true }).click();
  await page.getByRole('button', { name: 'Side Accent Salary Slip template', exact: true }).click();
  await page.getByLabel('Template accent color').fill('#275833');
  await page.getByRole('button', { name: 'Use this template', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByRole('img', { name: 'Header artwork', exact: true })).toBeVisible();
  await page.goto(`/students/${student.student.id}?tab=fees`);
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await page.getByLabel('Payment amount').fill('1000');
  await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Download Fee Receipt', exact: true }),
  ).toBeEnabled();
  const [fee] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Fee Receipt', exact: true }).click(),
  ]);
  await fee.saveAs(info.outputPath('branded-fee-receipt.pdf'));
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.goto('/fees?tab=Salary+Expenses');
  await page
    .getByRole('button', { name: 'Record Salary Payment Branding Staff', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm Payment', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Download Salary Slip', exact: true }),
  ).toBeEnabled();
  const [salary] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Salary Slip', exact: true }).click(),
  ]);
  await salary.saveAs(info.outputPath('branded-salary-slip.pdf'));
  const pdfBytes = await readFile(info.outputPath('branded-salary-slip.pdf'));
  const imageStart = pdfBytes.indexOf(Buffer.from([0xff, 0xd8]));
  const imageEnd = pdfBytes.indexOf(Buffer.from([0xff, 0xd9]), imageStart) + 2;
  expect(imageStart).toBeGreaterThan(0);
  const downloadedPixels = await page.evaluate(
    async (jpeg) => {
      const bitmap = await createImageBitmap(
        new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }),
      );
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1697;
      const c = canvas.getContext('2d')!;
      c.drawImage(bitmap, 0, 0, 1200, 1697);
      return {
        signature: [...c.getImageData(950, 1390, 1, 1).data],
        stamp: [...c.getImageData(555, 1380, 1, 1).data],
      };
    },
    [...pdfBytes.subarray(imageStart, imageEnd)],
  );
  for (const [actual, expected] of [
    [downloadedPixels.signature, [25, 133, 66]],
    [downloadedPixels.stamp, [164, 37, 154]],
  ]) {
    expected.forEach((channel, i) => expect(Math.abs(actual[i] - channel)).toBeLessThanOrEqual(3));
  }
  const saved = await page.evaluate(async () => {
    const { repository } = await import('/src/lib/repository.ts');
    return repository.getSnapshot();
  });
  expect(saved.documentTemplates.feeReceipt.colors.ribbon).toBe('#13579a');
  expect(saved.documentTemplates.feeReceipt.colors.classic).toBe('#6f3c91');
  expect(saved.documentTemplates.salarySlip.colors.sidebar).toBe('#275833');
  expect(saved.payments.at(-1).document).not.toHaveProperty('branding');
  expect(saved.documentTemplates.branding.footer).toBeTruthy();
  expect(saved.documentTemplates.branding.signature).toBeTruthy();
  expect(saved.documentTemplates.branding.stamp).toBeTruthy();
  await info.attach('salary-document-data', {
    body: JSON.stringify(saved.salaryPayments[0].document),
    contentType: 'application/json',
  });
  const pixels = await page.evaluate(async (data) => {
    const { renderDocumentCanvas } = await import('/src/lib/documentRendering.ts');
    const { repository } = await import('/src/lib/repository.ts');
    const { documentWithBranding } = await import('/src/lib/documentData.ts');
    const canvas = await renderDocumentCanvas(
        documentWithBranding(repository.getSnapshot(), data),
        1200,
      ),
      c = canvas.getContext('2d')!;
    return {
      signature: [...c.getImageData(950, 1390, 1, 1).data],
      stamp: [...c.getImageData(555, 1380, 1, 1).data],
    };
  }, saved.salaryPayments[0].document);
  expect(pixels.signature.slice(0, 3)).toEqual([25, 133, 66]);
  expect(pixels.stamp.slice(0, 3)).toEqual([164, 37, 154]);
  const artworkEdges = await page.evaluate(async (data) => {
    const { renderDocumentCanvas } = await import('/src/lib/documentRendering.ts');
    const { documentLayout } = await import('/src/lib/documentLayout.ts');
    const { repository } = await import('/src/lib/repository.ts');
    const { documentWithBranding } = await import('/src/lib/documentData.ts');
    const current = documentWithBranding(repository.getSnapshot(), data);
    const edges = [];
    for (const kind of ['Fee Receipt', 'Salary Slip'] as const) {
      for (const templateId of [
        'classic',
        'ribbon',
        'ledger',
        'minimal',
        'frame',
        'sidebar',
      ] as const) {
        const canvas = await renderDocumentCanvas(
          { ...current, kind, template: { templateId, accent: '#19494d' } },
          1200,
        );
        const c = canvas.getContext('2d')!,
          layout = documentLayout(kind, templateId);
        for (const box of [layout.header, layout.footer]) {
          edges.push([...c.getImageData(box.x + 2, box.y + box.height / 2, 1, 1).data].slice(0, 3));
          edges.push(
            [...c.getImageData(box.x + box.width - 3, box.y + box.height / 2, 1, 1).data].slice(
              0,
              3,
            ),
          );
        }
      }
    }
    return edges;
  }, saved.salaryPayments[0].document);
  artworkEdges.forEach((edge, i) =>
    expect(edge).toEqual(i % 4 < 2 ? [179, 43, 49] : [23, 74, 171]),
  );
  expect(errors).toEqual([]);
});

test('finance stays connected to student payments and salary expenses without counting pending amounts as revenue', async ({
  page,
}, info) => {
  const { state: initial, student } = fixture();
  const state = saveFeePlan({ ...initial, payments: [], obligations: [] }, student.enrollment.id, {
    kind: 'One Time',
    totalFee: 1000000,
    installments: [{ amount: 1000000, dueDate: '2026-10-18' }],
  });
  await load(page, state);
  await page.goto('/fees');
  await expect(page.getByRole('heading', { name: 'Finance', exact: true })).toBeVisible();
  await expect(page.getByLabel('Finance period')).toHaveValue('year');
  await expect(page.getByRole('link', { name: 'Finance', exact: true })).toBeVisible();
  await expect(
    page.locator('.finance-summary').filter({ hasText: 'Student Fee Collections' }),
  ).toContainText('₹0');
  await page.getByRole('tab', { name: 'Student Fees', exact: true }).click();
  await page.getByPlaceholder('Search student or admission number…').fill(student.student.name);
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await page.getByLabel('Payment amount').fill('5000');
  await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('tab', { name: 'Salary Expenses', exact: true }).click();
  await page
    .getByRole('button', { name: 'Record Salary Payment Branding Staff', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm Payment', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await expect(
    page.locator('.finance-summary .stat-card').filter({ hasText: 'Student Fee Collections' }),
  ).toContainText('₹5,000');
  await expect(
    page.locator('.finance-summary .stat-card').filter({ hasText: 'Salary Expenses' }),
  ).toContainText('₹2,000');
  await expect(
    page.locator('.finance-summary .stat-card').filter({ hasText: 'Net Revenue' }),
  ).toContainText('₹3,000');
  await page.getByLabel('Finance period').selectOption('cycle');
  await expect(page.getByLabel('Finance cycle month')).toBeVisible();
  await page.getByLabel('Finance cycle month').fill('2026-09');
  await expect(
    page.locator('.finance-summary .stat-card').filter({ hasText: 'Net Revenue' }),
  ).toContainText('₹0');
  await page.getByLabel('Finance period').selectOption('year');
  await expect(
    page.locator('.finance-summary .stat-card').filter({ hasText: 'Net Revenue' }),
  ).toContainText('₹3,000');
  await page.getByRole('tab', { name: 'Transactions', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Finance transactions' }).locator('tbody tr'),
  ).toHaveCount(2);
  await page.getByLabel('Transaction type').selectOption('Salary Payment');
  await expect(page.getByRole('region', { name: 'Finance transactions' })).toContainText(
    'Branding Staff',
  );
  await page.reload();
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await expect(
    page.locator('.finance-summary .stat-card').filter({ hasText: 'Net Revenue' }),
  ).toContainText('₹3,000');
  await page.screenshot({ path: info.outputPath('finance-overview.png'), fullPage: true });
  await page.goto('/staff');
  await expect(page.getByRole('tablist', { name: 'Staff & HR' }).getByRole('tab')).toHaveText([
    'All Staff',
    'Attendance',
    'Leave',
  ]);
  await page.goto('/staff?tab=Salary&month=2026-10&department=department-support');
  await expect(page).toHaveURL(/\/fees\?.*tab=Salary\+Expenses/);
  await expect(page.getByLabel('Department filter')).toHaveValue('department-support');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Finance Overview', exact: true })).toHaveCount(0);
});

test('finance, template preview and staff filters fit mobile and have accessible controls', async ({
  page,
}, info) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      '/teachers/teacher-2',
      '/staff?tab=Attendance',
      '/staff?tab=Leave',
      '/fees',
      '/fees?tab=Student+Fees',
      '/fees?tab=Salary+Expenses',
      '/fees?tab=Transactions',
      '/settings?tab=Templates',
    ]) {
      await page.goto(route);
      await audit(page);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        route,
      ).toBe(true);
      if (route.includes('Templates')) {
        await page
          .getByRole('button', { name: 'Minimal Fee Receipt template', exact: true })
          .click();
        await expect(
          page.getByRole('region', { name: 'Enlarged document preview' }).getByRole('img'),
        ).toBeVisible();
        await audit(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
      await page.screenshot({
        path: info.outputPath(`${width}-${route.replace(/[^a-zA-Z0-9]/g, '_')}.png`),
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});
