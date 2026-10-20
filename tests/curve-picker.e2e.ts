import { test, expect, type Page, type Locator } from '@playwright/test';
import { createSeed } from '../src/mocks/seed';
import { STORAGE_KEY } from '../src/lib/config';
import { encodeSchoolStorage } from '../src/lib/schoolStorage';
import AxeBuilder from '@axe-core/playwright';

type PickerLog = { type: string; opened: boolean; activated: boolean };
type PickerWindow = Window & { pickerLog: PickerLog[] };
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-18T06:30:00Z'));
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
      const original = HTMLInputElement.prototype.showPicker;
      const log: PickerLog[] = [];
      (window as PickerWindow).pickerLog = log;
      HTMLInputElement.prototype.showPicker = function () {
        const record = {
          type: this.type,
          opened: false,
          activated: navigator.userActivation.isActive,
        };
        log.push(record);
        original.call(this);
        record.opened = true;
      };
    },
    { key: STORAGE_KEY, value: encodeSchoolStorage(createSeed('2026-10-18')) },
  );
});
async function logs(page: Page) {
  return page.evaluate(() => (window as PickerWindow).pickerLog);
}
async function openAt(page: Page, field: Locator, part: 'left' | 'center' | 'right' = 'center') {
  await expect(field).toBeVisible();
  const before = (await logs(page)).length;
  const box = await field.boundingBox();
  if (!box) throw new Error('Missing picker field');
  await field.click({
    position: {
      x: part === 'left' ? 8 : part === 'right' ? box.width - 15 : box.width / 2,
      y: box.height / 2,
    },
  });
  await expect.poll(async () => (await logs(page)).length).toBe(before + 1);
  expect((await logs(page)).at(-1)).toMatchObject({ opened: true, activated: true });
  await page.keyboard.press('Escape');
}

test('recent-results month opens across its whole field and still filters results', async ({
  page,
}, info) => {
  await page.goto('/academics?class=class-5&view=results&resultsView=recent&section=class-5-a');
  const month = page.getByLabel('Results month', { exact: true });
  await expect(month).toHaveValue('2026-10');
  for (const part of ['left', 'center', 'right'] as const) await openAt(page, month, part);
  const before = (await logs(page)).length;
  await month.focus();
  await month.press('Enter');
  await expect.poll(async () => (await logs(page)).length).toBe(before + 1);
  await page.keyboard.press('Escape');
  await month.fill('2026-09');
  await expect(page).toHaveURL(/month=2026-09/);
  await expect(month).toHaveValue('2026-09');
  await expect(page.getByLabel('Recent results section')).toHaveValue('class-5-a');
  await page.reload();
  await expect(month).toHaveValue('2026-09');
  const tabs = await page.getByRole('navigation', { name: 'Result views' }).boundingBox();
  const heading = await page
    .getByRole('heading', { name: 'Recent Results', exact: true })
    .boundingBox();
  expect(tabs && heading && heading.y - tabs.y - tabs.height).toBeLessThan(70);
  await page.screenshot({ path: info.outputPath('academics-curves-desktop.png'), fullPage: true });
});

test('calendar fields work on dashboard, attendance, enrollment, time dialog and scheduled notice', async ({
  page,
}) => {
  await page.goto('/');
  await openAt(page, page.getByLabel('Dashboard date'), 'left');
  await page.getByLabel('Dashboard date').fill('2026-10-17');
  await expect(page.getByRole('link', { name: 'Mark attendance' })).toHaveAttribute(
    'href',
    /date=2026-10-17/,
  );
  await page.goto('/attendance');
  await openAt(page, page.locator('main .calendar-date-control input[type="text"]').first());
  await page.goto('/students/new');
  await openAt(
    page,
    page.locator('main .calendar-date-control input[type="text"]').first(),
    'left',
  );
  await page.goto('/settings?section=timing');
  await page.getByRole('button', { name: 'Edit Timing', exact: true }).click();
  await openAt(page, page.getByRole('dialog').locator('input[type="time"]').first());
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.goto('/notifications?tab=Compose+Notice');
  await page.getByLabel('Delivery', { exact: true }).selectOption('Schedule');
  await openAt(page, page.getByLabel('Schedule date and time'));
});

test('native fields preserve typing, readonly/disabled safeguards and unsupported-browser fallback', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/picker-fields.html');
  for (const name of ['Date', 'Month', 'Time', 'Schedule'])
    await openAt(page, page.getByLabel(name, { exact: true }));
  const date = page.getByLabel('Date', { exact: true });
  await date.focus();
  await date.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Form submits')).toHaveText('0');
  const before = (await logs(page)).length;
  await page.getByLabel('Read only', { exact: true }).click();
  await page.getByLabel('Custom action', { exact: true }).click();
  await expect(page.getByLabel('Disabled', { exact: true })).toBeDisabled();
  expect((await logs(page)).length).toBe(before);
  await page.evaluate(() =>
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      value: undefined,
      configurable: true,
      writable: true,
    }),
  );
  await date.click();
  await page.keyboard.press('Escape');
  await date.fill('2026-09-12');
  await expect(page.getByLabel('Current date')).toHaveText('2026-09-12');
  await page.evaluate(() =>
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      value: () => {
        throw new DOMException('Blocked in this context', 'NotAllowedError');
      },
      configurable: true,
      writable: true,
    }),
  );
  await date.click();
  await date.fill('2026-09-13');
  await expect(page.getByLabel('Current date')).toHaveText('2026-09-13');
});

test('surfaces use restrained shared curves; whole search field focuses; mobile has no overflow', async ({
  page,
}, info) => {
  await page.goto('/staff');
  await page.locator('.global-search-field img, .global-search-field svg').click();
  await expect(page.getByLabel('Search the student directory')).toBeFocused();
  const searchBox = page.locator('main .search-input');
  const search = searchBox.locator('input');
  await searchBox.locator('img, svg').click();
  await expect(search).toBeFocused();
  await search.fill('Aditya');
  await expect(page.locator('main tbody tr')).toHaveCount(1);
  await expect(page.locator('main .panel').first()).toHaveCSS('border-radius', '14px');
  await expect(searchBox).toHaveCSS('border-radius', '10px');
  await expect(page.getByRole('button', { name: 'Add Staff', exact: true })).toHaveCSS(
    'border-radius',
    '10px',
  );
  await expect(page.getByRole('tab', { name: 'All Staff', exact: true })).toHaveCSS(
    'border-radius',
    '24px',
  );
  await page.getByRole('button', { name: 'Add Staff', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCSS('border-radius', '18px');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.goto('/settings');
  await expect(page.locator('main .panel').first()).toHaveCSS('border-radius', '14px');
  for (const url of [
    '/',
    '/staff',
    '/fees',
    '/academics?class=class-5&view=results&resultsView=recent&section=class-5-a',
    '/settings',
    '/students/new',
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url);
    await expect(page.locator('main h1')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.goto('/academics?class=class-5&view=results&resultsView=recent&section=class-5-a');
  await expect(page.getByLabel('Results month')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent Results', exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('academics-curves-mobile.png'), fullPage: true });
});
