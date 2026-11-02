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

export function resolveBrowserBaseUrl(configuredUrl: string): string {
  if (typeof window !== 'undefined' && window.location && configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      const isLocalHost = (host: string) =>
        host === 'localhost' ||
        host === '127.0.0.1' ||
        /^192\.168\./.test(host) ||
        /^10\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

      if (isLocalHost(url.hostname) && isLocalHost(window.location.hostname)) {
        url.hostname = window.location.hostname;
        return url.toString().replace(/\/+$/, '');
      }
    } catch {
      // Keep configured URL if parsing fails
    }
  }
  return configuredUrl;
}

// Node-based fixture runners have no Vite import.meta.env. Browser builds always do.
const config = parseRuntimeConfig({
  mode: import.meta.env?.VITE_APP_MODE,
  baseUrl: import.meta.env?.VITE_API_BASE_URL,
});
export const appMode = config.mode;
export const apiBaseUrl = resolveBrowserBaseUrl(config.baseUrl);
