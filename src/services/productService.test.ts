import { afterEach, expect, it, vi } from 'vitest';
import { apiService } from './apiService';
import { productApi } from './productService';
const schoolId = 'a'.repeat(24),
  yearId = 'b'.repeat(24),
  classId = 'c'.repeat(24),
  sectionId = 'd'.repeat(24),
  studentId = 'e'.repeat(24);
const student = {
  id: studentId,
  schoolId,
  code: '001',
  name: 'Student',
  status: 'active',
  revision: 2,
};
const enrollment = {
  id: 'f'.repeat(24),
  schoolId,
  academicYearId: yearId,
  classId,
  sectionId,
  className: 'Class 1',
  sectionName: 'A',
  rollNumber: 1,
  status: 'active',
  revision: 0,
  student,
};
afterEach(() => vi.restoreAllMocks());
it('rejects a foreign nested student or mismatched enrollment year before displaying a roster', async () => {
  const request = vi.spyOn(apiService, 'request').mockResolvedValue({
    items: [{ ...enrollment, student: { ...student, schoolId: yearId } }],
    total: 1,
    nextCursor: null,
  });
  await expect(
    productApi.students(schoolId, yearId, new AbortController().signal),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  request.mockResolvedValue({
    items: [{ ...enrollment, academicYearId: schoolId }],
    total: 1,
    nextCursor: null,
  });
  await expect(
    productApi.students(schoolId, yearId, new AbortController().signal),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  request.mockResolvedValue({ items: [enrollment], total: 1, nextCursor: null });
  expect(
    (await productApi.students(schoolId, yearId, new AbortController().signal)).items[0].student.id,
  ).toBe(studentId);
});
it('uses persisted revision and class context for individual updates without creating accounts', async () => {
  const request = vi.spyOn(apiService, 'request').mockResolvedValue(student);
  const cells = ['Student', '001', '2018-01-01', 'Guardian', 'Parent', '', '', '1', 'A'];
  await productApi.saveStudent(schoolId, yearId, classId, cells, { ...student, status: 'active' });
  expect(request).toHaveBeenCalledWith(
    `/schools/${schoolId}/academic-years/${yearId}/students/${studentId}`,
    { method: 'PATCH', body: { classId, cells, revision: 2 } },
  );
  request.mockResolvedValue({ ...student, schoolId: yearId });
  await expect(productApi.saveStaff(schoolId, [], undefined)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});
