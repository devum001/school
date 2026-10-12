import { useToday } from '../../app/useToday';
import { displayDate } from '../../lib/config';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, RotateCcw, ShieldCheck, Building2, LockKeyhole } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Badge, Button, Modal, PageHeading, Panel } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
export default function SettingsPage() {
  const state = useSchool();
  const today = useToday();
  const notify = useFeedback();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <PageHeading
        eyebrow="YOUR SCHOOL’S FOUNDATION"
        title="School settings"
        description="School identity, academic context, and workspace preferences."
      />
      <div className="settings-grid">
        <Panel title="School identity" subtitle="School profile and academic information">
          <div className="school-branding">
            <span className="brand-mark">
              <GraduationCap size={34} />
            </span>
            <div>
              <h2>{state.school.name}</h2>
              <p>{state.school.motto}</p>
              <Badge tone="blue">School workspace</Badge>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>
                <Building2 size={15} />
                Location
              </dt>
              <dd>{state.school.city}</dd>
            </div>
            <div>
              <dt>Academic year</dt>
              <dd>{state.academicYear.name}</dd>
            </div>
            <div>
              <dt>Today’s date</dt>
              <dd>{displayDate(today)}</dd>
            </div>
            <div>
              <dt>Available classes</dt>
              <dd>{state.classes.map((c) => c.name).join(', ')}</dd>
            </div>
            <div>
              <dt>Sections</dt>
              <dd>A and B in every class</dd>
            </div>
          </dl>
          <div className="panel-padding">
            <Link className="button secondary" to="/classes">
              Explore classes & teachers
            </Link>
          </div>
        </Panel>
        <div>
          <Panel title="Account & access" subtitle="Principal workspace">
            <div className="panel-padding">
              <div className="info-banner">
                <ShieldCheck size={20} />
                <span>
                  Dr. Nandita Rao · Principal
                  <br />
                  {state.school.name}
                </span>
              </div>
              <p className="settings-copy">
                Manage your school’s academic context and review the available account settings.
              </p>
              <div className="disabled-setting">
                <LockKeyhole size={16} />
                <span>Manage roles & permissions</span>
                <Badge>Not available</Badge>
              </div>
              <div className="disabled-setting">
                <LockKeyhole size={16} />
                <span>School branding & profile editing</span>
                <Badge>Not available</Badge>
              </div>
            </div>
          </Panel>
          <Panel title="Workspace data" subtitle="Manage your school workspace">
            <div className="panel-padding">
              <p className="settings-copy">
                Reset restores the initial students, teachers, assignments, attendance, payments,
                test results, and notification records. Changes made in this workspace will be
                removed.
              </p>
              <Button variant="secondary" onClick={() => setConfirm(true)}>
                <RotateCcw size={16} />
                Reset workspace data
              </Button>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset this workspace?"
        description="This removes student and teacher changes, added tests, edited marks, attendance changes, recorded payments, and notification history, then restores all initial records."
      >
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Keep current data
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              try {
                repository.reset();
                setConfirm(false);
                notify('Workspace data restored.');
              } catch {
                setError('Browser storage is unavailable. Reset could not be saved.');
                setConfirm(false);
              }
            }}
          >
            Reset workspace data
          </Button>
        </div>
      </Modal>
    </>
  );
}
