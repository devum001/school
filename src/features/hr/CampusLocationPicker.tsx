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
}: {
  value: Campus;
  onChange: (value: Campus) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null),
    circle = useRef<L.Circle | null>(null),
    uncertainty = useRef<L.Circle | null>(null);
  const latest = useRef({ value, onChange });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [accuracy, setAccuracy] = useState<number>();
  useEffect(() => {
    latest.current = { value, onChange };
  }, [value, onChange]);
  useEffect(() => {
    if (!element.current) return;
    const initial = latest.current.value;
    const selected = initial.latitude !== 0 || initial.longitude !== 0;
    const instance = L.map(element.current, { scrollWheelZoom: false }).setView(
      selected ? [initial.latitude, initial.longitude] : [20.6, 78.9],
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
        setError(
          'Map imagery could not load. Check your connection; current location and coordinate entry still work.',
        ),
      )
      .addTo(instance);
    const pin = L.marker([initial.latitude, initial.longitude], {
      draggable: true,
      icon: L.divIcon({
        className: 'campus-pin',
        html: '<span></span>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(instance);
    marker.current = pin;
    circle.current = L.circle([initial.latitude, initial.longitude], {
      radius: initial.radius,
      color: '#21746e',
      fillOpacity: 0.15,
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
    marker.current?.setLatLng(point);
    circle.current?.setLatLng(point).setRadius(Math.max(25, Math.min(1000, value.radius || 25)));
    if (
      (value.latitude || value.longitude) &&
      map.current &&
      !map.current.getBounds().contains(point)
    )
      map.current.setView(point, 17);
  }, [value.latitude, value.longitude, value.radius]);
  useEffect(() => {
    const selected = latest.current.value.latitude || latest.current.value.longitude;
    if (selected && map.current && circle.current)
      map.current.fitBounds(circle.current.getBounds(), {
        padding: [20, 20],
        maxZoom: 18,
        animate: false,
      });
  }, [value.radius]);
  const locate = async () => {
    setBusy(true);
    setError('');
    try {
      const position = await currentPosition();
      if (!map.current) return;
      const { latitude, longitude, accuracy: measured } = position.coords;
      onChange({ ...latest.current.value, latitude, longitude });
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
      setError(e instanceof Error ? e.message : 'Unable to locate this device.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="campus-location-picker">
      <div className="campus-location-toolbar">
        <MapPin size={18} />
        <strong>Choose campus centre</strong>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void locate()}>
          <LocateFixed size={16} />
          {busy ? 'Locating…' : 'Use current location'}
        </Button>
      </div>
      <p>
        Click the map or drag the pin to the school. The green circle shows where teachers may
        punch.
      </p>
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
          onChange={(e) => onChange({ ...value, radius: Number(e.target.value) })}
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
          Device accuracy: approximately ±{Math.round(accuracy)} metres (dashed circle). Check the
          pin before saving.{' '}
          {accuracy > value.radius &&
            'The current GPS uncertainty is larger than the allowed radius.'}
        </p>
      )}
      <details>
        <summary>Fine-tune coordinates</summary>
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
                value={value[key]}
                onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      </details>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
