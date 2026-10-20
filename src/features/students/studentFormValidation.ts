import { parseCalendarDate } from '../../lib/displayFormat';
import { validRoll } from '../../lib/studentIdentifiers';
import type { StudentInput } from '../../lib/management';
export type StudentField =
  | 'name'
  | 'admissionNumber'
  | 'birthDate'
  | 'guardianName'
  | 'guardianRelation'
  | 'guardianPhone'
  | 'address'
  | 'classId'
  | 'sectionId'
  | 'rollNumber'
  | 'status';
export type StudentFieldErrors = Partial<Record<StudentField, string>>;
export function validateStudentForm(
  draft: StudentInput,
  today: string,
  addressLimit = 300,
  admissionLimit = 40,
): StudentFieldErrors {
  const errors: StudentFieldErrors = {};
  if (!draft.name.trim() || draft.name.length > 100)
    errors.name = 'Enter the student name (up to 100 characters).';
  if (
    !draft.admissionNumber.trim() ||
    draft.admissionNumber.length > admissionLimit ||
    !/^[\p{L}\p{N}][\p{L}\p{N} /_.-]*$/u.test(draft.admissionNumber.trim())
  )
    errors.admissionNumber = `Enter an admission number (up to ${admissionLimit} letters, numbers, spaces, /, _, . or -).`;
  const birth = parseCalendarDate(draft.birthDate);
  if (!birth || birth > today)
    errors.birthDate = 'Enter a real DD-MM-YYYY birth date that is not in the future.';
  if (!draft.guardian.name.trim() || draft.guardian.name.length > 100)
    errors.guardianName = 'Enter the guardian name (up to 100 characters).';
  if (!draft.guardian.relation.trim() || draft.guardian.relation.length > 100)
    errors.guardianRelation = 'Enter the relationship (up to 100 characters).';
  if (
    draft.guardian.contact &&
    !/^\+?[1-9]\d{6,14}$/.test(draft.guardian.contact.replace(/[ ()-]/g, ''))
  )
    errors.guardianPhone = 'Enter a valid mobile number, with country code if needed.';
  if (draft.address.length > addressLimit)
    errors.address = `Use at most ${addressLimit} characters for the address.`;
  if (!draft.classId) errors.classId = 'Choose a class.';
  if (!validRoll(draft.rollNumber))
    errors.rollNumber = 'Enter a roll number, such as 12 or SH-12 (up to 40 characters).';
  return errors;
}
export function focusStudentError(form: HTMLFormElement) {
  requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}
