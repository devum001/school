import type { DemoState } from '../types/domain';
import type { StoredDocument } from '../types/ledger';
import { storedDocumentSchema } from './ledgerSchemas';
import { staffDirectory } from './staffStructure';
import { defaultStaffPayroll } from './settings';
export const STAFF_DOCUMENT_CATEGORIES = [
  'Aadhaar / ID proof',
  'Qualification certificates',
  'Degree / marksheets',
  'Experience certificate',
  'Joining / appointment letter',
  'Other documents',
] as const;
export const STUDENT_DOCUMENT_CATEGORIES = [
  'Identity / birth certificate',
  'Admission form',
  'Previous marksheets',
  'Transfer certificate',
  'Other documents',
] as const;
function validOwner(state: DemoState, kind: StoredDocument['ownerKind'], ownerId: string) {
  return kind === 'student'
    ? state.students.some(
        (student) => student.schoolId === state.school.id && student.id === ownerId,
      )
    : staffDirectory(state, state.staffPayroll ?? defaultStaffPayroll).some(
        (member) => member.id === ownerId,
      );
}
export function validFileSignature(mimeType: StoredDocument['mimeType'], base64: string) {
  let header: string;
  try {
    header = atob(base64.slice(0, 64));
  } catch {
    return false;
  }
  return mimeType === 'application/pdf'
    ? header.startsWith('%PDF-')
    : mimeType === 'image/png'
      ? header.startsWith('\x89PNG\r\n\x1a\n')
      : mimeType === 'image/jpeg'
        ? header.startsWith('\xff\xd8\xff')
        : header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP';
}
export function saveEntityDocument(
  state: DemoState,
  raw: Omit<StoredDocument, 'id' | 'schoolId' | 'uploadedAt' | 'uploadedBy'>,
): DemoState {
  const entry = storedDocumentSchema.parse({
    ...raw,
    id: crypto.randomUUID(),
    schoolId: state.school.id,
    uploadedAt: new Date().toISOString(),
    uploadedBy: state.school.principal || 'School office',
  });
  if (!validOwner(state, entry.ownerKind, entry.ownerId))
    throw new Error('Document owner not found in this school.');
  const categories: readonly string[] =
    entry.ownerKind === 'staff' ? STAFF_DOCUMENT_CATEGORIES : STUDENT_DOCUMENT_CATEGORIES;
  if (!categories.includes(entry.category)) throw new Error('Choose a valid document category.');
  const [prefix, base64] = entry.dataUrl.split(',');
  const size = (base64.length * 3) / 4 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  if (
    prefix !== `data:${entry.mimeType};base64` ||
    size !== entry.size ||
    !validFileSignature(entry.mimeType, base64)
  )
    throw new Error('Choose a valid PDF, PNG, JPEG or WebP document.');
  if (
    state.documents?.some(
      (document) =>
        document.schoolId === state.school.id &&
        document.ownerKind === entry.ownerKind &&
        document.ownerId === entry.ownerId &&
        document.category === entry.category &&
        document.dataUrl === entry.dataUrl,
    )
  )
    throw new Error('This document is already saved.');
  return { ...state, documents: [...(state.documents ?? []), entry] };
}
export function deleteEntityDocument(state: DemoState, id: string): DemoState {
  if (
    !state.documents?.some(
      (document) => document.schoolId === state.school.id && document.id === id,
    )
  )
    throw new Error('Document not found.');
  return {
    ...state,
    documents: state.documents.filter(
      (document) => document.schoolId !== state.school.id || document.id !== id,
    ),
  };
}
