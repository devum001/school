import { afterEach, expect, it, vi } from 'vitest';
import { apiService } from '../../../services/apiService';
import { liveClassSource } from './liveClassSettings';
import type { SchoolAccess } from '../../../services/schoolAccessService';
const schoolId = 'a'.repeat(24),
  yearId = 'b'.repeat(24),
  classId = 'c'.repeat(24),
  subjectId = 'd'.repeat(24);
const access: SchoolAccess = {
  schoolId,
  membershipId: 'e'.repeat(24),
  roleId: 'f'.repeat(24),
  owner: true,
  permissions: [
    'classes.view',
    'academic-years.view',
    'subjects.view',
    'subjects.manage',
    'classes.manage',
  ],
};
const parent = {
  id: classId,
  schoolId,
  academicYearId: yearId,
  name: 'Class 2',
  grade: '',
  status: 'active' as const,
  revision: 4,
};
const snapshot = {
  schoolId,
  year: {
    id: yearId,
    schoolId,
    name: '2026',
    start: '2026-01-01',
    end: '2026-12-31',
    status: 'active',
    revision: 0,
  },
  classes: [parent],
  children: [],
  truncated: false,
};
afterEach(() => vi.restoreAllMocks());
it('rejects foreign class snapshots and never replaces a failed request with demo defaults', async () => {
  const request = vi
    .spyOn(apiService, 'request')
    .mockResolvedValue({ ...snapshot, classes: [{ ...parent, schoolId: yearId }] });
  const source = liveClassSource(access, yearId);
  await expect(source.load(new AbortController().signal)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
  request.mockRejectedValue(new Error('Offline'));
  await expect(source.subjects(classId, new AbortController().signal)).rejects.toThrow('Offline');
});
it('previews the actual server catalog without a write and rejects foreign preview context', async () => {
  const request = vi
    .spyOn(apiService, 'request')
    .mockResolvedValueOnce(snapshot)
    .mockResolvedValueOnce({
      schoolId,
      academicYearId: yearId,
      classId,
      names: ['English', 'Hindi'],
    });
  const source = liveClassSource(access, yearId);
  expect(await source.subjects(classId, new AbortController().signal)).toEqual([
    { id: 'default-0', name: 'English' },
    { id: 'default-1', name: 'Hindi' },
  ]);
  expect(
    request.mock.calls.every(([, options]) => !options?.method || options.method === 'GET'),
  ).toBe(true);
  request.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({
    schoolId: yearId,
    academicYearId: yearId,
    classId,
    names: ['Wrong school'],
  });
  await expect(source.subjects(classId, new AbortController().signal)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});
it('preserves hidden optional metadata and the revision from the loaded subjects', async () => {
  const subject = {
    id: subjectId,
    schoolId,
    academicYearId: yearId,
    classId,
    name: 'English',
    optional: true,
    status: 'active',
    revision: 6,
  };
  const request = vi
    .spyOn(apiService, 'request')
    .mockResolvedValueOnce({ ...snapshot, children: [subject] });
  const source = liveClassSource(access, yearId);
  await source.subjects(classId, new AbortController().signal);
  request.mockResolvedValueOnce({ saved: 1 }).mockResolvedValueOnce({
    ...snapshot,
    children: [{ ...subject, name: 'English Language', revision: 7 }],
  });
  await source.saveSubjects(classId, [{ id: subjectId, name: 'English Language' }]);
  expect(request.mock.calls[1][1]?.body).toMatchObject({
    rows: [{ id: subjectId, revision: 6, optional: true, name: 'English Language' }],
  });
});
it('deletes through the scoped endpoint with the loaded revision', async () => {
  const request = vi.spyOn(apiService, 'request').mockResolvedValue({ id: classId });
  await liveClassSource(access, yearId).remove('class', parent);
  expect(request).toHaveBeenCalledWith(
    `/schools/${schoolId}/academic-years/${yearId}/classes/${classId}`,
    { method: 'DELETE', body: { revision: 4 } },
  );
});
it('sets up classes and sections through one scoped authenticated API call', async () => {
  const request = vi.spyOn(apiService, 'request').mockResolvedValue({ saved: 1 });
  const rows = [{ name: 'Class 1', sections: ['A', 'B'] }];
  await liveClassSource(access, yearId).setupClasses(rows);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(
    `/schools/${schoolId}/academic-years/${yearId}/classes/setup`,
    {
      method: 'POST',
      body: { rows, includeDefaultSubjects: true },
    },
  );
});
it('reports setup failure and never falls back to local persistence', async () => {
  vi.spyOn(apiService, 'request').mockRejectedValue(new Error('Conflict'));
  await expect(
    liveClassSource(access, yearId).setupClasses([{ name: 'Class 1', sections: ['A'] }]),
  ).rejects.toThrow('Conflict');
});
