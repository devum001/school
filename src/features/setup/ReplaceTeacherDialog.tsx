import { useCallback, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, LoadingOverlay, Modal } from '../../components/ui/Primitives';
import { onboardingApi, type Relation } from '../../services/onboardingService';
import { accessError } from '../../services/schoolAccessService';
import { useSetupList } from './useSetupList';
import { LoadState, Paging } from './SetupControls';
import './assignments.css';

export default function ReplaceTeacherDialog({
  schoolId,
  yearId,
  assignment,
  close,
  saved,
}: {
  schoolId: string;
  yearId: string;
  assignment: Relation;
  close: () => void;
  saved: () => void;
}) {
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState('');
  const [teacherId, setTeacherId] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const load = useCallback(
    (signal: AbortSignal, after?: string) =>
      onboardingApi.people(schoolId, 'staff', signal, after, query),
    [schoolId, query],
  );
  const staff = useSetupList(load);
  const candidates =
    staff.data?.items.filter(
      (p) => p.teaching && p.status === 'active' && p.id !== assignment.personId,
    ) ?? [];
  const teacher = candidates.find((p) => p.id === teacherId);
  return (
    <Modal
      open
      title="Replace teacher"
      description="Transfer this assignment to another teacher."
      onClose={() => {
        if (!busy) close();
      }}
    >
      <LoadingOverlay
        local
        loading={staff.loading || busy}
        label={busy ? 'Replacing teacher…' : 'Loading teachers…'}
      >
        <div className="replacement-content">
          <div className="replacement-context">
            <strong>
              {assignment.className} · {assignment.sectionName || 'Whole class'}
            </strong>
            <span>{assignment.subjectName}</span>
          </div>
          <form
            className="replacement-search"
            onSubmit={(e) => {
              e.preventDefault();
              setTeacherId('');
              staff.first();
              setQuery(search);
            }}
          >
            <label className="field">
              Find replacement
              <input
                value={search}
                maxLength={80}
                placeholder="Teacher name or employee ID"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Button variant="secondary" disabled={busy}>
              Search
            </Button>
          </form>
          <LoadState loading={false} error={staff.error} retry={staff.reload} />
          <form
            className="replacement-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!teacher) return;
              setBusy(true);
              setError('');
              try {
                await onboardingApi.assignBatch(schoolId, yearId, [
                  {
                    replaceId: assignment.id,
                    revision: assignment.revision,
                    staffId: teacher.id,
                    classId: assignment.classId!,
                    sectionId: assignment.sectionId || '',
                    subjectId: assignment.subjectId!,
                  },
                ]);
                saved();
                close();
              } catch (cause) {
                setError(accessError(cause));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Replacement teacher
              <select
                required
                value={teacherId}
                disabled={busy || staff.loading}
                onChange={(e) => setTeacherId(e.target.value)}
              >
                <option value="">Choose a teacher</option>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.code}
                  </option>
                ))}
              </select>
            </label>
            {!staff.loading && !staff.error && !candidates.length && (
              <p>No other active teachers match. Try another search.</p>
            )}
            <Paging {...staff} nextCursor={staff.data?.nextCursor} />
            <div className="replacement-preview">
              <div>
                <small>Current teacher</small>
                <strong>{assignment.name}</strong>
              </div>
              <ArrowRight size={20} aria-hidden="true" />
              <div>
                <small>New teacher</small>
                <strong>{teacher?.name || 'Select above'}</strong>
              </div>
            </div>
            <p className="replacement-note">
              The class, section and subject stay the same. The new teacher keeps all their other
              assignments.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="replacement-actions">
              <Button type="button" variant="secondary" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button disabled={busy || !teacher || !!staff.error}>Confirm replacement</Button>
            </div>
          </form>
        </div>
      </LoadingOverlay>
    </Modal>
  );
}
