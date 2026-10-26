import { test, expect, type Page, type Request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const api = 'http://127.0.0.1:3107/api/v1';
async function login(page: Page) {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Sign in to your school' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByLabel('Email', { exact: true }).fill('browser-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
}
test('real cookie login, CSRF rotation, restoration, profile, and logout work across origins', async ({
  page,
  context,
}) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.name));
  const requests: Request[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith(api) && request.method() === 'POST') requests.push(request);
  });
  await login(page);
  await expect(page.getByRole('button', { name: 'Edit Details' })).toBeEnabled();
  await expect(page.getByText('Not configured', { exact: true }).first()).toBeVisible();
  expect(
    (await context.cookies(api)).find((cookie) => cookie.name === 'school_refresh')?.httpOnly,
  ).toBe(true);
  await page.reload();
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  const profile = await page.request.get(
    `${api}/schools/${await page.getByLabel('Select school').inputValue()}/profile`,
  );
  expect(profile.status()).toBe(200);
  expect(JSON.stringify(await profile.json())).not.toMatch(
    /passwordHash|tokenHash|authorizationVersion/,
  );
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your school' })).toBeVisible();
  expect(requests).toHaveLength(2);
  const headers = await Promise.all(requests.map((request) => request.allHeaders()));
  expect(
    headers.every((item) => item['x-csrf-token'] && item.origin === 'http://127.0.0.1:5176'),
  ).toBe(true);
  expect(headers[0]['x-csrf-token']).not.toBe(headers[1]['x-csrf-token']);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in to your school' })).toBeVisible();
  expect(failures).toEqual([]);
});
test('profile failure is retryable and never falls back to demo data', async ({ page }) => {
  let fail = true;
  await page.route(`${api}/schools/*/profile`, async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        json: {
          status: 503,
          data: null,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'private-secret' },
        },
      });
    else await route.continue();
  });
  await page.goto('/settings');
  await page.getByLabel('Email', { exact: true }).fill('browser-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'School profile unavailable' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Willowbrook');
  await expect(page.locator('body')).not.toContainText('private-secret');
  fail = false;
  await page.getByRole('button', { name: 'Retry school profile' }).click();
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    accessibility.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    })),
  ).toEqual([]);
});
test('expired sessions clear protected content, unavailable modules stay separate, and no demo state is touched', async ({
  page,
  context,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('schoolwell-demo-v1', 'sentinel-demo-unchanged'),
  );
  await login(page);
  await page.goto('/finance');
  await expect(
    page.getByRole('heading', { name: 'This module is not connected yet' }),
  ).toBeVisible();
  await expect(page.getByText('Willowbrook', { exact: false })).toHaveCount(0);
  await context.clearCookies();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Sign in to your school' })).toBeVisible();
  await expect(page.locator('.settings-profile')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('schoolwell-demo-v1'))).toBe(
    'sentinel-demo-unchanged',
  );
});
test('school switching cancels old results and forbidden profiles remain protected', async ({
  page,
}) => {
  await login(page);
  const first = await page.getByLabel('Select school').inputValue();
  const options = await page
    .getByLabel('Select school')
    .locator('option')
    .evaluateAll((items) => items.map((item) => (item as HTMLOptionElement).value));
  const second = options.find((value) => value !== first)!;
  await page.route(`${api}/schools/${second}/profile`, (route) =>
    route.fulfill({
      status: 403,
      json: { status: 403, data: null, error: { code: 'FORBIDDEN', message: 'secret' } },
    }),
  );
  await page.getByLabel('Select school').selectOption(second);
  await expect(page.locator('.settings-profile h2')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'School profile unavailable' })).toBeVisible();
  await page.getByLabel('Select school').selectOption(first);
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
});

test('a late response from a previous school cannot replace the selected profile', async ({
  page,
}) => {
  await login(page);
  const first = await page.getByLabel('Select school').inputValue();
  const second = await page
    .getByLabel('Select school')
    .locator('option')
    .nth(1)
    .getAttribute('value');
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route(`${api}/schools/${second}/profile`, async (route) => {
    await gate;
    await route
      .fulfill({
        json: {
          status: 200,
          error: null,
          data: {
            school: {
              id: second,
              name: 'Late foreign response',
              slug: 'late',
              code: null,
              phone: null,
              email: null,
              timezone: 'UTC',
              status: 'active',
            },
            academicYear: null,
            setupRequired: true,
          },
        },
      })
      .catch(() => undefined);
  });
  await page.getByLabel('Select school').selectOption(second!);
  await expect(page.getByText('Loading school profile…')).toBeVisible();
  await page.getByLabel('Select school').selectOption(first);
  release();
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
  await expect(page.locator('body')).not.toContainText('Late foreign response');
});

