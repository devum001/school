import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Panel } from '../../components/ui/Primitives';
import type { SchoolAccess } from '../../services/schoolAccessService';
import ClassStructureView from './ClassStructureView';
import ClassStructureSettings from './ClassStructureSettings';
import { liveClassSource } from './data/liveClassSettings';
import LiveStudents from '../students/LiveStudents';
export default function LiveClassStructure({
  access,
  yearId,
}: {
  access: SchoolAccess;
  yearId: string | null;
}) {
  const source = useMemo(() => (yearId ? liveClassSource(access, yearId) : null), [access, yearId]);
  if (!source || !yearId)
    return (
      <ClassStructureView
        classes={[]}
        sections={[]}
        teachers={[]}
        counts={[]}
        canManageClasses={false}
        canManageSections={false}
        renderStudents={() => null}
        renderSubjects={() => null}
        renderEditor={() => null}
        remove={() => undefined}
        emptyHelper={
          <Panel title="Select an academic year">
            <p>An academic year is required for class settings.</p>
            <Link to="/settings?tab=Preferences&section=context">Academic year preferences</Link>
          </Panel>
        }
      />
    );
  return (
    <ClassStructureSettings
      source={source}
      permissions={access.permissions}
      renderStudents={(id, changed) => (
        <LiveStudents key={id} access={access} yearId={yearId} classId={id} onChanged={changed} />
      )}
    />
  );
}
