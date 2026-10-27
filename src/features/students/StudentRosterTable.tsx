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
  const handleRowKeyDown = (
    e: React.KeyboardEvent<HTMLTableRowElement>,
    index: number,
    rowId: string,
  ) => {
    const table = e.currentTarget.closest('table');
    if (!table) return;
    const allRows = Array.from(table.querySelectorAll('tbody tr'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = allRows[index + 1];
      if (next) (next as HTMLElement).focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = allRows[index - 1];
      if (prev) (prev as HTMLElement).focus();
    } else if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'BUTTON' && target.tagName !== 'A') {
        e.preventDefault();
        onEdit?.(rowId);
      }
    }
  };

  return (
    <div className="table-wrap" role="region" aria-label="Class students">
      <table className="roster-grid-table">
        <thead>
          <tr>
            <th className="mono">Roll no.</th>
            <th>Student</th>
            <th>Class</th>
            <th>Section</th>
            <th className="mono">Admission no.</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => (
            <tr
              key={r.id}
              tabIndex={0}
              className="clickable-roster-row"
              title="Click or press Enter to edit student"
              onKeyDown={(e) => handleRowKeyDown(e, index, r.id)}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('button') && !target.closest('a')) {
                  onEdit?.(r.id);
                }
              }}
            >
              <td className="mono">{r.rollNumber ?? '—'}</td>
              <td>
                <Link
                  className="text-link"
                  to={studentHref(r.studentId)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.name}
                </Link>
              </td>
              <td>{r.className ?? '—'}</td>
              <td>{sectionLabel(r.sectionName)}</td>
              <td className="mono muted">{r.code}</td>
              <td>
                <Badge tone={r.status === 'active' ? 'green' : 'neutral'}>
                  {r.status === 'withdrawn' ? 'Inactive' : r.status}
                </Badge>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {onEdit && (
                    <Button
                      variant="ghost"
                      aria-label={`Edit student ${r.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(r.id);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(r.id);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
