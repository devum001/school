import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('student history stays readable and parent sharing prepares the right Hindi report', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-11T06:30:00Z'));
  await page.goto('/students/stu-121?tab=academics');
  const history = page.locator('.student-history-panel');
  await expect(history.locator('.student-exam-row')).toHaveCount(5);
  await history.getByRole('button', { name: /Pre-board I/ }).click();
  await expect(history.getByRole('button', { name: /Pre-board I/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.student-results-panel tfoot')).toContainText('200');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(0, 0);
  await page.screenshot({ path: '/tmp/schoolwell-student-history.png', fullPage: true });
  await page.getByRole('button', { name: 'Share on WhatsApp', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Aarav Nair');
  await expect(dialog.locator('.report-message-preview')).toContainText('आदरणीय अभिभावक');
  await expect(dialog.locator('.report-message-preview')).toContainText('Pre-board I');
  await expect(dialog.locator('.report-message-preview')).toContainText('149 / 200');
  const picker = dialog.getByRole('link', { name: 'Choose contact in WhatsApp' });
  const pickerUrl = new URL((await picker.getAttribute('href'))!);
  expect(pickerUrl.origin).toBe('https://wa.me');
  expect(pickerUrl.pathname).toBe('/');
  expect(pickerUrl.searchParams.get('text')).toContain('Aarav Nair');
  const phone = dialog.getByLabel('Parent’s WhatsApp number (optional)', { exact: true });
  await phone.fill('PARENT-121');
  await expect(dialog.getByRole('alert')).toContainText('10-digit Indian mobile');
  await expect(dialog.getByRole('button', { name: 'Open WhatsApp', exact: true })).toBeDisabled();
  await phone.fill('98765 43210');
  const parentLink = dialog.getByRole('link', { name: 'Open parent chat' });
  expect(new URL((await parentLink.getAttribute('href'))!).pathname).toBe('/919876543210');
  await expect(parentLink).toHaveAttribute('target', '_blank');
  await dialog.getByLabel('Report content', { exact: true }).selectOption('all');
  await expect(dialog.locator('.report-message-preview')).toContainText('Unit Assessment I');
  await expect(dialog.locator('.report-message-preview')).toContainText('समग्र परिणाम');
  const audit = async () =>
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  await audit();
  await page.screenshot({ path: '/tmp/schoolwell-whatsapp-report.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await audit();
  await page.screenshot({ path: '/tmp/schoolwell-student-history-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  // Inspect URLs only: no WhatsApp navigation or message delivery during automated checks.
});
