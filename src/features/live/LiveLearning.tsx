import { portalAccess } from './portalAccess';
import type { DemoState } from '../../types/domain';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { useLiveSchool } from './schoolContext';
import { useRemote } from './useRemote';

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
  permissions,
  area,
  schoolId,
  yearId,
  date,
  setDate,
}: {
  initial: LearningSnapshot;
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
  const feature = useMemo<SchoolFeatureData>(
    () => ({
      mode: 'live',
      selectedDate: date,
      state: effective.state,
      today: effective.today,
      canManage: effective.canManage,
      routeAllowed: portalAccess(permissions).allowed,
      canMarkAttendance:
        permissions.includes('student-attendance.manage') ||
        permissions.includes('student-attendance.assigned'),
      canViewStudentProfiles: permissions.includes('students.view'),
      canEditTest: (id) =>
        effective.state.exams.find((e) => e.id === id)?.canEditDefinition ?? effective.canManage,
      canMarkSubject: (classId, sectionId, subjectId) =>
        permissions.includes('academics.manage') ||
        effective.assignments.some(
          (g) =>
            g.classId === classId &&
            g.sectionId === sectionId &&
            (!g.subjectId || g.subjectId === subjectId),
        ),
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
    }),
    [effective, root, refresh, setDate, date, permissions],
  );
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
