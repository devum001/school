/** User-initiated lookup with first-fix previews or bounded accuracy refinement. */
export function currentPosition({
  maxAccuracy = 50,
  timeoutMs = 20000,
  waitForAccuracy = true,
  signal,
  onProgress,
}: {
  maxAccuracy?: number;
  timeoutMs?: number;
  /** Map previews may use the first fix; callers must still check its reported accuracy. */
  waitForAccuracy?: boolean;
  signal?: AbortSignal;
  onProgress?: (position: GeolocationPosition) => void;
} = {}): Promise<GeolocationPosition> {
  if (!globalThis.navigator?.geolocation)
    return Promise.reject(
      new Error(
        'Location is unavailable. Open the app over HTTPS on a device with location access.',
      ),
    );
  return new Promise((resolve, reject) => {
    const geo = navigator.geolocation;
    let watch: number | undefined;
    let best: GeolocationPosition | undefined;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (watch !== undefined) geo.clearWatch(watch);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else if (best && Math.abs(Date.now() - best.timestamp) <= 30000) resolve(best);
      else
        reject(
          new Error(
            'No fresh location was received. Enable precise location, move near a window or try a GPS-enabled phone.',
          ),
        );
    };
    const abort = () => finish(new DOMException('Location check cancelled.', 'AbortError'));
    const timer = setTimeout(() => finish(), timeoutMs);
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    try {
      watch = geo.watchPosition(
        (position) => {
          if (settled) return;
          const { latitude, longitude, accuracy } = position.coords;
          if (
            ![latitude, longitude, accuracy, position.timestamp].every(Number.isFinite) ||
            Math.abs(latitude) > 90 ||
            Math.abs(longitude) > 180 ||
            accuracy <= 0 ||
            Math.abs(Date.now() - position.timestamp) > 10000
          )
            return;
          if (!best || accuracy <= best.coords.accuracy || Date.now() - best.timestamp > 10000) {
            best = position;
            onProgress?.(position);
          }
          if (!waitForAccuracy || accuracy <= maxAccuracy) finish();
        },
        (error) => {
          if (error.code === 1)
            finish(
              new Error(
                'Location permission is blocked. Allow location for this site in browser settings and enable precise location on your device, then retry.',
              ),
            );
          // Temporary unavailable/timeout errors can be followed by a better fix.
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
      );
      if (settled) geo.clearWatch(watch);
    } catch {
      finish(
        new Error('Location could not start. Check browser location permissions and use HTTPS.'),
      );
    }
  });
}
