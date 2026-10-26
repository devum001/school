import { sectionLabel } from '../../lib/schoolLabels';
import { Link } from 'react-router-dom';
import { Button, Badge } from '../../components/ui/Primitives';
export type RosterTableRow = {
  id: string;
  studentId: string;
  name: string;
  code: string;
  className?: string;
  sectionName: string;
  rollNumber: string | number | null;
  status: string;
};
export default function StudentRosterTable({
  rows,
  onEdit,
  onDelete,
  studentHref = (id: string) => `/students/${id}`,
}: {
  rows: RosterTableRow[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  studentHref?: (id: string) => string;
}) {
  return (
    <div className="table-wrap" role="region" aria-label="Class students" tabIndex={0}>
      <table>
        <thead>
          <tr>
            <th>Roll no.</th>
            <th>Student</th>
            <th>Class</th>
            <th>Section</th>
            <th>Admission no.</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.rollNumber ?? '—'}</td>
              <td>
                <Link className="text-link" to={studentHref(r.studentId)}>
                  {r.name}
                </Link>
              </td>
              <td>{r.className ?? '—'}</td>
              <td>{sectionLabel(r.sectionName)}</td>
              <td>{r.code}</td>
              <td>
                <Badge tone={r.status === 'active' ? 'green' : 'neutral'}>
                  {r.status === 'withdrawn' ? 'Inactive' : r.status}
                </Badge>
              </td>
              <td>
                {onEdit && (
                  <Button
                    variant="ghost"
                    aria-label={`Edit student ${r.name}`}
                    onClick={() => onEdit(r.id)}
                  >
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button variant="ghost" onClick={() => onDelete(r.id)}>
                    Delete
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
