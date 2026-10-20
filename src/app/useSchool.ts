import { useContext, useMemo, useSyncExternalStore } from 'react';
import { appMode } from '../services/runtimeConfig';
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
          if (appMode === 'live') throw new Error('A live school data adapter is required.');
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
