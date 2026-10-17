import type { DemoState } from '../types/domain';
import { orderedClasses } from './schoolLabels';
import { testKinds } from './academics';

export function academicContextFor(state: DemoState, params: URLSearchParams) {
  const classes = orderedClasses(state.classes.filter((item) => item.schoolId === state.school.id));
  const classId =
    classes.find((item) => item.id === params.get('class'))?.id ?? classes[0]?.id ?? '';
  const sectionId =
    state.sections.find(
      (item) =>
        item.schoolId === state.school.id &&
        item.classId === classId &&
        item.id === params.get('section'),
    )?.id ?? '';
  const kind = testKinds.find((item) => item === params.get('kind')) ?? '';
  const requestedMonth = params.get('month') ?? '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : '';
  const requestedLimit = Number(params.get('limit') ?? '10');
  return {
    classId,
    sectionId,
    kind,
    month,
    examId: params.get('test') ?? '',
    tab: params.get('view') === 'rankings' ? 'rankings' : 'tests',
    query: (params.get('q') ?? '').slice(0, 100),
    limit:
      Number.isInteger(requestedLimit) && requestedLimit >= 10 ? Math.min(500, requestedLimit) : 10,
  };
}

export function studentReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.includes('\\')) return null;
  try {
    const url = new URL(value, 'https://schoolwell.local');
    return url.origin === 'https://schoolwell.local' && /^\/students\/[^/]+$/.test(url.pathname)
      ? `${url.pathname}${url.search}`
      : null;
  } catch {
    return null;
  }
}

export function studentHistoryUrl(studentId: string, examId?: string, from?: string): string {
  const params = new URLSearchParams({ tab: 'academics' });
  if (examId) params.set('exam', examId);
  if (from) params.set('from', from);
  return `/students/${encodeURIComponent(studentId)}?${params}`;
}
