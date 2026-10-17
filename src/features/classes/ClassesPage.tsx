import { useToday } from '../../app/useToday';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, CalendarCheck } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { Avatar, Badge, PageHeading, SearchInput } from '../../components/ui/Primitives';
import { roster, attendanceSummary, statusFor } from '../../lib/selectors';
import { orderedClasses, sectionLabel } from '../../lib/schoolLabels';
export default function ClassesPage() {
  const state = useSchool();
  const today = useToday();
  const [query, setQuery] = useState('');
  const rows = roster(state);
  return (
    <>
      <PageHeading
        eyebrow="ROOM TO GROW"
        title="Classes & sections"
        description="Your classrooms, teachers, and learners — thoughtfully organized."
        actions={
          <SearchInput value={query} onChange={setQuery} placeholder="Search grade or teacher…" />
        }
      />
      <div className="context-strip">
        <span>
          <BookOpen size={16} />
          {state.classes.length} grades
        </span>
        <span>
          <Users size={16} />
          {state.sections.length} sections · {rows.length} active students
        </span>
        <Badge tone="blue">{state.academicYear.name}</Badge>
      </div>
      <div className="classes-grid">
        {orderedClasses(state.classes)
          .filter((c) =>
            `${c.name} ${state.sections
              .filter((s) => s.classId === c.id)
              .map((s) => state.teachers.find((t) => t.id === s.teacherId)?.name)
              .join(' ')}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((c) => (
            <section className="panel class-card" key={c.id}>
              <div className="class-card-heading">
                <span className="grade-number">{c.name.replace('Grade ', '')}</span>
                <div>
                  <h2>{c.name}</h2>
                  <p>
                    {state.sections.filter((s) => s.classId === c.id).length} sections ·{' '}
                    {rows.filter((r) => r.enrollment.classId === c.id).length} students
                  </p>
                </div>
                <Link to={`/students?class=${c.id}`} aria-label={`View ${c.name} students`}>
                  <ArrowRight size={18} />
                </Link>
              </div>
              {state.sections
                .filter((s) => s.classId === c.id)
                .map((s) => {
                  const sectionRows = rows.filter((r) => r.enrollment.sectionId === s.id);
                  const summary = attendanceSummary(
                    sectionRows.map((r) => statusFor(state, r.enrollment.id, today)),
                  );
                  const teacher = state.teachers.find((t) => t.id === s.teacherId);
                  return (
                    <div className="section-card" key={s.id}>
                      <div className="split-line">
                        <Link className="text-link" to={`/students?class=${c.id}&section=${s.id}`}>
                          {sectionLabel(s.name)} <ArrowRight size={13} />
                        </Link>
                        <Badge>{sectionRows.length} students</Badge>
                      </div>
                      <div className="person">
                        <Avatar name={teacher?.name ?? 'Not assigned'} />
                        <span>
                          <strong>{teacher?.name ?? 'Class teacher not assigned'}</strong>
                          <small>
                            {teacher
                              ? `Class teacher · ${teacher.subject}`
                              : 'Assign a teacher from Teachers'}
                          </small>
                        </span>
                      </div>
                      <div className="split-line">
                        <span className="muted">
                          {summary.attended}/{summary.marked} attending · {summary.unmarked}{' '}
                          unmarked
                        </span>
                        <Link
                          className="text-link"
                          to={`/attendance?class=${c.id}&section=${s.id}`}
                        >
                          <CalendarCheck size={14} />
                          Register
                        </Link>
                      </div>
                    </div>
                  );
                })}
            </section>
          ))}
      </div>
      {state.classes.filter((c) =>
        `${c.name} ${state.sections
          .filter((s) => s.classId === c.id)
          .map((s) => state.teachers.find((t) => t.id === s.teacherId)?.name)
          .join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ).length === 0 && <div className="empty-state">No classes or teachers match “{query}”.</div>}
    </>
  );
}
