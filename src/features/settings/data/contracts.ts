import type { ClassSetupRow } from '../../../lib/classSetup';
import type { ClassSubject, School, SchoolHours } from '../../../types/domain';
import type { ClassFormValue } from '../ClassStructureForm';
export interface ProfileSource {
  validate(school: School): Record<string, string>;
  save(school: School, hours?: SchoolHours): Promise<void> | void;
}
export interface StructureRecord {
  id: string;
  name: string;
  grade?: string;
  classId?: string;
  teacherId?: string | null;
  revision?: number;
  status?: 'active' | 'archived';
}
export interface StructureSnapshot {
  classes: StructureRecord[];
  sections: (StructureRecord & { classId: string })[];
  teachers: { id: string; name: string; status?: string }[];
  counts: { classId: string; sectionId: string; count: number }[];
  countsKnown?: boolean;
  writable: boolean;
}
export interface ClassSettingsSource {
  setupClasses(rows: ClassSetupRow[]): Promise<void>;
  subscribe?: (notify: () => void) => () => void;
  load(signal: AbortSignal): Promise<StructureSnapshot>;
  save(
    kind: 'class' | 'section',
    draft: ClassFormValue,
    existing?: StructureRecord,
    classId?: string,
  ): Promise<void>;
  remove(kind: 'class' | 'section', record: StructureRecord): Promise<void>;
  subjects(classId: string, signal: AbortSignal): Promise<ClassSubject[]>;
  saveSubjects(classId: string, subjects: ClassSubject[]): Promise<ClassSubject[]>;
}
