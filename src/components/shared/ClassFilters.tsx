import { useSchool } from '../../app/useSchool';
import { orderedClasses, sectionLabel } from '../../lib/schoolLabels';
export function ClassFilters({
  classId,
  sectionId,
  onClassChange,
  onSectionChange,
  allowAll = true,
}: {
  classId: string;
  sectionId?: string;
  onClassChange: (v: string) => void;
  onSectionChange?: (v: string) => void;
  allowAll?: boolean;
}) {
  const state = useSchool();
  return (
    <>
      <label className="filter-label">
        <span>Class</span>
        <select aria-label="Class" value={classId} onChange={(e) => onClassChange(e.target.value)}>
          {allowAll && <option value="">All classes</option>}
          {orderedClasses(state.classes).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {onSectionChange && (
        <label className="filter-label">
          <span>Section</span>
          <select
            aria-label="Section"
            value={sectionId}
            onChange={(e) => onSectionChange(e.target.value)}
          >
            {allowAll && <option value="">All sections</option>}
            {state.sections
              .filter((s) => !classId || s.classId === classId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {!classId ? `${state.classes.find((c) => c.id === s.classId)?.name} · ` : ''}
                  {sectionLabel(s.name)}
                </option>
              ))}
          </select>
        </label>
      )}
    </>
  );
}
