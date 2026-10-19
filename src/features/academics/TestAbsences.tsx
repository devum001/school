import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { AppIcon, Badge, Button, Panel, SearchInput } from '../../components/ui/Primitives';
import { testResults } from '../../lib/academics';
import { displayDate } from '../../lib/config';
import { downloadCsv } from '../../lib/download';
import type { Examination, RosterEntry } from '../../types/domain';
import ShareReportDialog from './ShareReportDialog';

export default function TestAbsences({
  exam,
  students,
}: {
  exam: Examination;
  students: RosterEntry[];
}) {
  const state = useSchool();
  const [query, setQuery] = useState('');
  const [recipientId, setRecipient] = useState('');
  const absentIds = new Set(
    testResults(state, exam, students)
      .filter((r) => r.absent)
      .map((r) => r.enrollmentId),
  );
  const absent = students.filter((r) => absentIds.has(r.enrollment.id));
  const rows = absent.filter((r) => r.student.name.toLowerCase().includes(query.toLowerCase()));
  const recipient = absent.find((r) => r.enrollment.id === recipientId);
  return (
    <Panel
      className="test-absence-panel academic-results"
      title="Absent student tracker"
      subtitle={`${exam.name} · ${displayDate(exam.date)} · ${absent.length} absent`}
      action={<Badge tone={absent.length ? 'amber' : 'green'}>{absent.length} absent</Badge>}
    >
      {absent.length ? (
        <>
          <div className="toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Search absent students…" />
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  'test-absences.csv',
                  ['Test', 'Date', 'Student', 'Class', 'Section', 'Roll', 'Status'],
                  rows.map((r) => [
                    exam.name,
                    exam.date,
                    r.student.name,
                    r.className,
                    r.sectionName,
                    r.enrollment.rollNumber,
                    'Absent',
                  ]),
                )
              }
            >
              <AppIcon name="download" size={16} />
              Export absences
            </Button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class / section</th>
                  <th>Parent / guardian</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.enrollment.id}>
                    <td>
                      <Link to={`/students/${r.student.id}?tab=academics`}>
                        <strong>{r.student.name}</strong>
                      </Link>
                      <small>Roll {r.enrollment.rollNumber}</small>
                    </td>
                    <td>
                      {r.className} · {r.sectionName}
                    </td>
                    <td>{r.student.guardian.name}</td>
                    <td>
                      <Button
                        className="whatsapp-share"
                        variant="secondary"
                        aria-label={`Notify parent of ${r.student.name}`}
                        onClick={() => setRecipient(r.enrollment.id)}
                      >
                        <AppIcon name="send" size={16} />
                        Notify parent
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p className="test-attendance-note">No absent students match this search.</p>
          )}
          <p className="test-attendance-note">
            Listed A–Z. WhatsApp opens a Hindi notice for you to send; delivery is not tracked here.
          </p>
        </>
      ) : (
        <p className="test-attendance-note">
          No students marked absent for this test. Use Enter / edit marks to record an absence;
          pending marks are kept separate.
        </p>
      )}
      {recipient && (
        <ShareReportDialog
          row={recipient}
          exams={[exam]}
          selectedExamId={exam.id}
          absenceExam={exam}
          onClose={() => setRecipient('')}
        />
      )}
    </Panel>
  );
}
