import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('test participation excludes absences and a saved absence opens the correct parent notice', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-11T06:30:00Z'));
  await page.goto('/academics');
  await page.getByLabel('Results section').selectOption('class-5-a');
  await page
    .getByRole('button', { name: 'View results for Mathematics · Daily practice', exact: true })
    .click();
  await page.getByRole('button', { name: 'Enter / edit marks' }).click();
  await page.getByLabel('Aarav Sharma absent', { exact: true }).check();
  await page.getByLabel('Ananya Sharma absent', { exact: true }).check();
  await page.getByLabel('Vihaan Sharma Mathematics marks', { exact: true }).fill('');
  await expect(page.getByRole('dialog')).toContainText('9 took test · 2 absent · 1 pending');
  await page.getByRole('button', { name: 'Save marks', exact: true }).click();
  const tracker = page.locator('.test-absence-panel');
  await expect(tracker.locator('tbody tr')).toHaveCount(2);
  await expect(tracker.locator('tbody tr').nth(0)).toContainText('Aarav Sharma');
  await expect(tracker.locator('tbody tr').nth(1)).toContainText('Ananya Sharma');
  await expect(page.locator('.stat-card').filter({ hasText: 'Took test' })).toContainText('9 / 12');
  const results = page.locator('.academic-results:not(.test-absence-panel)');
  await expect(
    results.getByRole('row').filter({ hasText: 'Aarav Sharma' }).locator('td').first(),
  ).toHaveText('—');
  await expect(page.locator('.leader-grid')).not.toContainText('Aarav Sharma');
  await tracker.getByRole('button', { name: 'Notify parent of Aarav Sharma', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Notify parent about test absence');
  await expect(dialog.locator('.report-message-preview')).toContainText('अनुपस्थित');
  await expect(dialog.locator('.report-message-preview')).toContainText('11 अक्टूबर 2026');
  const link = new URL(
    (await dialog.getByRole('link', { name: 'Choose contact in WhatsApp' }).getAttribute('href'))!,
  );
  expect(link.origin).toBe('https://wa.me');
  expect(link.searchParams.get('text')).toContain('Aarav Sharma');
  expect(link.searchParams.get('text')).toContain('Mathematics · Daily practice');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Enter / edit marks' }).click();
  await page.getByLabel('Vihaan Sharma Mathematics marks', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Save marks', exact: true }).click();
  await page.getByRole('button', { name: 'All tests', exact: true }).click();
  const testRow = page
    .locator('.tests-history-table')
    .getByRole('row')
    .filter({ hasText: 'Mathematics · Daily practice' });
  await expect(testRow).toContainText('10 / 12 took test');
  await expect(testRow).toContainText('2 absent');
  await expect(testRow).toContainText('0 pending');
  await expect(testRow).toContainText('Complete');
  await page.reload();
  await page.getByLabel('Results section').selectOption('class-5-a');
  await expect(testRow).toContainText('10 / 12 took test');
  await page
    .getByRole('button', {
      name: 'View 2 absent students for Mathematics · Daily practice',
      exact: true,
    })
    .click();
  await expect(tracker.locator('tbody tr')).toHaveCount(2);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/schoolwell-test-absences.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Enter / edit marks' }).click();
  await page.getByLabel('Aarav Sharma absent', { exact: true }).uncheck();
  await page.getByLabel('Aarav Sharma Mathematics marks', { exact: true }).fill('18');
  await page.getByRole('button', { name: 'Save marks', exact: true }).click();
  await expect(tracker.locator('tbody tr')).toHaveCount(1);
  await expect(tracker).not.toContainText('Aarav Sharma');
  await expect(page.locator('.stat-card').filter({ hasText: 'Took test' })).toContainText(
    '11 / 12',
  );
});
