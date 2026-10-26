import { afterEach, expect, it, vi } from 'vitest';
import { apiService } from './apiService';
import { loadLearning } from './learningService';
const schoolId = 'a'.repeat(24),
  yearId = 'b'.repeat(24);
const response = () => ({
  today: '2026-10-20',
  timezone: 'Asia/Kolkata',
  canManage: false,
  unavailable: ['notifications'],
  attendanceRevisions: {},
  assignments: [],
  state: {
    version: 1,
    school: { id: schoolId, name: 'Configured School', city: '', motto: '' },
    academicYear: { id: yearId, schoolId, name: '2026', start: '2026-01-01', end: '2026-12-31' },
    classes: [],
    sections: [],
    students: [],
    teachers: [],
    staffMembers: [],
    enrollments: [],
    attendance: [],
    staffAttendance: [],
    exams: [],
    results: [],
    obligations: [],
    payments: [],
    notifications: [],
    activities: [],
  },
});
afterEach(() => vi.restoreAllMocks());
it('accepts an empty real school without loading demo people or curriculum', async () => {
  const request = vi.spyOn(apiService, 'request').mockResolvedValue(response());
  const data = await loadLearning(schoolId, yearId, 'overview');
  expect(data.state.school.timezone).toBe('Asia/Kolkata');
  expect(data.state.classes).toEqual([]);
  expect(data.state.students).toEqual([]);
  expect(data.state.exams).toEqual([]);
  expect(request).toHaveBeenCalledWith(
    expect.stringContaining('/learning?area=overview'),
    expect.objectContaining({ fresh: true }),
  );
});
it('rejects a different school response instead of showing its records', async () => {
  const data = response();
  data.state.school.id = 'c'.repeat(24);
  vi.spyOn(apiService, 'request').mockResolvedValue(data);
  await expect(loadLearning(schoolId, yearId, 'academics')).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});
it('surfaces network failure and never falls back to local seed data', async () => {
  vi.spyOn(apiService, 'request').mockRejectedValue(new Error('Test network unavailable'));
  await expect(loadLearning(schoolId, yearId, 'attendance')).rejects.toThrow(
    'Test network unavailable',
  );
});
