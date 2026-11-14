import { test, expect } from '@playwright/test';
test('campus map and manual coordinates share saved demo settings on desktop and mobile', async ({
  page,
}) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204 }));
  await page.goto('/settings?section=location');
  await page.getByRole('button', { name: 'Add location', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Latitude', { exact: true })).toHaveValue('');
  await dialog.getByLabel('Paste latitude, longitude').fill('91, 73');
  await dialog.getByRole('button', { name: 'Use pasted coordinates' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Latitude must be between');
  await dialog.getByLabel('Paste latitude, longitude').fill('27.9871488, 73.3216768');
  await dialog.getByRole('button', { name: 'Use pasted coordinates' }).click();
  await expect(dialog.getByLabel('Latitude', { exact: true })).toHaveValue('27.9871488');
  await expect(dialog.getByLabel('Longitude', { exact: true })).toHaveValue('73.3216768');
  await dialog.getByRole('button', { name: '200 m', exact: true }).click();
  const map = dialog.getByRole('region', { name: 'School location map' });
  await expect(map.locator('.leaflet-marker-icon')).toBeVisible();
  await map.click({ position: { x: 100, y: 100 } });
  await expect(dialog.getByLabel('Latitude', { exact: true })).not.toHaveValue('27.9871488');
  await dialog.getByLabel('Latitude', { exact: true }).fill('27.9871488');
  await dialog.getByLabel('Longitude', { exact: true }).fill('73.3216768');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByLabel('Longitude', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await dialog.screenshot({ path: '/tmp/school-location-manual-mobile.png' });
  await dialog.getByRole('button', { name: 'Save location', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.school-location-summary')).toContainText('27.9871488, 73.3216768');
  await expect(page.locator('.school-location-summary')).toContainText('200 m allowed radius');
  await page.screenshot({ path: '/tmp/school-location-tab-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(dialog).toContainText('disables location-based teacher punching');
  await dialog.getByRole('button', { name: 'Remove location', exact: true }).click();
  await expect(
    page.getByText('No school location has been saved.', { exact: false }),
  ).toBeVisible();
});
test('current location previews a coarse fix promptly and only refinement waits for precision', async ({
  page,
}) => {
  await page.context().grantPermissions(['geolocation']);
  await page
    .context()
    .setGeolocation({ latitude: 27.9871488, longitude: 73.3216768, accuracy: 3333 });
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 204 }));
  await page.goto('/settings?section=location');
  await page.getByRole('button', { name: 'Add location', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Latitude', { exact: true }).fill('26.9');
  await dialog.getByLabel('Longitude', { exact: true }).fill('75.8');
  await dialog.getByRole('button', { name: 'Use current location', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('campus pin was not moved', {
    timeout: 3000,
  });
  await expect(dialog.getByLabel('Latitude', { exact: true })).toHaveValue('26.9');
  await dialog.getByRole('button', { name: 'Improve accuracy', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Stop locating' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Stop locating' }).click();
  await expect(
    dialog.getByRole('button', { name: 'Use current location', exact: true }),
  ).toBeEnabled();
  await page
    .context()
    .setGeolocation({ latitude: 27.9871488, longitude: 73.3216768, accuracy: 21 });
  await dialog.getByRole('button', { name: 'Use current location', exact: true }).click();
  await expect(dialog.getByLabel('Latitude', { exact: true })).toHaveValue('27.9871488', {
    timeout: 3000,
  });
});
