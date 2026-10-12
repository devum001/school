import { useSyncExternalStore } from 'react';
import { repository } from '../lib/repository';
export const useSchool = () => useSyncExternalStore(repository.subscribe, repository.getSnapshot);
