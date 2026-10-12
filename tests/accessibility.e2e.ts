import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('key screens meet automated WCAG A/AA checks', async ({ page }) => {
  for (const path of [
    '/',
    '/students',
    '/attendance',
    '/notifications',
    '/students/stu-001?tab=fees',
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.map((v) => ({
        path,
        rule: v.id,
        nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    ).toEqual([]);
  }
});
