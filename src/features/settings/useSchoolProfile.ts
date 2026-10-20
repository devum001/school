import { useCallback, useEffect, useState } from 'react';
import { getSchoolProfile, type SchoolProfile } from '../../services/schoolProfileService';
import { apiService, isCancelled } from '../../services/apiService';
type Result = {
  schoolId: string;
  status: 'loading' | 'success' | 'error';
  data?: SchoolProfile;
  error?: string;
};
export function useSchoolProfile(schoolId: string) {
  const [result, setResult] = useState<Result>({ schoolId, status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getSchoolProfile(schoolId, controller.signal).then(
      (data) => {
        if (active) setResult({ schoolId, status: 'success', data });
      },
      (error) => {
        if (active && !isCancelled(error))
          setResult({
            schoolId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unable to load the school profile.',
          });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [schoolId, attempt]);
  const retry = useCallback(() => {
    apiService.invalidateReads();
    setResult({ schoolId, status: 'loading' });
    setAttempt((value) => value + 1);
  }, [schoolId]);
  return {
    ...(result.schoolId === schoolId ? result : { schoolId, status: 'loading' as const }),
    retry,
  };
}
