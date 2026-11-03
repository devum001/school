import { useContext, useMemo, useSyncExternalStore } from 'react';
import { SchoolFeatureContext } from './schoolFeatureContext';
import { repository } from '../lib/repository';
import { titleCase } from '../lib/displayFormat';

export function useSchool() {
  const feature = useContext(SchoolFeatureContext);
  const state = useSyncExternalStore(
    feature ? () => () => {} : repository.subscribe,
    feature
      ? () => feature.state
      : () => {
          return repository.getSnapshot();
        },
  );
  return useMemo(
    () => ({
      ...state,
      students: state.students.map((s) => ({
        ...s,
        name: titleCase(s.name),
        address: titleCase(s.address ?? ''),
        guardian: {
          ...s.guardian,
          name: titleCase(s.guardian.name),
          relation: titleCase(s.guardian.relation),
        },
      })),
      teachers: state.teachers.map((t) => ({
        ...t,
        name: titleCase(t.name),
        qualification: titleCase(t.qualification),
      })),
    }),
    [state],
  );
}
