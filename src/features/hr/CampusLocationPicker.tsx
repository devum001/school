import { parseCoordinatePair } from '../../lib/schoolLocations';
import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { LocateFixed, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Primitives';
import { currentPosition } from '../../services/teacherPunchService';
import 'leaflet/dist/leaflet.css';
import './campus-location.css';

type Campus = { name: string; latitude: number; longitude: number; radius: number };
export default function CampusLocationPicker({
  value,
  onChange,
  maxAccuracy = 50,
}: {
  value: Campus;
  maxAccuracy?: number;
  onChange: (value: Campus) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null),
    circle = useRef<L.Circle | null>(null),
    uncertainty = useRef<L.Circle | null>(null);
  const locationRequest = useRef<AbortController | null>(null);
  const latest = useRef({ value, onChange });
  const [busy, setBusy] = useState(false),
    [refining, setRefining] = useState(false),
    [error, setError] = useState(''),
    [mapError, setMapError] = useState(''),
    [accuracy, setAccuracy] = useState<number>(),
    [coordinatePair, setCoordinatePair] = useState(''),
    [copied, setCopied] = useState('');
  useEffect(() => {
    latest.current = { value, onChange };
  }, [value, onChange]);
  useEffect(() => {
    if (!element.current) return;
    const initial = latest.current.value;
    const selected = Number.isFinite(initial.latitude) && Number.isFinite(initial.longitude);
    const initialPoint: L.LatLngTuple = selected
      ? [initial.latitude, initial.longitude]
      : [20.6, 78.9];
    const instance = L.map(element.current, { scrollWheelZoom: false }).setView(
      initialPoint,
      selected ? 17 : 4,
    );
    map.current = instance;
    L.tileLayer(
      import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          import.meta.env.VITE_MAP_ATTRIBUTION ||
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    )
      .on('tileerror', () =>
        setMapError(
          'Map imagery could not load. Check your connection; current location and coordinate entry still work.',
        ),
      )
      .addTo(instance);
    const pin = L.marker(initialPoint, {
      opacity: selected ? 1 : 0,
      draggable: true,
      icon: L.divIcon({
        className: 'campus-pin',
        html: '<span></span>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(instance);
    marker.current = pin;
    circle.current = L.circle(initialPoint, {
      opacity: selected ? 1 : 0,
      radius: initial.radius,
      color: '#21746e',
      fillOpacity: selected ? 0.15 : 0,
      weight: 2,
    }).addTo(instance);
    const move = (latlng: L.LatLng) => {
      const point = latlng.wrap();
      latest.current.onChange({
        ...latest.current.value,
        latitude: Number(point.lat.toFixed(6)),
        longitude: Number(point.lng.toFixed(6)),
      });
      setError('');
    };
    instance.on('click', (event: L.LeafletMouseEvent) => move(event.latlng));
    pin.on('dragend', () => move(pin.getLatLng()));
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(element.current);
    return () => {
      locationRequest.current?.abort();
      resize.disconnect();
      instance.remove();
      map.current = null;
      marker.current = null;
      circle.current = null;
      uncertainty.current = null;
    };
  }, []);
  useEffect(() => {
    if (
      !Number.isFinite(value.latitude) ||
      !Number.isFinite(value.longitude) ||
      Math.abs(value.latitude) > 90 ||
      Math.abs(value.longitude) > 180
    )
      return;
    const point: L.LatLngTuple = [value.latitude, value.longitude];
    marker.current?.setLatLng(point).setOpacity(1);
    circle.current?.setStyle({ opacity: 1, fillOpacity: 0.15 });
    circle.current?.setLatLng(point).setRadius(Math.max(25, Math.min(1000, value.radius || 25)));
    if (map.current && !map.current.getBounds().contains(point)) map.current.setView(point, 17);
  }, [value.latitude, value.longitude, value.radius]);
  useEffect(() => {
    const selected =
      Number.isFinite(latest.current.value.latitude) &&
      Number.isFinite(latest.current.value.longitude);
    if (selected && map.current && circle.current)
      map.current.fitBounds(circle.current.getBounds(), {
        padding: [20, 20],
        maxZoom: 18,
        animate: false,
      });
  }, [value.radius]);
  const locate = async (improveAccuracy = false) => {
    locationRequest.current?.abort();
    const controller = new AbortController();
    locationRequest.current = controller;
    const requiredAccuracy = Math.min(maxAccuracy, value.radius / 2);
    setBusy(true);
    setRefining(improveAccuracy);
    setAccuracy(undefined);
    setError('');
    try {
      const position = await currentPosition({
        maxAccuracy: requiredAccuracy,
        waitForAccuracy: improveAccuracy,
        timeoutMs: improveAccuracy ? 20000 : 5000,
        signal: controller.signal,
        onProgress: (position) => setAccuracy(position.coords.accuracy),
      });
      if (!map.current) return;
      const { latitude, longitude, accuracy: measured } = position.coords;
      if (measured <= requiredAccuracy) {
        onChange({ ...latest.current.value, latitude, longitude });
      } else {
        setError(
          `This reading is approximate (±${Math.round(measured)} m), so the campus pin was not moved. Use a phone with precise location or place the pin on the actual school building on the map. Saving these settings keeps the selected pin.`,
        );
      }
      setAccuracy(measured);
      uncertainty.current?.remove();
      uncertainty.current = L.circle([latitude, longitude], {
        radius: measured,
        color: '#657b95',
        dashArray: '4 5',
        fillOpacity: 0.06,
      }).addTo(map.current);
      map.current.fitBounds(
        L.latLng(latitude, longitude).toBounds(Math.max(value.radius, measured) * 3),
        { maxZoom: 18, animate: false },
      );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Unable to locate this device.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <div className="campus-location-picker">
      <div className="campus-location-toolbar">
        <MapPin size={18} />
        <strong>Choose campus centre</strong>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void locate()}>
          <LocateFixed size={16} />
          {busy ? (refining ? 'Improving accuracy…' : 'Finding location…') : 'Use current location'}
        </Button>
      </div>
      {busy && (
        <div className="campus-location-toolbar" role="status">
          <span>
            {refining
              ? 'Trying for a better GPS reading, up to 20 seconds.'
              : 'Showing the first available reading, up to 5 seconds.'}
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              locationRequest.current?.abort();
              setBusy(false);
            }}
          >
            Stop locating
          </Button>
        </div>
      )}
      <p>
        Click the map or drag the pin to the school. The green circle shows where teachers may
        punch. Current location is used only when it is precise enough; an approximate reading will
        not move your campus pin.
      </p>
      <section aria-label="Manual campus coordinates" className="campus-manual-coordinates">
        <h3>Enter coordinates manually</h3>
        <p>
          No laptop GPS is needed. Enter decimal latitude and longitude or paste a pair copied from
          your phone.
        </p>
        <label className="field">
          Paste latitude, longitude
          <input
            value={coordinatePair}
            placeholder="27.9871488, 73.3216768"
            onChange={(e) => setCoordinatePair(e.target.value)}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            try {
              const point = parseCoordinatePair(coordinatePair);
              onChange({ ...value, ...point });
              setError('');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Enter valid coordinates.');
            }
          }}
        >
          Use pasted coordinates
        </Button>
        <div className="form-grid">
          {(['latitude', 'longitude'] as const).map((key) => (
            <label className="field" key={key}>
              {key === 'latitude' ? 'Latitude' : 'Longitude'}
              <input
                type="number"
                required
                step="any"
                min={key === 'latitude' ? -90 : -180}
                max={key === 'latitude' ? 90 : 180}
                value={Number.isFinite(value[key]) ? value[key] : ''}
                onChange={(e) => onChange({ ...value, [key]: e.currentTarget.valueAsNumber })}
              />
            </label>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${value.latitude}, ${value.longitude}`);
              setCopied(`${value.latitude}, ${value.longitude}`);
              setError('');
            } catch {
              setError(
                'Copy is unavailable in this browser. Select and copy the latitude and longitude fields instead.',
              );
            }
          }}
        >
          {copied === `${value.latitude}, ${value.longitude}`
            ? 'Coordinates copied'
            : 'Copy coordinates'}
        </Button>
      </section>
      <div ref={element} className="campus-map" role="region" aria-label="School location map" />
      <label className="field">
        Allowed radius · {value.radius} metres
        <input
          aria-label="Allowed radius"
          type="range"
          min={25}
          max={1000}
          step={25}
          value={value.radius}
          onChange={(e) => onChange({ ...value, radius: e.currentTarget.valueAsNumber })}
        />
      </label>
      <div className="campus-radius-presets">
        {[50, 100, 200, 500].map((radius) => (
          <Button
            key={radius}
            type="button"
            variant="secondary"
            aria-pressed={value.radius === radius}
            onClick={() => onChange({ ...value, radius })}
          >
            {radius} m
          </Button>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (map.current && circle.current)
              map.current.fitBounds(circle.current.getBounds(), {
                padding: [20, 20],
                maxZoom: 18,
                animate: false,
              });
          }}
        >
          Show allowed area
        </Button>
      </div>
      {accuracy !== undefined && (
        <p>
          Device accuracy: approximately ±{Math.round(accuracy)} metres. The dashed circle shows the
          device estimate; verify the campus pin before saving.{' '}
          {accuracy > value.radius &&
            'The current GPS uncertainty is larger than the allowed radius.'}
        </p>
      )}

      {!busy && accuracy !== undefined && accuracy > Math.min(maxAccuracy, value.radius / 2) && (
        <Button type="button" variant="secondary" onClick={() => void locate(true)}>
          Improve accuracy
        </Button>
      )}
      {mapError && <p role="status">{mapError}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