test('an authenticated account without memberships receives a setup state', async ({ page }) => {
  await page.route(`${api}/auth/session`, (route) =>
    route.fulfill({
      json: {
        status: 200,
        error: null,
        data: {
          user: { id: 'test-user', name: 'No school user', email: 'empty@example.test' },
          expiresAt: '2030-01-01T00:00:00.000Z',
          memberships: [],
        },
      },
    }),
  );
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'School setup required' })).toBeVisible();
  await expect(page.locator('.settings-profile')).toHaveCount(0);
});

test('real roles, memberships, permission enforcement, activity and all-device logout', async ({
  page,
  browser,
}) => {
  await login(page);
  const schoolId = await page.getByLabel('Select school').inputValue();
  const secondSchoolId = await page
    .getByLabel('Select school')
    .locator('option')
    .nth(1)
    .getAttribute('value');
  await page.getByRole('tab', { name: 'Roles & Permissions', exact: true }).click();
  await page.getByRole('tab', { name: 'Roles', exact: true }).click();
  await page.getByRole('button', { name: 'Create role', exact: true }).click();
  await page.getByLabel('Role name').fill('Browser Read Only');
  await page.getByLabel('View school profile', { exact: true }).check();
  await page.getByLabel('View roles', { exact: true }).check();
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Browser Read Only' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Browser Read Only', exact: true }).click();
  await page.getByLabel('Role name').fill('Browser Reader');
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Browser Reader' })).toBeVisible();
  await page.getByRole('tab', { name: 'Roles & Permissions', exact: true }).click();
  await page.getByRole('tab', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Account email').fill('browser-member@example.test');
  await page.getByLabel('Assigned role').selectOption({ label: 'Browser Reader' });
  await page.getByRole('button', { name: 'Save membership', exact: true }).click();
  const memberRow = page.getByRole('row').filter({ hasText: 'browser-member@example.test' });
  await expect(memberRow).toContainText('Active');
  const response = await page.request.get(`${api}/schools/${schoolId}/memberships`);
  expect(response.status()).toBe(200);
  const text = await response.text();
  expect(text).toContain('Browser Member');
  expect(text).not.toMatch(/passwordHash|tokenHash|authorizationVersion/);
  // Use another real browser session to verify server authorization and immediate suspension.
  const memberContext = await browser.newContext();
  try {
    const member = await memberContext.newPage();
    await member.goto('http://127.0.0.1:5176/settings');
    await member.getByLabel('Email', { exact: true }).fill('browser-member@example.test');
    await member.getByLabel('Password', { exact: true }).fill('Browser member passphrase 2026!');
    await member.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(member.locator('.settings-profile h2')).toHaveText('Browser Test School');
    await member.getByRole('tab', { name: 'Roles & Permissions', exact: true }).click();
    await member.getByRole('tab', { name: 'Roles', exact: true }).click();
    await expect(member.getByRole('row').filter({ hasText: 'Browser Reader' })).toBeVisible();
    await expect(member.getByRole('button', { name: 'Create role', exact: true })).toHaveCount(0);
    await expect(member.getByRole('tab', { name: 'Members', exact: true })).toHaveCount(0);
    await expect(member.getByRole('tab', { name: 'Activity', exact: true })).toHaveCount(0);
    await member.goto('http://127.0.0.1:5176/settings?tab=Members');
    await expect(member.getByRole('row').filter({ hasText: 'Browser Reader' })).toBeVisible();
    await expect(member.getByRole('tab', { name: 'Members', exact: true })).toHaveCount(0);
    expect((await member.request.get(`${api}/schools/${schoolId}/memberships`)).status()).toBe(403);
    expect((await member.request.get(`${api}/schools/${secondSchoolId}/roles`)).status()).toBe(404);
    await memberRow.getByRole('button', { name: 'Suspend Browser Member', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm suspension' }).click();
    await expect(memberRow).toContainText('Suspended');
    expect((await member.request.get(`${api}/schools/${schoolId}/profile`)).status()).toBe(404);
    await memberRow.getByRole('button', { name: 'Edit Browser Member', exact: true }).click();
    await page.getByLabel('Membership status').selectOption('active');
    await page.getByRole('button', { name: 'Save membership', exact: true }).click();
    await expect(memberRow).toContainText('Active');
    expect((await member.request.get(`${api}/schools/${schoolId}/profile`)).status()).toBe(200);
  } finally {
    await memberContext.close();
  }
  // The backend refuses to suspend the last owner; the UI retains the confirmation and explains it.
  await page.getByRole('button', { name: 'Suspend Browser Owner', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm suspension' }).click();
  await expect(page.getByRole('alert')).toContainText('Assign another active owner');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('tab', { name: 'Roles & Permissions', exact: true }).click();
  await page.getByRole('tab', { name: 'Roles', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Browser Reader', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(page.getByRole('alert')).toContainText('still assigned');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Create role', exact: true }).click();
  await page.getByLabel('Role name').fill('Temporary role');
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Temporary role', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Temporary role' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Data & Security', exact: true }).click();
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Role deleted' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Member added' })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    accessibility.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    })),
  ).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Select school').selectOption(secondSchoolId!);
  await page.getByRole('tab', { name: 'Roles & Permissions', exact: true }).click();
  await page.getByRole('tab', { name: 'Members', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Browser Owner' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Browser Member');
  await page.getByRole('tab', { name: 'Data & Security', exact: true }).click();
  await page.getByRole('tab', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out all devices', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out everywhere' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your school' })).toBeVisible();
  expect((await page.request.get(`${api}/auth/session`)).status()).toBe(401);
});

