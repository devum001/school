import { downloadStudentWorkbook } from './xlsx';
export const STUDENT_IMPORT_HEADERS = [
  'Student Name',
  'Admission Number',
  'Birth Date',
  'Guardian Name',
  'Relationship',
  'Parent Mobile',
  'Address',
  'Roll Number',
  'Section',
  'Class',
];
export function downloadClassStudentTemplate(className: string, sections: string[]) {
  downloadStudentWorkbook(
    'student-import-sample.xlsx',
    [STUDENT_IMPORT_HEADERS],
    [
      `Fill Class on every row to import across classes. Current selection: ${className}.`,
      `Current class sections: ${sections.join(', ') || 'none'}. Leave Section blank only when the class has no sections.`,
      'Required: Student Name, Admission Number, Birth Date, Guardian Name, Roll Number, Class.',
      'Admission and roll numbers may contain letters and numbers (for example SH-12). Duplicate checks compare only numeric digits: SH-12, AB-12 and 0012 count as the same identifier. They are never assigned automatically.',
      'Roll numbers must be unique within each section and academic year, or within a class with no sections. Different sections may reuse a roll number. Admission numbers must be unique across the school.',
      'Birth Date: DD-MM-YYYY or Excel date cell. Keep identifiers and phone numbers as text.',
      'Relationship defaults to Parent. Parent Mobile and Address are optional. No formulas; up to 1,000 rows.',
    ],
  );
}
