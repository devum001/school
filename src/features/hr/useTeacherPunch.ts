import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService, ApiError } from '../../services/apiService';
import {
  announcePunch,
  currentPosition,
  loadTeacherPunch,
  type TeacherPunchStatus,
} from '../../services/teacherPunchService';
import { punchLocationFeedback, type LocationReading } from './punchLocationFeedback';

export function useTeacherPunch(schoolId: string) {
  const [data, setData] = useState<TeacherPunchStatus>();
  const [busy, setBusy] = useState<'location' | 'punch' | null>(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState<LocationReading>();
  const [clockOffset, setClockOffset] = useState(0);
  const pending = useRef<{ kind: 'in' | 'out'; key: string } | null>(null);
  const mounted = useRef(true);
  const busyRef = useRef(false),
    sequence = useRef(0),
    lastRead = useRef(0);
  const refresh = useCallback(
    async (fresh = true, signal?: AbortSignal) => {
      const request = ++sequence.current;
      try {
        const next = await loadTeacherPunch(schoolId, fresh, signal);
        if (!signal?.aborted && request === sequence.current) {
          setData(next);
          setClockOffset(Date.parse(next.serverNow) - Date.now());
          lastRead.current = Date.now();
        }
        return next;
      } catch (cause) {
        if (!signal?.aborted && request === sequence.current)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to read your attendance. Please retry.',
          );
        return undefined;
      }
    },
    [schoolId],
  );
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) void refresh(true, controller.signal);
    });
    const focus = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastRead.current > 30000 &&
        !busyRef.current
      )
        void refresh(true, controller.signal);
    };
    window.addEventListener('focus', focus);
    const timer = window.setInterval(focus, 60000);
    return () => {
      mounted.current = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [refresh]);
  const act = async (save: boolean) => {
    if (busyRef.current || (save && !data?.state.allowed)) return;
    busyRef.current = true;
    setBusy(save ? 'punch' : 'location');
    setError('');
    let latest: LocationReading | undefined;
    try {
      const position = await currentPosition();
      if (!mounted.current) return;
      latest = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: position.timestamp,
      };
      setReading(latest);
      if (save && data) {
        const kind = data.state.nextKind;
        if (pending.current?.kind !== kind) pending.current = { kind, key: crypto.randomUUID() };
        await apiService.request(`/schools/${schoolId}/hr/punch`, {
          method: 'POST',
          body: { requestKey: pending.current.key, kind, ...latest },
        });
        pending.current = null;
        await refresh();
        announcePunch(schoolId);
      }
    } catch (cause) {
      const updated = save ? await refresh() : data;
      const feedback =
        latest && updated ? punchLocationFeedback(latest, updated.locationPolicy) : undefined;
      setError(
        cause instanceof ApiError && cause.code === 'HR_LOCATION'
          ? feedback && !feedback.ok
            ? feedback.message
            : 'The school could not verify this location. Check again, ensure your device date and time are automatic, or ask your administrator to review the campus pin and accuracy rule.'
          : cause instanceof Error
            ? cause.message
            : 'Unable to confirm your punch. Check your connection and retry.',
      );
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };
  return { data, busy, error, reading, clockOffset, refresh, act };
}
