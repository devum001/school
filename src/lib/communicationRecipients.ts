import type { DemoState } from '../types/domain';
import type { CommunicationRecipient, NoticeAudience, RecipientRole } from '../types/communication';
import { roster } from './selectors';
import { staffDirectory } from './staffStructure';
import { defaultStaffPayroll } from './settings';
export function studentRecipients(
  state: DemoState,
  ids: string[],
  roles: RecipientRole[],
  includeInactive = false,
): CommunicationRecipient[] {
  return roster(state, includeInactive)
    .filter((row) => row.enrollment.schoolId === state.school.id && ids.includes(row.enrollment.id))
    .flatMap((row) =>
      (roles.some((role) => role === 'Parent' || role === 'Student')
        ? ['Student' as const]
        : []
      ).map((role) => ({
        // Retain the old identity to avoid duplicating saved parent alerts.
        id: `Parent:${row.enrollment.id}`,
        name: row.student.name,
        role,
        studentName: row.student.name,
        classId: row.enrollment.classId,
        sectionId: row.enrollment.sectionId,
        className: row.className,
        sectionName: row.sectionName,
        enrollmentId: row.enrollment.id,
        studentId: row.student.id,
        phone: row.student.guardian.contact,
        email: null,
      })),
    );
}
export function noticeRecipients(
  state: DemoState,
  audience: NoticeAudience,
  roles: RecipientRole[],
): CommunicationRecipient[] {
  const rows = roster(state).filter((row) => row.enrollment.schoolId === state.school.id);
  if (
    audience.kind === 'Class' &&
    (!audience.classIds.length ||
      audience.classIds.some(
        (id) => !state.classes.some((c) => c.schoolId === state.school.id && c.id === id),
      ))
  )
    throw new Error('Choose valid classes for this school.');
  if (
    audience.kind === 'Section' &&
    (!audience.sectionIds.length ||
      audience.sectionIds.some(
        (id) => !state.sections.some((s) => s.schoolId === state.school.id && s.id === id),
      ))
  )
    throw new Error('Choose valid sections for this school.');
  if (
    audience.kind === 'Selected Students' &&
    (!audience.studentIds.length ||
      audience.studentIds.some((id) => !rows.some((r) => r.enrollment.id === id)))
  )
    throw new Error('Choose students enrolled in this school.');
  const students = ['All School', 'Class', 'Section', 'Selected Students', 'Parents'].includes(
    audience.kind,
  )
    ? rows.filter((row) =>
        audience.kind === 'Class'
          ? audience.classIds.includes(row.enrollment.classId)
          : audience.kind === 'Section'
            ? audience.sectionIds.includes(row.enrollment.sectionId)
            : audience.kind === 'Selected Students'
              ? audience.studentIds.includes(row.enrollment.id)
              : true,
      )
    : [];
  const targets = studentRecipients(
    state,
    students.map((row) => row.enrollment.id),
    audience.kind === 'Parents' ? roles.filter((r) => r === 'Parent') : roles,
  );
  if (['All School', 'Teachers', 'Staff'].includes(audience.kind)) {
    const members = staffDirectory(state, state.staffPayroll ?? defaultStaffPayroll).filter(
      (m) => m.status === 'active',
    );
    const eligible = members.filter((member) => audience.kind !== 'Teachers' || !!member.teacherId);
    if (
      audience.memberSelection === 'Selected' &&
      (!audience.memberIds?.length ||
        audience.memberIds.some((id) => !eligible.some((member) => member.id === id)))
    )
      throw new Error('Choose active members of this school.');
    for (const member of eligible) {
      if (audience.memberSelection === 'Selected' && !audience.memberIds?.includes(member.id))
        continue;
      const role =
        audience.kind === 'Teachers'
          ? 'Teacher'
          : audience.kind === 'Staff'
            ? 'Staff'
            : member.teacherId && roles.includes('Teacher')
              ? 'Teacher'
              : 'Staff';
      if (!roles.includes(role) || (role === 'Teacher' && !member.teacherId)) continue;
      targets.push({
        id: `employee:${member.teacherId ?? member.id}`,
        name: member.name,
        role,
        studentName: '',
        classId: '',
        sectionId: '',
        className: '',
        sectionName: '',
        phone: member.phone || null,
        email: member.email || null,
      });
    }
  }
  return [...new Map(targets.map((target) => [target.id, target])).values()];
}
export function recipientLabel(target: CommunicationRecipient) {
  return target.role === 'Parent' || target.role === 'Student' ? 'Student' : target.role;
}
