import { test, expect } from '@playwright/test';

test('shared calendar fields show day-first dates, reject invalid dates and preserve ISO form values', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/picker-fields.html');
  const date = page.getByLabel('Date', { exact: true });
  await expect(date).toHaveValue('18-10-2026');
  await date.fill('29-02-2024');
  await expect(page.getByLabel('Current date')).toHaveText('2024-02-29');
  expect(await date.evaluate((node: HTMLInputElement) => node.checkValidity())).toBe(true);
  await date.fill('31-02-2024');
  expect(await date.evaluate((node: HTMLInputElement) => node.checkValidity())).toBe(false);
  await date.fill('12-01-2020');
  expect(await date.evaluate((node: HTMLInputElement) => node.checkValidity())).toBe(true);
  await expect(date).toHaveValue('12-01-2020');
  const schedule = page.getByLabel('Schedule', { exact: true });
  await expect(schedule).toHaveValue('18-10-2026 09:15');
  await schedule.fill('29-02-2024 14:30');
  expect(await schedule.evaluate((node: HTMLInputElement) => node.checkValidity())).toBe(true);
  await schedule.fill('29-02-2024 25:30');
  expect(await schedule.evaluate((node: HTMLInputElement) => node.checkValidity())).toBe(false);
});
