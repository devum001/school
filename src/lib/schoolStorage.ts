const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const digit = new Int16Array(128).fill(-1);
for (let i = 0; i < alphabet.length; i++) digit[alphabet.charCodeAt(i)] = i;
const formatKey = '$schoolwellStorage';
const assetsKey = '$schoolwellAssets';
const refKey = '$schoolwellAsset';
type PackedAsset = { prefix: string; data: string };
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// localStorage budgets UTF-16 characters. Pack two base64 symbols into one safe
// UTF-16 character; bytes and image resolution are preserved exactly, including padding.
function pack(value: string) {
  let packed = '';
  for (let i = 0; i < value.length; i += 2)
    packed += String.fromCharCode(
      256 + digit[value.charCodeAt(i)] * 65 + digit[value.charCodeAt(i + 1)],
    );
  return packed;
}
function unpack(value: string) {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i) - 256;
    if (code < 0 || code >= 65 * 65) throw new Error('Saved artwork is incomplete.');
    result += alphabet[Math.floor(code / 65)] + alphabet[code % 65];
  }
  return result;
}
export function encodeSchoolStorage(snapshot: object): string {
  const assets: PackedAsset[] = [],
    indices = new Map<string, number>();
  const encode = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const match = /^(data:[\w.+/-]+;base64,)([A-Za-z0-9+/=]+)$/.exec(value);
      if (match && match[2].length % 2 === 0) {
        let index = indices.get(value);
        if (index === undefined) {
          index = assets.length;
          assets.push({ prefix: match[1], data: pack(match[2]) });
          indices.set(value, index);
        }
        return { [refKey]: index };
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(encode);
    if (object(value))
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
    return value;
  };
  const data = encode(snapshot);
  return JSON.stringify({
    ...(data as Record<string, unknown>),
    [formatKey]: 1,
    [assetsKey]: assets,
  });
}
export function decodeSchoolStorage(raw: string): unknown {
  const data: unknown = JSON.parse(raw);
  // Existing browser data is read without requiring users to reset or re-import it.
  if (!object(data) || data[formatKey] !== 1) return data;
  const table = data[assetsKey];
  if (!Array.isArray(table)) throw new Error('Saved artwork table is missing.');
  const assets = table.map((entry: unknown) => {
    if (!object(entry) || typeof entry.prefix !== 'string' || typeof entry.data !== 'string')
      throw new Error('Saved artwork is incomplete.');
    return entry.prefix + unpack(entry.data);
  });
  const decode = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(decode);
    if (!object(value)) return value;
    if (Object.keys(value).length === 1 && refKey in value) {
      const index = value[refKey];
      if (typeof index !== 'number' || !Number.isInteger(index) || !assets[index])
        throw new Error('Saved artwork reference is missing.');
      return assets[index];
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
  };
  const { [formatKey]: _format, [assetsKey]: _assets, ...snapshot } = data;
  void _format;
  void _assets;
  return decode(snapshot);
}
