import { examIncludes } from './academicSheets';
import { subjectName } from './classSubjects';
import type { DemoState, Examination, RosterEntry } from '../types/domain';
import { displayHindiDate } from './config';
import { resultSummary } from './selectors';

/** WhatsApp requires international digits, without the plus sign or separators. */
export function whatsappPhone(value: string): string | null {
  const input = value.trim();
  if (!input || !/^\+?[\d\s().-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits) && !input.startsWith('+')) return `91${digits}`;
  if (digits.startsWith('91')) return /^91[6-9]\d{9}$/.test(digits) ? digits : null;
  if (input.startsWith('+') && /^[1-9]\d{7,14}$/.test(digits)) return digits;
  return null;
}

export function studentReportMessage(
  state: DemoState,
  row: RosterEntry,
  exams: Examination[],
): string {
  const reports = exams
    .filter(
      (exam) =>
        exam.schoolId === state.school.id &&
        exam.academicYearId === row.enrollment.academicYearId &&
        (!exam.classId || exam.classId === row.enrollment.classId) &&
        examIncludes(exam, row.enrollment.classId, row.enrollment.sectionId),
    )
    .flatMap((exam) => {
      const result = state.results.find(
        (r) =>
          r.schoolId === state.school.id &&
          r.enrollmentId === row.enrollment.id &&
          r.examId === exam.id,
      );
      if (!result || !resultSummary(result).maximum) return [];
      const summary = resultSummary(result);
      return [
        {
          summary,
          text: [
            `*${exam.name}*`,
            `दिनांक: ${displayHindiDate(exam.date)}`,
            ...(result.absent
              ? ['स्थिति: अनुपस्थित']
              : result.subjects.map(
                  (s) =>
                    `${subjectName(state, row.enrollment.classId, s)}: ${s.pending ? 'लंबित' : s.absent ? 'अनुपस्थित' : `${s.marks} / ${s.maxMarks}`}`,
                )),
            `कुल अंक: ${summary.marks} / ${summary.maximum}`,
            `प्रतिशत: ${summary.percentage}%${result.absent ? '' : ` · ग्रेड: ${summary.grade}`}`,
          ].join('\n'),
        },
      ];
    });
  if (!reports.length) return '';
  const marks = reports.reduce((n, r) => n + r.summary.marks, 0);
  const maximum = reports.reduce((n, r) => n + r.summary.maximum, 0);
  return [
    `*${state.school.name}*`,
    'आदरणीय अभिभावक,',
    `आपके बच्चे ${row.student.name} की परीक्षा रिपोर्ट प्रस्तुत है।\nकक्षा: ${row.className} · अनुभाग: ${row.sectionName}\nरोल नंबर: ${row.enrollment.rollNumber} · सत्र: ${state.academicYear.name}`,
    ...reports.map((r) => r.text),
    ...(reports.length > 1
      ? [
          `*समग्र परिणाम*: ${marks} / ${maximum} (${((maximum ? marks / maximum : 0) * 100).toFixed(1)}%)\nकेवल दर्ज परिणाम शामिल हैं; लंबित अंक शामिल नहीं हैं।`,
        ]
      : []),
    'कृपया प्रगति पर चर्चा के लिए कक्षा शिक्षक से संपर्क करें।\nधन्यवाद।',
  ].join('\n\n');
}

export function whatsappReportUrl(message: string, phone = ''): string {
  const number = phone.trim() ? whatsappPhone(phone) : '';
  if (number === null)
    throw new Error(
      'Enter a valid Indian mobile number or an international number starting with +.',
    );
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function testAbsenceMessage(state: DemoState, row: RosterEntry, exam: Examination): string {
  if (
    exam.schoolId !== state.school.id ||
    exam.academicYearId !== row.enrollment.academicYearId ||
    (exam.classId && exam.classId !== row.enrollment.classId) ||
    !examIncludes(exam, row.enrollment.classId, row.enrollment.sectionId)
  )
    return '';
  const absent = state.results.some(
    (result) =>
      result.schoolId === state.school.id &&
      result.examId === exam.id &&
      result.enrollmentId === row.enrollment.id &&
      result.absent,
  );
  if (!absent) return '';
  const kinds: Record<string, string> = {
    'Daily test': 'दैनिक परीक्षा',
    'Monthly test': 'मासिक परीक्षा',
    'Pre-board': 'प्री-बोर्ड परीक्षा',
    'Term exam': 'सत्र परीक्षा',
  };
  const kind = kinds[exam.kind] ?? (exam.kind || 'परीक्षा');
  return `*${state.school.name}*\n\nआदरणीय अभिभावक,\n\nआपके बच्चे ${row.student.name} को दिनांक ${displayHindiDate(exam.date)} को आयोजित ${kind} में अनुपस्थित दर्ज किया गया है।\n\nपरीक्षा: ${exam.name}\nकक्षा: ${row.className} · अनुभाग: ${row.sectionName}\nरोल नंबर: ${row.enrollment.rollNumber}\n\nकृपया अनुपस्थिति का कारण कक्षा शिक्षक को बताएं और अगली प्रक्रिया की जानकारी प्राप्त करें। यदि यह जानकारी सही नहीं है, तो विद्यालय कार्यालय से संपर्क करें।\n\nधन्यवाद,\n${state.school.name}`;
}
