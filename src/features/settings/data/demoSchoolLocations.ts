import { repository } from '../../../lib/repository';
import type { SchoolLocationSource } from '../../../services/schoolLocationService';
export const demoSchoolLocations: SchoolLocationSource = {
  async load() {
    return (
      repository.getSnapshot().school.locationPolicy ?? {
        revision: 0,
        maxAccuracy: 50,
        locations: [],
      }
    );
  },
  async save(policy) {
    repository.saveSchoolLocations(policy);
    return repository.getSnapshot().school.locationPolicy!;
  },
};
