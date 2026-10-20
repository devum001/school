import { expect, test } from '@playwright/test';
import { studentWorkbook } from '../src/lib/xlsx';
import { STUDENT_IMPORT_HEADERS } from '../src/lib/studentTemplate';
test('demo import has editable preview and explicit submit; local student can be deleted', async ({
  page,
}) => {
  await page.goto('/settings?tab=Classes%2C+Sections+%26+Grades&classId=class-5&section=students');
  await page.getByRole('tab', { name: 'Students', exact: true }).click();
  await expect(page.getByLabel('Class students section').locator('option')).not.toContainText([
    'No section',
  ]);
  await page.getByRole('button', { name: 'Import Excel (.xlsx)', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import students from Excel', exact: true });
  await expect(dialog.getByLabel('Import steps')).toContainText('File & options');
  await dialog
    .getByLabel('Excel file (.xlsx)')
    .setInputFiles({
      name: 'demo.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(
        await studentWorkbook([
          STUDENT_IMPORT_HEADERS,
          [
            'demo repair student',
            'DEMO-91830',
            'bad-date',
            'Parent',
            'Parent',
            '',
            '',
            'SH-976',
            'A',
            'Class 5',
          ],
        ]).arrayBuffer(),
      ),
    });
  await dialog.getByRole('button', { name: 'Next: preview', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Next: submit', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Edit row 2', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Correct row 2', exact: true });
  await editor.getByLabel('Birth Date', { exact: true }).fill('25-05-2015');
  await editor.getByRole('button', { name: 'Save correction', exact: true }).click();
  await dialog.getByRole('button', { name: 'Next: submit', exact: true }).click();
  await dialog.getByRole('button', { name: 'Import 1 students', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const link = page.getByRole('link', { name: 'Demo Repair Student', exact: true });
  await expect(link).toBeVisible();
  await page.reload();
  await expect(link).toBeVisible();
  await page
    .getByRole('row')
    .filter({ has: link })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(link).toHaveCount(0);
});
