import { portalAccess } from './portalAccess';
import type { DemoState } from '../../types/domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SchoolFeatureContext, type SchoolFeatureData } from '../../app/schoolFeatureContext';
import { Button, LoadingOverlay, Panel } from '../../components/ui/Primitives';
import {
  createTest as validateNewTest,
  updateTest as validateTestChange,
} from '../../lib/academics';
import { saveMarksSheet as validateMarksSheet } from '../../lib/academicSheets';
import { apiService } from '../../services/apiService';
import {
  learningRoot,
  loadLearning,
  type LearningArea,
  type LearningSnapshot,
} from '../../services/learningService';
import DashboardPage from '../dashboard/DashboardPage';
import AcademicsPage from '../academics/AcademicsPage';
import AttendancePage from '../attendance/AttendancePage';
import ClassesPage from '../classes/ClassesPage';
import { sessionStore } from '../auth/sessionStore';
import { useLiveSchool } from './schoolContext';
import { useRemote } from './useRemote';

const SUBJECT_ALIAS_GROUPS: readonly (readonly string[])[] = [
  ['math', 'maths', 'mathematics', 'applied mathematics'],
  ['eng', 'english', 'english core', 'english elective', 'general english'],
  ['hin', 'hindi', 'hindi core', 'hindi elective', 'general hindi'],
  ['sci', 'science', 'general science'],
  ['sst', 'social science', 'social studies'],
  ['evs', 'environmental studies', 'environmental science'],
  [
    'cs',
    'computer',
    'computers',
    'computer science',
    'computer applications',
    'it',
    'information technology',
    'informatics practices',
    'ip',
  ],
  ['phy', 'physics'],
  ['chem', 'chemistry'],
  ['bio', 'biology'],
  ['acc', 'accounts', 'accountancy'],
  ['bst', 'business', 'business studies'],
  ['eco', 'economics'],
  ['pol sci', 'political science', 'civics'],
  ['hist', 'history'],
  ['geo', 'geography'],
  ['sans', 'sanskrit', 'sanskrit literature'],
  ['pe', 'physical education', 'phe'],
  ['gk', 'general knowledge'],
];

function cleanSubjectToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(
      /\b(teacher|faculty|lecturer|instructor|professor|pgt|tgt|prt|senior|junior|sr|jr|head|hod|dept|department|master|mistress|subject|class|grade)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTeacherSubjectTokens(labels: string[]): string[] {
  return labels
    .flatMap((label) => label.split(/[,/&|;+]|\band\b/i))
    .map(cleanSubjectToken)
    .filter((token) => token.length >= 2);
}

function subjectMatchesTeacherTokens(subjectName: string, teacherTokens: string[]): boolean {
  const cleanSub = cleanSubjectToken(subjectName);
  if (!cleanSub || !teacherTokens.length) return false;
  return teacherTokens.some((token) => {
    if (cleanSub === token) return true;
    const group = SUBJECT_ALIAS_GROUPS.find((g) => g.includes(token) || g.includes(cleanSub));
    if (group && group.includes(token) && group.includes(cleanSub)) return true;
    const subWords = cleanSub.split(' ');
    const tokenWords = token.split(' ');
    return (
      (token.length >= 3 && subWords.includes(token)) ||
      (cleanSub.length >= 3 && tokenWords.includes(cleanSub))
    );
  });
}

function learningAreaMessage(area: LearningArea): string {
  if (area === 'overview') return 'Loading overview…';
  if (area === 'academics') return 'Loading test & results…';
  if (area === 'attendance') return 'Loading attendance…';
  return 'Loading class settings…';
}

function createEmptyLearningSnapshot(
  schoolId: string,
  schoolName: string,
  yearId: string,
  yearName: string,
): LearningSnapshot {
  const today = new Date().toISOString().slice(0, 10);
  return {
    state: {
      version: 1,
      school: {
        id: schoolId,
        name: schoolName,
        city: '',
        motto: '',
      },
      academicYear: {
        id: yearId,
        schoolId,
        name: yearName,
        start: `${today.slice(0, 4)}-04-01`,
        end: `${Number(today.slice(0, 4)) + 1}-03-31`,
      },
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
    today,
    timezone: 'Asia/Kolkata',
    canManage: false,
    unavailable: ['fees', 'notifications'],
    attendanceRevisions: {},
    assignments: [],
  };
}

export default function LiveLearning({ area }: { area: LearningArea }) {
  const { schoolId, status, access, profile } = useLiveSchool(),
    [params] = useSearchParams();
  const yearId = params.get('year') || status.currentAcademicYearId || '';
  const [date, setDate] = useState<string>();
  const requestedDate = params.get('date') || date;
  const targetKey = `${yearId}:${area}:${requestedDate || ''}`;
  const load = useCallback(
    async (signal: AbortSignal) => ({
      value: await loadLearning(schoolId, yearId, area, requestedDate, signal),
      key: targetKey,
    }),
    [schoolId, yearId, area, requestedDate, targetKey],
  );
  const remote = useRemote(load);
  const reload = remote.reload;
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<string>).detail === schoolId) reload();
    };
    window.addEventListener('schoolwell:punch-change', changed);
    return () => window.removeEventListener('schoolwell:punch-change', changed);
  }, [schoolId, reload]);
  const loadingMessage = learningAreaMessage(area);
  const fallbackSnapshot = useMemo(
    () =>
      createEmptyLearningSnapshot(
        schoolId,
        profile?.school.name ?? 'School workspace',
        yearId || 'current',
        profile?.academicYear?.name ?? 'Current Academic Year',
      ),
    [schoolId, profile?.school.name, yearId, profile?.academicYear?.name],
  );
  if (!yearId)
    return (
      <Panel title="Select an academic year">
        <p>
          Choose or create the school academic year in Settings → Preferences → Default Context.
        </p>
      </Panel>
    );
  if (remote.error)
    return (
      <Panel title="School records unavailable">
        <p role="alert">{remote.error}</p>
        <Button onClick={remote.reload}>Retry</Button>
      </Panel>
    );
  const isReady = Boolean(remote.data && remote.data.key === targetKey);
  const activeSnapshot = isReady ? remote.data!.value : (remote.data?.value ?? fallbackSnapshot);
  return (
    <LoadingOverlay
      loading={!isReady || remote.loading}
      size="xl"
      label={loadingMessage}
      message={loadingMessage}
    >
      <LearningContent
        key={`${schoolId}:${targetKey}:${isReady ? 'ready' : 'loading'}`}
        initial={activeSnapshot}
        owner={access.owner}
        permissions={access.permissions}
        area={area}
        schoolId={schoolId}
        yearId={yearId}
        date={requestedDate}
        setDate={setDate}
      />
    </LoadingOverlay>
  );
}
function LearningContent({
  initial,
  owner,
  permissions,
  area,
  schoolId,
  yearId,
  date,
  setDate,
}: {
  initial: LearningSnapshot;
  owner?: boolean;
  permissions: readonly string[];
  area: LearningArea;
  schoolId: string;
  yearId: string;
  date?: string;
  setDate: (date: string) => void;
}) {
  const [data, setSaved] = useState(initial),
    latest = useRef(initial);
  const refresh = useCallback(async () => {
    const next = await loadLearning(schoolId, yearId, area, date);
    latest.current = next;
    setSaved(next);
    return next;
  }, [schoolId, yearId, area, date]);
  // A changed query date is a new server snapshot, never an optimistic local record.
  const effective = data;
  const root = learningRoot(schoolId, yearId);
  const feature = useMemo<SchoolFeatureData>(() => {
    const isAdminOrOwner =
      Boolean(owner) ||
      permissions.includes('school.profile.manage') ||
      permissions.includes('roles.manage') ||
      permissions.includes('staff.manage') ||
      permissions.includes('classes.manage');
    const sessionUser = sessionStore.getSnapshot().session?.user;
    const userEmail = sessionUser?.email?.trim().toLowerCase() ?? '';
    const userName = sessionUser?.name?.trim().toLowerCase() ?? '';
    const matchedTeachers = effective.state.teachers.filter(
      (t) =>
        (userEmail && t.email.trim().toLowerCase() === userEmail) ||
        (userName && t.name.trim().toLowerCase() === userName) ||
        (!isAdminOrOwner && effective.state.teachers.length === 1),
    );
    const matchedStaff = effective.state.staffMembers.filter(
      (s) =>
        (userEmail && s.email.trim().toLowerCase() === userEmail) ||
        (userName && s.name.trim().toLowerCase() === userName) ||
        matchedTeachers.some((t) => t.staffId === s.id || s.teacherId === t.id) ||
        (!isAdminOrOwner && effective.state.staffMembers.length === 1),
    );
    const teacherTokens = extractTeacherSubjectTokens([
      ...matchedTeachers.map((t) => t.subject),
      ...matchedStaff.map((s) => s.designation),
    ]);
    const explicitSubjectAssignments = effective.assignments.filter((g) => Boolean(g.subjectId));
    const isTeacherScoped =
      !isAdminOrOwner &&
      (!permissions.includes('academics.manage') ||
        explicitSubjectAssignments.length > 0 ||
        teacherTokens.length > 0);
    const subjectNameLookup = new Map<string, string>();
    for (const cls of effective.state.classes) {
      for (const sub of cls.subjects ?? []) {
        subjectNameLookup.set(sub.id, sub.name);
      }
    }
    const canAccessSubject = (
      classId: string,
      sectionId: string,
      subjectId: string,
      subjectName?: string,
    ) => {
      if (!isTeacherScoped) return true;
      const resolvedName = subjectName || subjectNameLookup.get(subjectId) || '';
      const hasClassSectionScope =
        !effective.assignments.length ||
        effective.assignments.some(
          (g) =>
            (!classId || g.classId === classId) &&
            (!sectionId || !g.sectionId || g.sectionId === sectionId),
        );
      if (!hasClassSectionScope) return false;
      if (explicitSubjectAssignments.length > 0 || teacherTokens.length > 0) {
        const matchesAssignedId =
          Boolean(subjectId) &&
          explicitSubjectAssignments.some(
            (g) =>
              g.subjectId === subjectId &&
              (!classId || g.classId === classId) &&
              (!sectionId || !g.sectionId || g.sectionId === sectionId),
          );
        const matchesDesignation =
          Boolean(resolvedName) && subjectMatchesTeacherTokens(resolvedName, teacherTokens);
        return matchesAssignedId || matchesDesignation;
      }
      return effective.assignments.some(
        (g) =>
          g.classId === classId &&
          (!sectionId || !g.sectionId || g.sectionId === sectionId) &&
          (!g.subjectId || g.subjectId === subjectId),
      );
    };
    return {
      mode: 'live',
      teacherScoped: effective.teacherScoped,
      staffAttendanceSummary: effective.staffAttendanceSummary,
      teacherAttendance: effective.teacherAttendance,
      attendanceGate: effective.attendanceGate,
      selectedDate: date,
      state: effective.state,
      today: effective.today,
      canManage: effective.canManage,
      canCreateTest: !isTeacherScoped && permissions.includes('academics.manage'),
      routeAllowed: portalAccess(permissions, { teacherScoped: effective.teacherScoped }).allowed,
      canMarkAttendance:
        (!effective.attendanceGate?.required || effective.attendanceGate.active) &&
        !effective.attendanceGate?.onLeave &&
        (permissions.includes('student-attendance.manage') ||
          permissions.includes('student-attendance.assigned')),
      canViewStudentProfiles: permissions.includes('students.view'),
      canEditTest: (id) =>
        !isTeacherScoped &&
        permissions.includes('academics.manage') &&
        (effective.state.exams.find((e) => e.id === id)?.canEditDefinition ?? effective.canManage),
      canMarkSubject: isTeacherScoped ? canAccessSubject : undefined,
      unavailable: effective.unavailable,
      refreshDate: setDate,
      getSnapshot: () => latest.current.state,
      async createTest(input) {
        validateNewTest(latest.current.state, input);
        const result = await apiService.request<{ id: string }>(`${root}/exams`, {
          method: 'POST',
          body: {
            ...examBody(input),
            revision: 0,
            requestKey: input.requestKey ?? crypto.randomUUID(),
          },
        });
        await refresh();
        return result.id;
      },
      async updateTest(id, input) {
        validateTestChange(latest.current.state, id, input);
        await apiService.request(`${root}/exams/${id}`, {
          method: 'PUT',
          body: { ...examBody(input), revision: revision(id), requestKey: crypto.randomUUID() },
        });
        await refresh();
      },
      async deleteTest(id) {
        await apiService.request(`${root}/exams/${id}`, {
          method: 'DELETE',
          body: { revision: revision(id) },
        });
        await refresh();
      },
      async saveMarksSheets(id, sheets) {
        sheets.reduce<DemoState>(
          (state, sheet) =>
            validateMarksSheet(
              state,
              id,
              sheet.sectionId,
              sheet.columns,
              sheet.rows,
              sheet.classId,
            ),
          latest.current.state,
        );
        await apiService.request(`${root}/exams/${id}/marks`, {
          method: 'PUT',
          body: { revision: revision(id), sheets },
        });
        await refresh();
      },
      async saveAttendance(day, sectionId, changes, classId) {
        await apiService.request(`${root}/attendance`, {
          method: 'PUT',
          body: {
            date: day,
            classId: classId || effective.state.sections.find((s) => s.id === sectionId)?.classId,
            sectionId,
            rows: Object.entries(changes).map(([enrollmentId, status]) => ({
              enrollmentId,
              status,
              revision: latest.current.attendanceRevisions[`${day}:${enrollmentId}`] || 0,
            })),
          },
        });
        await refresh();
      },
    };
  }, [effective, root, refresh, setDate, date, permissions, owner]);
  function revision(id: string) {
    return latest.current.state.exams.find((e) => e.id === id)?.revision ?? 0;
  }
  return (
    <SchoolFeatureContext.Provider value={feature}>
      {area === 'overview' ? (
        <DashboardPage />
      ) : area === 'academics' ? (
        <AcademicsPage />
      ) : area === 'attendance' ? (
        <AttendancePage />
      ) : (
        <ClassesPage />
      )}
    </SchoolFeatureContext.Provider>
  );
}
function examBody(input: Parameters<SchoolFeatureData['createTest']>[0]) {
  return {
    name: input.name,
    kind: input.kind,
    subjectMaximums: input.subjectMaximums,
    date: input.date,
    classIds: input.classIds || [input.classId],
    sectionIds: input.sectionIds || [],
    sectionlessClassIds: input.sectionlessClassIds || [],
    subjectSelections: input.subjectSelections || [],
  };
}
