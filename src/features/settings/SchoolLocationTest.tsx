import { useEffect, useRef, useState } from 'react';
import { Button, Panel } from '../../components/ui/Primitives';
import { currentPosition } from '../../services/deviceLocation';
import { punchLocationFeedback, type LocationReading } from '../hr/punchLocationFeedback';
import type { SchoolLocations } from '../../lib/schoolLocations';
export default function SchoolLocationTest({ policy }: { policy: SchoolLocations }) {
  const [reading, setReading] = useState<LocationReading>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const feedback = reading ? punchLocationFeedback(reading, policy) : null;
  return (
    <Panel
      title="Test saved locations"
      subtitle="Check this device against your saved campus areas. This does not record attendance."
    >
      <div className="school-location-test-body">
        <Button
          disabled={busy || !policy.locations.length}
          onClick={async () => {
            request.current?.abort();
            const controller = new AbortController();
            request.current = controller;
            setBusy(true);
            setReading(undefined);
            setError('');
            try {
              const position = await currentPosition({
                maxAccuracy: policy.maxAccuracy,
                waitForAccuracy: false,
                timeoutMs: 5000,
                signal: controller.signal,
              });
              if (!controller.signal.aborted)
                setReading({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  capturedAt: position.timestamp,
                });
            } catch (cause) {
              if (!controller.signal.aborted)
                setError(cause instanceof Error ? cause.message : 'Unable to check this device.');
            } finally {
              if (!controller.signal.aborted) setBusy(false);
            }
          }}
        >
          {busy ? 'Checking device location…' : 'Test current location'}
        </Button>
        {busy && <p role="status">Checking the first available reading, up to 5 seconds.</p>}
        {feedback && (
          <div
            className={`school-location-test ${feedback.ok ? 'verified' : 'uncertain'}`}
            role="status"
          >
            <strong>{feedback.title}</strong>
            <p>Result at the time of this check. Check again after moving.</p>
            <p>{feedback.message}</p>
            {feedback.campus && (
              <p>
                Device reading: ±{Math.round(reading!.accuracy)} m · Approximately{' '}
                {Math.round(feedback.campus.distance)} m from {feedback.campus.name}
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
    </Panel>
  );
}
