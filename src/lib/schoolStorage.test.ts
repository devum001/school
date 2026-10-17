import { describe, expect, it } from 'vitest';
import { decodeSchoolStorage, encodeSchoolStorage } from './schoolStorage';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import type { SavedSchoolState } from '../mocks/restore';

describe('compact school persistence', () => {
  const first = 'data:image/png;base64,' + 'Ab0+/zQ='.repeat(60000);
  const second = 'data:image/webp;base64,' + 'wxyz0123'.repeat(40000);
  it('stores repeated image bytes once, packs them losslessly and preserves old/new artwork versions', () => {
    const state = {
      school: { name: 'विद्यालय 🏫', logo: second },
      templates: { header: first, logo: second },
      payments: Array.from({ length: 12 }, (_, i) => ({
        amount: i + 1,
        document: { branding: { logo: first, header: first, footer: second } },
      })),
      documents: [{ dataUrl: 'data:application/pdf;base64,AAEC/w==' }],
      text: 'Quotes " and slashes \\ and 𝄞',
      optional: undefined,
    };
    const raw = JSON.stringify(state),
      compact = encodeSchoolStorage(state);
    expect(compact.length).toBeLessThan(raw.length / 10);
    expect(JSON.parse(compact).$schoolwellAssets).toHaveLength(3);
    expect(decodeSchoolStorage(compact)).toEqual(JSON.parse(raw));
    expect(encodeSchoolStorage(decodeSchoolStorage(compact) as object)).toBe(compact);
  });
  it('round-trips every base64 symbol and both padding lengths without touching normal text', () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const state = {
      one: 'data:image/png;base64,' + alphabet + 'AA==',
      two: 'data:image/png;base64,AQA=',
      text: alphabet,
      noPadding: 'data:image/png;base64,AQID',
    };
    expect(decodeSchoolStorage(encodeSchoolStorage(state))).toEqual(state);
  });
  it('loads the legacy browser state and the compact state with identical school records', () => {
    const seed = createSeed('2026-10-15');
    const legacy = JSON.stringify(seed);
    const oldState = restoreSchoolState(seed, decodeSchoolStorage(legacy) as SavedSchoolState);
    const compactState = restoreSchoolState(
      seed,
      decodeSchoolStorage(encodeSchoolStorage(seed)) as SavedSchoolState,
    );
    expect(compactState).toEqual(oldState);
    expect(compactState.payments).toEqual(seed.payments);
    expect(compactState.students).toEqual(seed.students);
  });
  it('rejects broken references instead of silently dropping saved artwork', () => {
    expect(() =>
      decodeSchoolStorage(
        JSON.stringify({
          $schoolwellStorage: 1,
          $schoolwellAssets: [],
          logo: { $schoolwellAsset: 0 },
        }),
      ),
    ).toThrow();
  });
});