test('Super Admin manages registrations and accounts through the website without tenant access', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('browser-super-admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser super admin passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Platform administration', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'School settings', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create school', exact: true }).click();
  await page.getByLabel('School name', { exact: true }).fill('Platform Browser School');
  await page.getByLabel('School slug', { exact: true }).fill('platform-browser-school');
  await page.getByLabel('Account name', { exact: true }).fill('Platform School Owner');
  await page
    .getByLabel('Account email', { exact: true })
    .fill('platform-browser-owner@example.test');
  await page
    .getByLabel('Initial password', { exact: true })
    .fill('Platform browser owner passphrase!');
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('Platform browser owner passphrase!');
  await page.getByRole('button', { name: 'Create school and owner', exact: true }).click();
  const schoolRow = page.getByRole('row').filter({ hasText: 'platform-browser-school' });
  await expect(schoolRow).toContainText('Active');
  const schools = await (await page.request.get(`${api}/platform/schools`)).json();
  const schoolId = schools.data.items.find(
    (item: { slug: string }) => item.slug === 'platform-browser-school',
  ).id;
  expect((await page.request.get(`${api}/schools/${schoolId}/profile`)).status()).toBe(404);
  const ownerContext = await browser.newContext();
  try {
    const owner = await ownerContext.newPage();
    await owner.goto('http://127.0.0.1:5176/');
    await owner.getByLabel('Email', { exact: true }).fill('platform-browser-owner@example.test');
    await owner.getByLabel('Password', { exact: true }).fill('Platform browser owner passphrase!');
    await owner.getByRole('button', { name: 'Sign in', exact: true }).click();
    // The shared product router keeps / as Overview; open the original settings route.
    await expect(owner.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    await owner.getByRole('link', { name: 'School settings', exact: true }).click();
    await expect(owner.locator('.settings-profile h2')).toHaveText('Platform Browser School');
    await owner.goto('http://127.0.0.1:5176/platform');
    await expect(owner).toHaveURL(/\/settings$/);
    await expect(owner.locator('.settings-profile h2')).toHaveText('Platform Browser School');
    await expect(owner.getByRole('link', { name: 'Super Admin', exact: true })).toHaveCount(0);
    expect((await owner.request.get(`${api}/platform/users`)).status()).toBe(403);
    await schoolRow
      .getByRole('button', { name: 'Suspend Platform Browser School', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirm change', exact: true }).click();
    await expect(schoolRow).toContainText('Suspended');
    expect((await owner.request.get(`${api}/schools/${schoolId}/profile`)).status()).toBe(404);
    await schoolRow
      .getByRole('button', { name: 'Restore Platform Browser School', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirm change', exact: true }).click();
    await expect(schoolRow).toContainText('Active');
    expect((await owner.request.get(`${api}/schools/${schoolId}/profile`)).status()).toBe(200);
    await schoolRow
      .getByRole('button', { name: 'Remove Platform Browser School', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toContainText('School records are retained');
    await page.getByRole('button', { name: 'Confirm change', exact: true }).click();
    await expect(schoolRow).toContainText('Archived');
    expect((await owner.request.get(`${api}/schools/${schoolId}/profile`)).status()).toBe(404);
    await schoolRow
      .getByRole('button', { name: 'Restore Platform Browser School', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirm change', exact: true }).click();
    await expect(schoolRow).toContainText('Active');
  } finally {
    await ownerContext.close();
  }
  await schoolRow
    .getByRole('button', { name: 'Edit Platform Browser School', exact: true })
    .click();
  await page.getByLabel('School name', { exact: true }).fill('Updated Platform School');
  await page.getByRole('button', { name: 'Save school', exact: true }).click();
  await expect(schoolRow).toContainText('Updated Platform School');
  await page.getByRole('link', { name: 'Accounts', exact: true }).click();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Account name', { exact: true }).fill('Created Platform Account');
  await page
    .getByLabel('Account email', { exact: true })
    .fill('created-platform-account@example.test');
  await page
    .getByLabel('Initial password', { exact: true })
    .fill('Created platform account passphrase!');
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('Created platform account passphrase!');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  const account = page
    .getByRole('row')
    .filter({ hasText: 'created-platform-account@example.test' });
  await expect(account).toContainText('Active');
  await account.getByRole('button', { name: 'Edit Created Platform Account', exact: true }).click();
  await page.getByLabel('Account name', { exact: true }).fill('Updated Platform Account');
  await page.getByRole('button', { name: 'Save account', exact: true }).click();
  await expect(account).toContainText('Updated Platform Account');
  await account
    .getByRole('button', { name: 'Remove access Updated Platform Account', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm change', exact: true }).click();
  await expect(account).toContainText('Disabled');
  await account
    .getByRole('button', { name: 'Reactivate Updated Platform Account', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm change', exact: true }).click();
  await expect(account).toContainText('Active');
  await account
    .getByRole('button', { name: 'Reset password Updated Platform Account', exact: true })
    .click();
  await page
    .getByLabel('Initial password', { exact: true })
    .fill('Updated platform account passphrase!');
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('Updated platform account passphrase!');
  await page.getByRole('button', { name: 'Confirm password reset', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const adminRow = page.getByRole('row').filter({ hasText: 'browser-super-admin@example.test' });
  await expect(adminRow).toContainText('Protected platform identity');
  await expect(adminRow.getByRole('button')).toHaveCount(0);
  await page.getByRole('link', { name: 'Schools', exact: true }).click();
  await page.getByRole('button', { name: 'Create school', exact: true }).click();
  await page.getByLabel('School name', { exact: true }).fill('Existing Owner School');
  await page.getByLabel('School slug', { exact: true }).fill('existing-owner-school');
  await page.getByRole('combobox', { name: 'School owner', exact: true }).selectOption('existing');
  await page
    .getByLabel('Existing owner email', { exact: true })
    .fill('created-platform-account@example.test');
  await page.getByRole('button', { name: 'Find owner account', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Selected owner: Updated Platform Account');
  await page.getByRole('button', { name: 'Create school and owner', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'existing-owner-school' })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll('body *')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.right > innerWidth && rect.width > 0;
        })
        .slice(0, 12)
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          right: element.getBoundingClientRect().right,
        })),
    }));
    expect(overflow.scroll <= width, JSON.stringify(overflow)).toBe(true);
  }
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    accessibility.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    })),
  ).toEqual([]);
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'School archived' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Account password reset' })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('JWT access renews after expiry across tabs without exposing tokens to scripts', async ({
  page,
  context,
}) => {
  await login(page);
  const original = (await context.cookies(api)).find(
    (cookie) => cookie.name === 'school_refresh',
  )!.value;
  expect(
    (await context.cookies(api)).find((cookie) => cookie.name === 'school_access')?.httpOnly,
  ).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toMatch(/school_access|school_refresh/);
  const other = await context.newPage();
  await other.goto('/settings');
  await expect(other.locator('.settings-profile h2')).toHaveText('Browser Test School');
  let refreshes = 0;
  context.on('request', (request) => {
    if (request.url() === `${api}/auth/refresh`) refreshes++;
  });
  await context.clearCookies({ name: 'school_access' });
  await Promise.all([page.reload(), other.reload()]);
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
  await expect(other.locator('.settings-profile h2')).toHaveText('Browser Test School');
  expect(refreshes).toBe(1);
  expect(
    (await context.cookies(api)).find((cookie) => cookie.name === 'school_refresh')!.value,
  ).not.toBe(original);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await other.close();
});

test('application bootstrap and platform reads issue one request and reuse data between tabs', async ({
  page,
}) => {
  const requests: string[] = [];
  const failed: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith(api) && request.method() === 'GET')
      requests.push(new URL(request.url()).pathname);
  });
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(api)) failed.push(request.url());
  });
  const count = (path: string) => requests.filter((item) => item === `/api/v1${path}`).length;
  await page.goto('/platform');
  await expect(page.getByRole('heading', { name: 'Sign in to your school' })).toBeVisible();
  expect(count('/auth/session')).toBe(1);
  expect(count('/platform/schools')).toBe(0);
  await page.getByLabel('Email', { exact: true }).fill('browser-super-admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser super admin passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh schools', exact: true })).toBeEnabled();
  expect(count('/auth/session')).toBe(2); // one anonymous startup, one successful login
  expect(count('/platform/schools')).toBe(1);
  await page.getByRole('link', { name: 'Accounts', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh accounts', exact: true })).toBeEnabled();
  await page.getByRole('link', { name: 'Schools', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh schools', exact: true })).toBeEnabled();
  expect(count('/platform/schools')).toBe(1);
  expect(count('/auth/session')).toBe(2);
  await page.getByRole('button', { name: 'Refresh schools', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh schools', exact: true })).toBeEnabled();
  expect(count('/platform/schools')).toBe(2);
  requests.length = 0;
  await page.reload();
  await expect(page.getByRole('button', { name: 'Refresh schools', exact: true })).toBeEnabled();
  expect(count('/auth/session')).toBe(1);
  expect(count('/platform/schools')).toBe(1);
  expect(failed).toEqual([]);
});

test('switching from Super Admin to a school account lands in its permitted workspace', async ({
  page,
}) => {
  await page.goto('/platform?tab=Schools');
  await page.getByLabel('Email', { exact: true }).fill('browser-super-admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser super admin passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh schools', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your school' })).toBeVisible();
  const platformRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith(`${api}/platform/`)) platformRequests.push(request.url());
  });
  await page.getByLabel('Email', { exact: true }).fill('browser-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
  await expect(page.getByRole('link', { name: 'Super Admin', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Super Admin access required' })).toHaveCount(0);
  expect(platformRequests).toEqual([]);
});

test('owner configures the existing settings and imports the actual template, with persistence and school isolation', async ({
  page,
}) => {
  test.setTimeout(180000);
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.setDefaultTimeout(15000);
  await login(page);
  const schoolId = await page.getByLabel('Select school').inputValue();
  await expect(page.getByRole('tab', { name: 'General', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Edit Details' }).click();
  await page.getByLabel('Street address', { exact: true }).fill('42 Test Road');
  await page.getByLabel('Location', { exact: true }).fill('Pune');
  await page.getByLabel('Email', { exact: true }).fill('school@example.test');
  let rejectSave = true;
  await page.route(`${api}/schools/${schoolId}/profile`, async (route) => {
    if (rejectSave && route.request().method() === 'PATCH')
      await route.fulfill({
        status: 503,
        json: {
          status: 503,
          data: null,
          error: { code: 'UNAVAILABLE', message: 'private failure' },
        },
      });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Street address')).toHaveValue('42 Test Road');
  await expect(page.getByRole('dialog')).not.toContainText('private failure');
  rejectSave = false;
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.settings-profile')).toContainText('42 Test Road');
  await page.getByRole('tab', { name: 'School Timing', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Timing' }).click();
  await page.getByLabel('School opening time', { exact: true }).fill('08:00');
  await page.getByRole('button', { name: 'Save timing' }).click();
  await expect(page.getByRole('dialog').locator('.form-error').first()).toBeVisible();
  await page.getByLabel('School closing time', { exact: true }).fill('15:00');
  await page.getByLabel('Monday', { exact: true }).check();
  await page.getByRole('button', { name: 'Save timing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Academic years', exact: true }).click();
  await page.getByRole('button', { name: 'Create academic year', exact: true }).click();
  await page.getByLabel('Year name').fill('2026–2027');
  await page.getByLabel('Start date').fill('2026-04-01');
  await page.getByLabel('End date').fill('2027-03-31');
  await page.getByRole('button', { name: 'Save academic year' }).click();
  await expect(page.getByRole('row').filter({ hasText: '2026–2027' })).toContainText('draft');
  expect(
    (await (await page.request.get(`${api}/schools/${schoolId}/onboarding`)).json()).data
      .currentAcademicYearId,
  ).toBeNull();
  await page.getByRole('button', { name: 'Set current' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Current year', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Classes & sections', exact: true }).click();
  for (const label of ['Sections', 'Students', 'Subjects'])
    await expect(page.getByRole('tab', { name: label, exact: true })).toBeVisible();
  async function saveBatch() {
    await page.getByRole('button', { name: /^Review \d+ changes$/ }).click();
    await expect(page.getByRole('dialog', { name: 'Review academic structure' })).toBeVisible();
    await page.getByRole('button', { name: 'Save batch', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel('Setup class')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Configure classes together' }).click();
  await page.getByLabel('Class 1', { exact: true }).check();
  await page.getByLabel('Class 2', { exact: true }).check();
  await page.getByLabel('Class name', { exact: true }).nth(1).fill('Grade 2');
  await saveBatch();
  await page.getByRole('button', { name: 'Configure sections together' }).click();
  await page.getByRole('button', { name: 'Select all classes' }).click();
  await page.getByRole('button', { name: 'Apply section pattern' }).click();
  await page
    .locator('.bulk-class')
    .filter({ has: page.getByRole('heading', { name: 'Grade 2', exact: true }) })
    .getByLabel('Section name')
    .nth(1)
    .fill('C');
  await saveBatch();
  await page.getByRole('tab', { name: 'Subjects', exact: true }).click();
  await expect(page.getByLabel('Subject 1 name', { exact: true })).toHaveValue('English');
  await expect(page.getByLabel('Subject 4 name', { exact: true })).toHaveValue(
    'Environmental Studies',
  );
  await page.getByLabel('Subject 1 name', { exact: true }).fill('English Literature');
  await page.getByLabel('Subject 1 optional', { exact: true }).check();
  await page.getByRole('button', { name: 'Save subjects', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save subjects', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Subject 1 name', { exact: true })).toHaveValue(
    'English Literature',
  );
  await expect(page.getByLabel('Subject 1 optional', { exact: true })).toBeChecked();
  let status = (await (await page.request.get(`${api}/schools/${schoolId}/onboarding`)).json())
    .data;
  expect(status.ready).toBe(true);
  expect(status.counts).toMatchObject({
    classes: 2,
    sections: 4,
    subjects: 8,
    staff: 0,
    enrollments: 0,
    withoutSections: 0,
    withoutSubjects: 0,
  });
  const yearId = status.currentAcademicYearId;
  await page.getByRole('link', { name: 'Staff & HR', exact: true }).click();
  await page.getByRole('tab', { name: 'Import staff', exact: true }).click();
  const csv =
    'Staff Code,Staff Name,Teaching,Department,Designation,Email,Phone,Joined On,Qualification\nT-001,Test Teacher,Yes,Academics,Teacher,bad-email,,2026-01-01,B.Ed\nS-001,Office Staff,No,Office,Clerk,,,,Graduation';
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'staff.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('heading', { name: 'Staff import · draft' })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByRole('button', { name: 'Confirm import', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Edit row 2' }).click();
  await page.getByRole('dialog').getByLabel('Email', { exact: true }).fill('teacher@example.test');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByRole('button', { name: 'Confirm import', exact: true })).toBeEnabled({
    timeout: 20000,
  });
  const savedImportUrl = page.url();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Staff import · draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Staff import · completed' })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator('.roster-totals')).toContainText('2created');
  const results = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download row results' }).click();
  expect((await results).suggestedFilename()).toBe('staff-results.csv');
  await page.getByRole('button', { name: 'Back to directory' }).click();
  await expect(page.getByRole('table', { name: 'Staff records' })).toContainText('Test Teacher');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'same-staff.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page).toHaveURL(savedImportUrl);
  await expect(page.getByRole('heading', { name: 'Staff import · completed' })).toBeVisible();
  await page.getByRole('link', { name: 'Teachers', exact: true }).click();
  await page.getByRole('button', { name: 'Add Staff', exact: true }).click();
  await page.getByLabel('Staff name', { exact: true }).fill('Individual Teacher');
  await page.getByLabel('Staff code', { exact: true }).fill('T-002');
  await page.getByLabel('Department', { exact: true }).fill('Academics');
  await page.getByLabel('Designation', { exact: true }).fill('Teacher');
  const photo = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    canvas.getContext('2d')!.fillRect(0, 0, 10, 10);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Photograph', { exact: true }).setInputFiles({
    name: 'staff.png',
    mimeType: 'image/png',
    buffer: Buffer.from(photo, 'base64'),
  });
  await expect(page.getByAltText('Staff photo preview')).toBeVisible();
  await page.getByRole('button', { name: 'Save staff', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('row').filter({ hasText: 'Individual Teacher' }).locator('img'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Students', exact: true }).click();
  await page.getByLabel('Student directory class').selectOption({ label: 'Class 1' });
  const templateEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Sample Excel', exact: true }).click();
  const template = await templateEvent;
  expect(template.suggestedFilename()).toBe('student-import-sample.xlsx');
  const templateBytes = Array.from(
    await (await import('node:fs/promises')).readFile((await template.path())!),
  );
  const xlsx = await page.evaluate(async (bytes) => {
    const path = '/src/lib/xlsx.ts';
    const { readStudentWorkbook, studentWorkbook } = await import(path);
    const grid = await readStudentWorkbook(new File([new Uint8Array(bytes)], 'template.xlsx'));
    const headers = grid[0].map(String);
    if (
      JSON.stringify(headers) !==
      JSON.stringify([
        'Student Name',
        'Admission Number',
        'Birth Date',
        'Guardian Name',
        'Relationship',
        'Parent Mobile',
        'Address',
        'Roll Number',
        'Section',
      ])
    )
      throw new Error('Template headers changed');
    const blob = studentWorkbook(
      [
        headers,
        ['First Student', '001', '', 'Shared Guardian', 'Mother', '9876543210', 'Pune', '1', 'A'],
        [
          'Second Student',
          '002',
          '2017-01-01',
          'Shared Guardian',
          'Father',
          '9876543210',
          'Pune',
          '2',
          'A',
        ],
      ],
      [],
      'Students',
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, templateBytes);
  await page.getByRole('link', { name: 'Import Excel (.xlsx)', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'students.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(xlsx),
  });
  await expect(page.getByRole('heading', { name: 'Student import · draft' })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByRole('button', { name: 'Confirm import', exact: true })).toBeDisabled();
  await expect(page.getByRole('table')).toContainText('Birth Date: required');
  await page.getByRole('button', { name: 'Edit row 2' }).click();
  await page.getByRole('dialog').getByLabel('Birth Date', { exact: true }).fill('2018-01-01');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByRole('button', { name: 'Confirm import', exact: true })).toBeEnabled({
    timeout: 20000,
  });
  await page.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Student import · completed' })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('link', { name: 'Students', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('First Student');
  await expect(page.getByRole('table')).toContainText('Second Student');
  await page.getByRole('link', { name: 'Add student', exact: true }).click();
  await page.getByLabel('Student name', { exact: true }).fill('Individual Student');
  await page.getByLabel('Admission number', { exact: true }).fill('003');
  await page.getByLabel('Date of birth', { exact: true }).fill('2018-01-01');
  await page.getByLabel('Roll number', { exact: true }).fill('3');
  await page.getByLabel('Guardian name', { exact: true }).fill('Individual Guardian');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Individual Student');
  await page.setViewportSize({ width: 390, height: 1000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/live/student-directory-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('link', { name: 'Teachers', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Test Teacher');
  await expect(page.getByRole('table')).not.toContainText('Office Staff');
  await page.getByRole('tab', { name: 'Teaching assignments', exact: true }).click();
  await page.getByRole('button', { name: 'Assign teacher' }).click();
  await page.getByLabel('Teacher', { exact: true }).selectOption({ label: 'Test Teacher · T-001' });
  await page
    .getByRole('dialog')
    .getByLabel('Class', { exact: true })
    .selectOption({ label: 'Class 1' });
  await page
    .getByRole('dialog')
    .getByLabel('Section', { exact: true })
    .selectOption({ label: 'A' });
  await page
    .getByRole('dialog')
    .getByLabel('Subject', { exact: true })
    .selectOption({ label: 'Mathematics' });
  await page.getByRole('button', { name: 'Save assignment' }).click();
  await expect(page.getByRole('table')).toContainText('Test Teacher');
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  status = (await (await page.request.get(`${api}/schools/${schoolId}/onboarding`)).json()).data;
  expect(status.counts).toMatchObject({
    staff: 3,
    teachers: 2,
    students: 3,
    enrollments: 3,
    assignments: 1,
  });
  await expect(page.getByRole('heading', { name: 'School foundation ready' })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations.map((item) => item.id)).toEqual([]);
  await page.screenshot({ path: 'test-results/live/product-review-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto(`/settings?tab=Classes&section=subjects&year=${yearId}`);
  await page.getByLabel('Subject 1 name', { exact: true }).fill('Unsaved subject');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByLabel('Select school').selectOption({ label: 'Second Browser School' });
  await expect(page.getByLabel('Select school')).toHaveValue(schoolId);
  await expect(page.getByLabel('Subject 1 name', { exact: true })).toHaveValue('Unsaved subject');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Select school').selectOption({ label: 'Second Browser School' });
  await expect(page.getByRole('heading', { name: 'Create your academic year' })).toBeVisible();
  expect(new URL(page.url()).searchParams.has('year')).toBe(false);
  await page.getByRole('link', { name: 'Staff & HR', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No staff found' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Test Teacher');
  await page.getByLabel('Select school').selectOption(schoolId);
  await expect(page.getByRole('table')).toContainText('Test Teacher');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('browser-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Test Teacher');
  expect(
    (
      await (
        await page.request.get(`${api}/schools/${schoolId}/academic-years/${yearId}/enrollments`)
      ).json()
    ).data.items,
  ).toHaveLength(3);
  expect(failures).toEqual([]);
});

test('live academics uses the original screens without loading local demo marks', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('schoolwell-demo-v1', 'academic-demo-sentinel'),
  );
  const modules: string[] = [];
  page.on('request', (request) => modules.push(request.url()));
  await login(page);
  const session = (await (await page.request.get(`${api}/auth/session`)).json()).data;
  const schoolId = session.memberships.find(
    (m: { schoolName: string }) => m.schoolName === 'Browser Test School',
  ).schoolId;
  const root = `${api}/schools/${schoolId}`;
  const status = (await (await page.request.get(`${root}/onboarding`)).json()).data;
  if (!status.currentAcademicYearId) {
    const csrf = (await (await page.request.get(`${api}/auth/csrf`)).json()).data.csrfToken;
    const headers = { origin: 'http://127.0.0.1:5176', 'x-csrf-token': csrf };
    const created = await page.request.post(`${root}/academic-years`, {
      headers,
      data: { name: 'Academic UI fixture', start: '2026-01-01', end: '2026-12-31' },
    });
    expect(created.status()).toBe(201);
    const year = (await created.json()).data;
    expect(
      (
        await page.request.post(`${root}/academic-years/${year.id}/select`, {
          headers,
          data: { revision: status.academicRevision },
        })
      ).status(),
    ).toBe(200);
  }
  await page.goto('/academics?view=results&class=class-8&section=unsectioned');
  await expect(page.getByRole('heading', { name: 'Academics', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Results', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Add Test / Exam' })).toHaveCount(0);
  await expect(page.locator('.academic-result-card')).toHaveCount(0);
  expect(modules.some((url) => /\/src\/(mocks\/|lib\/demoRepository\.ts)/.test(url))).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('schoolwell-demo-v1'))).toBe(
    'academic-demo-sentinel',
  );
});
