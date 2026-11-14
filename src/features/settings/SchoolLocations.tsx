import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { Button, LoadingOverlay, Panel } from '../../components/ui/Primitives';
import type { SchoolLocationSource } from '../../services/schoolLocationService';
import { liveSchoolLocations } from '../../services/schoolLocationService';
import {
  schoolLocationsSchema,
  type Campus,
  type SchoolLocations as LocationPolicy,
} from '../../lib/schoolLocations';
import { useRemote } from '../live/useRemote';
import { HrForm, TextField } from '../hr/HrForms';
import SchoolLocationTest from './SchoolLocationTest';
import './school-locations.css';
const CampusLocationPicker = lazy(() => import('../hr/CampusLocationPicker'));
export function LiveSchoolLocations({
  schoolId,
  canManage,
}: {
  schoolId: string;
  canManage: boolean;
}) {
  const source = useMemo(() => liveSchoolLocations(schoolId), [schoolId]);
  return <SchoolLocations source={source} canManage={canManage} />;
}
export default function SchoolLocations({
  source,
  canManage = true,
}: {
  source: SchoolLocationSource;
  canManage?: boolean;
}) {
  const load = useCallback((signal: AbortSignal) => source.load(signal), [source]);
  const state = useRemote(load);
  const [edit, setEdit] = useState<number | null>(null);
  const [remove, setRemove] = useState<number | null>(null);
  return (
    <div className="school-locations-stack">
      <LoadingOverlay local loading={state.loading} label="Loading school locations…">
        {state.error ? (
          <Panel>
            <p role="alert">{state.error}</p>
            <Button onClick={state.reload}>Retry locations</Button>
          </Panel>
        ) : (
          state.data && (
            <>
              <Panel
                title="School Location"
                subtitle="Set the campus centre and allowed radius for teacher punch-in and punch-out."
                action={
                  canManage && (
                    <Button
                      disabled={state.data.locations.length >= 10}
                      onClick={() => setEdit(-1)}
                    >
                      Add location
                    </Button>
                  )
                }
              >
                {!state.data.locations.length && (
                  <p className="panel-note">
                    No school location has been saved. Add a campus using the map or coordinates.
                  </p>
                )}
                <div className="school-location-list">
                  {state.data.locations.map((location, index) => (
                    <article key={index} className="school-location-summary">
                      <div>
                        <h3>{location.name}</h3>
                        <p>
                          {location.latitude}, {location.longitude}
                        </p>
                        <p>
                          {location.radius} m allowed radius · Device accuracy: ±
                          {state.data!.maxAccuracy} m or better
                        </p>
                      </div>
                      <div className="school-location-actions">
                        <a
                          className="button secondary"
                          href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on Google Maps
                        </a>
                        {canManage && (
                          <>
                            <Button variant="secondary" onClick={() => setEdit(index)}>
                              Edit location
                            </Button>
                            <Button variant="ghost" onClick={() => setRemove(index)}>
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {!canManage && (
                  <p className="panel-note">
                    Your role can view school locations but cannot edit them.
                  </p>
                )}
              </Panel>
              <Panel title="Get coordinates from your phone">
                <ol className="school-location-help">
                  <li>
                    At school, enable precise location on your phone. Open Google Maps and use the
                    current-location button to find yourself.
                  </li>
                  <li>
                    Touch and hold the school building to drop a pin. Open its details and copy the
                    decimal coordinates — latitude first, longitude second.
                  </li>
                  <li>
                    On this page, add or edit a location and paste the pair, such as{' '}
                    <code>27.9871488, 73.3216768</code>. Check the map pin and radius, then save.
                  </li>
                </ol>
                <p className="panel-note">
                  You can also open this page on your phone and use “Use current location”. Save
                  there to update the same school on your laptop.{' '}
                  <a
                    href="https://support.google.com/maps/answer/18539"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Maps coordinate help
                  </a>
                </p>
              </Panel>
              <SchoolLocationTest key={state.data.revision} policy={state.data} />
            </>
          )
        )}
      </LoadingOverlay>
      {state.data && edit !== null && (
        <LocationEditor
          policy={state.data}
          index={edit}
          source={source}
          close={() => setEdit(null)}
          saved={() => {
            setEdit(null);
            state.reload();
          }}
        />
      )}
      {state.data && remove !== null && (
        <HrForm
          title="Remove school location?"
          description={`Remove ${state.data.locations[remove].name} from the permitted punch areas.`}
          close={() => setRemove(null)}
          submitLabel="Remove location"
          submit={async () => {
            await source.save({
              ...state.data!,
              locations: state.data!.locations.filter((_, i) => i !== remove),
            });
            setRemove(null);
            state.reload();
          }}
        >
          <p>
            {state.data.locations.length === 1
              ? 'Removing the only campus disables location-based teacher punching until another location is added.'
              : 'The other saved campuses will remain available.'}
          </p>
        </HrForm>
      )}
    </div>
  );
}
function LocationEditor({
  policy,
  index,
  source,
  close,
  saved,
}: {
  policy: LocationPolicy;
  index: number;
  source: SchoolLocationSource;
  close: () => void;
  saved: () => void;
}) {
  const [location, setLocation] = useState<Campus>(
    index < 0
      ? { name: 'School campus', latitude: NaN, longitude: NaN, radius: 100 }
      : { ...policy.locations[index] },
  );
  const [accuracy, setAccuracy] = useState(policy.maxAccuracy);
  return (
    <HrForm
      title={index < 0 ? 'Add school location' : 'Edit school location'}
      description="Use the map, your device location, or coordinates from your phone. Check the campus centre before saving."
      close={close}
      submitLabel="Save location"
      hasChanges={
        accuracy !== policy.maxAccuracy ||
        (index < 0
          ? location.name !== 'School campus' ||
            Number.isFinite(location.latitude) ||
            Number.isFinite(location.longitude) ||
            location.radius !== 100
          : JSON.stringify(location) !== JSON.stringify(policy.locations[index]))
      }
      submit={async () => {
        const draft = {
          ...policy,
          maxAccuracy: accuracy,
          locations:
            index < 0
              ? [...policy.locations, location]
              : policy.locations.map((old, i) => (i === index ? location : old)),
        };
        const parsed = schoolLocationsSchema.safeParse(draft);
        if (!parsed.success)
          throw new Error(
            'Enter valid coordinates, a location name, a radius of 25–1,000 m, and required device accuracy of 5–100 m.',
          );
        await source.save(parsed.data);
        saved();
      }}
    >
      <TextField
        label="Location name"
        value={location.name}
        onChange={(name) => setLocation({ ...location, name })}
      />
      <Suspense fallback={<p role="status">Loading campus map…</p>}>
        <CampusLocationPicker value={location} maxAccuracy={accuracy} onChange={setLocation} />
      </Suspense>
      <label className="field">
        Required device accuracy (metres)
        <input
          type="number"
          min={5}
          max={100}
          required
          value={Number.isFinite(accuracy) ? accuracy : ''}
          onChange={(e) => setAccuracy(e.currentTarget.valueAsNumber)}
        />
      </label>
      <p className="panel-note">
        This accuracy requirement applies to all saved campuses. Teachers must still provide a fresh
        device location; entering campus coordinates does not mark attendance.
      </p>
    </HrForm>
  );
}
