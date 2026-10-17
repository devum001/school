import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T06:30:00Z'));
});
const settings = '/settings?tab=Communication';
test('plain templates persist and attendance alerts wait for Overview review', async ({ page }) => {
  await page.goto(settings);
  for (const name of ['Channels', 'Message Templates'])
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText('Default Recipients', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Student Absent template', exact: true }).click();
  await page
    .getByLabel('Message Template', { exact: true })
    .fill('आपका बच्चा आज अनुपस्थित है। कृपया स्कूल से संपर्क करें।');
  await page.getByRole('button', { name: 'Save template', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Edit Student Absent template', exact: true }).click();
  await expect(page.getByLabel('Message Template', { exact: true })).toHaveValue(
    'आपका बच्चा आज अनुपस्थित है। कृपया स्कूल से संपर्क करें।',
  );
  await expect(page.getByText('Notification Rules', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Variables:', { exact: false })).toHaveCount(0);
  await expect(page.getByLabel('Automatic Send', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/attendance');
  await page
    .getByRole('group', { name: 'Ananya Sharma attendance', exact: true })
    .getByRole('button', { name: 'Absent', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save attendance', exact: true }).click();
  await page.getByRole('link', { name: 'Review notifications', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page
    .getByLabel('Select Ananya Sharma Student WhatsApp Student Absent', { exact: true })
    .check();
  await page.getByRole('button', { name: 'Review & Send', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('आपका बच्चा आज अनुपस्थित है।');
  await page.getByRole('button', { name: 'Confirm demo send', exact: true }).click();
  await page.getByLabel('Type', { exact: true }).selectOption('Student Absent');
  await page.getByLabel('Channel', { exact: true }).selectOption('WhatsApp');
  await page.getByLabel('Class', { exact: true }).selectOption('class-5');
  const history = page.getByRole('region', { name: 'Notification history', exact: true });
  await expect(history.getByRole('row').filter({ hasText: 'Ananya Sharma' })).toContainText(
    'Delivered',
  );
  await page.goto('/attendance');
  await page
    .getByRole('group', { name: 'Aarav Sharma attendance', exact: true })
    .getByRole('button', { name: 'Absent', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save attendance', exact: true }).click();
  await page.goto('/notifications');
  await page.locator('.communication-stat').filter({ hasText: 'Student Absent alerts' }).click();
  await expect(page.getByLabel('Notification type', { exact: true })).toHaveValue('Student Absent');
  await page.getByLabel('Class', { exact: true }).selectOption('class-5');
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('region', { name: 'Notification queue', exact: true })).toContainText(
    'Aarav Sharma',
  );
});
test('manual notice audiences, preview, scheduled delivery and cancellation work without external requests', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:5175')) external.push(request.url());
  });
  await page.goto('/notifications?tab=Send+Notice');
  await page.getByLabel('Notice title').fill('Diwali break');
  await page.getByLabel('Audience', { exact: true }).selectOption('Class');
  await page.getByLabel('Grade 5', { exact: true }).check();
  await expect(page.getByLabel('Students', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Parents', { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel('Audience', { exact: true }).locator('option[value=Parents]'),
  ).toHaveCount(0);
  await expect(page.getByLabel('WhatsApp', { exact: true })).toBeChecked();
  await expect(page.getByLabel('In-app', { exact: true })).toBeDisabled();
  await page
    .getByLabel('Message', { exact: true })
    .fill('प्रिय अभिभावक, Diwali holiday will be observed this week.');
  await page.getByRole('button', { name: 'Preview notice', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Diwali holiday will be observed');
  await expect(page.getByRole('dialog')).not.toContainText('{student_name}');
  await page.getByRole('button', { name: 'Send demo notice', exact: true }).click();
  await page.getByRole('button', { name: 'Open History', exact: true }).click();
  await page.getByLabel('Type', { exact: true }).selectOption('Compose Notice');
  await page.getByLabel('Class', { exact: true }).selectOption('class-5');
  await expect(
    page.getByRole('region', { name: 'Notification history', exact: true }),
  ).toContainText('Diwali break');
  await page.getByRole('tab', { name: 'Compose Notice', exact: true }).click();
  await page.getByLabel('Audience', { exact: true }).selectOption('Teachers');
  await page.getByLabel('Notice title').fill('Scheduled holiday briefing');
  await page.getByLabel('WhatsApp', { exact: true }).uncheck();
  await page.getByLabel('In-app', { exact: true }).check();
  await page.getByLabel('Delivery', { exact: true }).selectOption('Schedule');
  await page.getByLabel('Schedule date and time').fill('2026-10-14T09:00');
  await page.getByRole('button', { name: 'Preview notice', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm schedule', exact: true }).click();
  await page.getByRole('button', { name: 'Open History', exact: true }).click();
  await page.getByLabel('Status', { exact: true }).selectOption('Scheduled');
  await page
    .getByRole('button', { name: /^Cancel schedule/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await page.getByLabel('Status', { exact: true }).selectOption('Cancelled');
  await expect(
    page.getByRole('region', { name: 'Notification history', exact: true }),
  ).toContainText('Scheduled holiday briefing');
  await page.clock.setFixedTime(new Date('2026-10-14T03:31:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByLabel('Status', { exact: true }).selectOption('Delivered');
  await page.getByLabel('Date', { exact: true }).fill('2026-10-14');
  await expect(
    page.getByRole('region', { name: 'Notification history', exact: true }),
  ).toContainText('Scheduled holiday briefing');
  expect(external).toEqual([]);
});
test('overview shows current event types and failed history can be retried', async ({ page }) => {
  await page.goto('/notifications');
  await expect(page.getByRole('tab')).toHaveText(['Overview', 'Compose Notice', 'History']);
  await expect(
    page.locator('.communication-stat').filter({ hasText: 'Fee Installments Due' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish test notice', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await page.getByLabel('Type', { exact: true }).selectOption('Compose Notice');
  await page.getByLabel('Status', { exact: true }).selectOption('Failed');
  await page.getByRole('button', { name: 'Retry notification demo-failed-0', exact: true }).click();
  await page.getByLabel('Status', { exact: true }).selectOption('Delivered');
  await expect(
    page.getByRole('region', { name: 'Notification history', exact: true }),
  ).toContainText('School office update');
});
test('notification tabs, settings drawer and notice composer fit desktop and mobile with accessible controls', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const tab of ['Overview', 'Compose Notice', 'History']) {
      await page.goto(`/notifications?tab=${encodeURIComponent(tab)}`);
      await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await page.screenshot({ path: info.outputPath(`${tab}-${width}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
    }
    await page.goto(settings);
    await expect(page.getByRole('heading', { name: 'Channels', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`settings-${width}.png`) });
    await page.getByRole('button', { name: 'Edit Student Absent template', exact: true }).click();
    await page.screenshot({ path: info.outputPath(`drawer-${width}.png`) });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test('teachers and staff can be sent notices as all or selected members', async ({ page }) => {
  for (const audience of ['Teachers', 'Staff']) {
    await page.goto('/notifications?tab=Send+Notice');
    await page.getByLabel('Audience', { exact: true }).selectOption(audience);
    await expect(page.getByLabel('Selection', { exact: true })).toHaveValue('All');
    await page.getByLabel('Selection', { exact: true }).selectOption('Selected');
    await page.getByLabel('Search members', { exact: true }).fill('Aditya');
    const member = page.locator('.communication-student-options').getByRole('checkbox').first();
    await expect(member).toBeVisible();
    await member.check();
    await page.getByLabel('WhatsApp', { exact: true }).uncheck();
    await page.getByLabel('In-app', { exact: true }).check();
    await page.getByLabel('Message', { exact: true }).fill('कल बैठक है। Class {A} की सूचना।');
    await page.getByRole('button', { name: 'Preview notice', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('1 recipients');
    await expect(page.getByRole('dialog')).toContainText('Class {A}');
    await page.getByRole('button', { name: 'Send demo notice', exact: true }).click();
    await page.getByRole('button', { name: 'Open History', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Notification history', exact: true }),
    ).toContainText('Aditya Sethi');
  }
});
