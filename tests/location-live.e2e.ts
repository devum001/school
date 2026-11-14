import { test, expect, type Page } from '@playwright/test';
const api = 'http://127.0.0.1:3107/api/v1';
async function request<T>(page: Page, path: string, method = 'GET', body?: unknown): Promise<T> {
  const result = await page.evaluate(
    async ({ api, path, method, body }) => {
      const csrf =
        method === 'GET'
          ? null
          : await (await fetch(`${api}/auth/csrf`, { credentials: 'include' })).json();
      const res = await fetch(api + path, {
        method,
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf.data.csrfToken } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: res.status, payload: await res.json() };
    },
    { api, path, method, body },
  );
  expect(result.status, JSON.stringify(result.payload.error)).toBeLessThan(300);
  return result.payload.data as T;
}
async function login(
  page: Page,
  email = 'browser-owner@example.test',
  password = 'Browser fixture passphrase 2026!',
) {
  await page.goto('/settings');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
}
test('location accuracy improves before punching and coarse setup does not move the campus pin', async ({
  page,
  browser,
}) => {
  test.setTimeout(150000);
  page.setDefaultTimeout(30000);
  await page.context().grantPermissions(['geolocation']);
  await page
    .context()
    .setGeolocation({ latitude: 27.9871488, longitude: 73.3216768, accuracy: 3333 });
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204 }));
  await login(page);
  const session = await request<{ memberships: { schoolId: string }[] }>(page, '/auth/session');
  const root = `/schools/${session.memberships[0].schoolId}`;
  const directory = await request<{ date: string }>(page, `${root}/staff-directory`);
  const data = await request<{ settings: Record<string, unknown> }>(
    page,
    `${root}/hr/workspace?month=${directory.date.slice(0, 7)}`,
  );
  await request(page, `${root}/hr/settings`, 'PUT', {
    ...Object.fromEntries(
      Object.entries(data.settings).filter(([key]) => !['id', 'schoolId'].includes(key)),
    ),
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    maxAccuracy: 50,
    locations: [{ name: 'School campus', latitude: 26.9, longitude: 75.8, radius: 100 }],
  });
  await page.goto('/settings?section=location');
  await page.getByRole('button', { name: 'Edit location' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Use current location', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('campus pin was not moved', {
    timeout: 30000,
  });
  await expect(dialog.getByLabel('Latitude', { exact: true })).toHaveValue('26.9');
  await expect(dialog.getByLabel('Longitude', { exact: true })).toHaveValue('75.8');
  await page.screenshot({ path: '/tmp/campus-inaccurate-fix.png', fullPage: true });
  await page
    .context()
    .setGeolocation({ latitude: 27.9871488, longitude: 73.3216768, accuracy: 21 });
  await dialog.getByRole('button', { name: 'Use current location', exact: true }).click();
  await expect(dialog.getByLabel('Latitude', { exact: true })).toHaveValue('27.9871488');
  await dialog.getByRole('button', { name: 'Save location', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.school-location-summary')).toContainText('27.9871488, 73.3216768');
  await page.getByRole('button', { name: 'Edit location' }).click();
  await dialog
    .getByLabel('Paste latitude, longitude', { exact: true })
    .fill('27.9871488, 73.3216768');
  await dialog.getByRole('button', { name: 'Use pasted coordinates' }).click();
  await dialog.getByRole('button', { name: '200 m', exact: true }).click();
  await expect(dialog.locator('.leaflet-marker-icon')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Save location', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.school-location-summary')).toContainText('200 m allowed radius');
  let testPunches = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().endsWith('/hr/punch')) testPunches++;
  });
  await page.getByRole('button', { name: 'Test current location' }).click();
  await expect(page.locator('.school-location-test')).toContainText('Within school area');
  expect(testPunches).toBe(0);
  const savedPolicy = await request<{ maxAccuracy: number; locations: { radius: number }[] }>(
    page,
    `${root}/hr/locations`,
  );
  expect(savedPolicy.locations[0].radius).toBe(200);
  expect(savedPolicy.maxAccuracy).toBe(50);
  const role = await request<{ id: string }>(page, `${root}/roles`, 'POST', {
    name: 'Location test teacher',
    permissions: ['attendance.self', 'teaching.self'],
  });
  const staff = await request<{ id: string }>(page, `${root}/people/staff`, 'POST', {
    cells: ['GPS-1', 'Location Teacher', 'Yes', 'Academics', 'Teacher', '', '', '2020-01-01', ''],
  });
  await request(page, `${root}/hr/staff/${staff.id}/login`, 'POST', {
    email: 'gps@example.test',
    password: 'Location fixture passphrase 2026!',
    roleId: role.id,
  });
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 27.9871488, longitude: 73.3216768, accuracy: 3333 },
  });
  const teacher = await context.newPage();
  teacher.setDefaultTimeout(30000);
  await login(teacher, 'gps@example.test', 'Location fixture passphrase 2026!');
  await teacher.goto('/staff/punch');
  const card = teacher.getByRole('region', { name: 'School location check' });
  await expect(card).toContainText('Location not checked');
  await expect(card).not.toContainText('Within school area');
  let punches = 0;
  teacher.on('request', (req) => {
    if (req.method() === 'POST' && req.url().endsWith('/hr/punch')) punches++;
  });
  await teacher.getByRole('button', { name: 'Punch in', exact: true }).click();
  await expect(card).toContainText('Accuracy too low', { timeout: 30000 });
  await expect(card).not.toContainText('Outside school area');
  expect(punches).toBe(0);
  await expect(teacher.getByRole('alert')).toContainText('3333 m');
  await expect(teacher.getByRole('alert')).not.toContainText('Location is turned off');
  await teacher.setViewportSize({ width: 390, height: 844 });
  await card.screenshot({ path: '/tmp/punch-accuracy-card-mobile.png' });
  expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await teacher.getByRole('button', { name: 'Punch in', exact: true }).click();
  await expect(card).toContainText('Finding precise location');
  await context.setGeolocation({ latitude: 27.9871488, longitude: 73.3216768, accuracy: 3333 });
  await expect(card).toContainText('Refining your location');
  await context.setGeolocation({ latitude: 27.9871488, longitude: 73.3216768, accuracy: 21 });
  await expect(teacher.getByRole('button', { name: 'Punch out', exact: true })).toBeEnabled();
  expect(punches).toBe(1);
  await expect(card).toContainText('Within school area');
  await card.screenshot({ path: '/tmp/punch-accurate-card-mobile.png' });
  await context.setGeolocation({ latitude: 28.99, longitude: 73.3216768, accuracy: 10 });
  await teacher.getByRole('button', { name: 'Punch out', exact: true }).click();
  await expect(card).toContainText('Outside school area');
  expect(punches).toBe(1);
  await context.close();
});
