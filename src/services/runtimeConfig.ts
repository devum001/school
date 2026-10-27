export function parseRuntimeConfig(source: { mode?: string; baseUrl?: string }) {
  const mode = source.mode || 'demo';
  if (mode !== 'demo' && mode !== 'live') throw new Error('VITE_APP_MODE must be demo or live.');
  const baseUrl = source.baseUrl?.replace(/\/+$/, '') || '';
  if (mode === 'live') {
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new Error('Live mode requires VITE_API_BASE_URL.');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error('VITE_API_BASE_URL must be an HTTP(S) API URL without credentials.');
    }
  }
  return { mode: mode as 'demo' | 'live', baseUrl };
}
// Node-based fixture runners have no Vite import.meta.env. Browser builds always do.
const config = parseRuntimeConfig({
  mode: import.meta.env?.VITE_APP_MODE,
  baseUrl: import.meta.env?.VITE_API_BASE_URL,
});
export const appMode = config.mode;
export const apiBaseUrl = config.baseUrl;
