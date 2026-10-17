import type { DemoState } from '../types/domain';
import { SAMPLE_SCHOOL_ARTWORK } from '../mocks/schoolArtwork';
export function schoolLogoFor(
  state: Pick<DemoState, 'school' | 'documentTemplates'>,
): string | undefined {
  const logo =
    state.school.logoDataUrl !== undefined
      ? state.school.logoDataUrl
      : state.documentTemplates?.branding?.logo;
  return logo === null ? undefined : (logo ?? SAMPLE_SCHOOL_ARTWORK.logo);
}
