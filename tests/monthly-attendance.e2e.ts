import { test, expect } from '@playwright/test';
import { createSeed } from '../src/mocks/seed';
import { loadAcademicFixture } from './academicFixture';

test('monthly attendance starts on day one, distinguishes missing and future days, and keeps marked-day rates', async ({
  page,
}, info) => {
  const state = createSeed('2026-10-18');
  const enrollment = state.enrollments[0];
  state.attendance = state.attendance.filter((r) => r.enrollmentId !== enrollment.id);
  const statuses = ['present', 'absent', 'late', 'half-day'] as const;
  for (let index = 1; index <= 18; index++) {
    state.attendance.push({
      schoolId: state.school.id,
      enrollmentId: enrollment.id,
      date: `2026-10-${String(index).padStart(2, '0')}`,
      status: statuses[index - 3] ?? 'unmarked',
    });
  }
  await loadAcademicFixture(page, state);
  await page.clock.setFixedTime(new Date('2026-10-18T06:30:00Z'));
  await page.goto(`/students/${enrollment.studentId}?tab=attendance`);
  const calendar = page.locator('.attendance-calendar');
  await expect(calendar.locator('.calendar-day')).toHaveCount(31);
  await expect(calendar.locator('.calendar-day').first().locator('strong')).toHaveText('1');
  await expect(calendar.locator('.calendar-day').first()).toContainText('Not marked');
  await expect(calendar.locator('.calendar-day').last()).toContainText('Upcoming');
  await expect(calendar.locator('.absent')).toHaveCount(1);
  await expect(calendar.locator('.late, .half-day')).toHaveCount(2);
  await expect(page.locator('.stat-card').filter({ hasText: 'Attendance rate' })).toContainText(
    '75%',
  );
  await expect(page.getByRole('columnheader', { name: 'Source', exact: true })).toHaveCount(0);
  await calendar.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('month-desktop.png') });
  await page.getByLabel('Attendance month', { exact: true }).fill('2026-04');
  await expect(calendar.locator('.calendar-day')).toHaveCount(30);
  await expect(calendar.locator('.calendar-day').first().locator('strong')).toHaveText('1');
  await expect(calendar.locator('.unmarked')).toHaveCount(30);
  await expect(
    page.locator('.stat-card').filter({ hasText: 'Absent days' }).locator('.stat-value'),
  ).toHaveText('0');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await calendar.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('month-mobile.png') });
});
