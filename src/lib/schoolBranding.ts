import type { DemoState } from '../types/domain';
import { demoArtwork } from './demoArtwork';
export function schoolLogoFor(
  state: Pick<DemoState, 'school' | 'documentTemplates'>,
): string | undefined {
  const logo =
    state.school.logoDataUrl !== undefined
      ? state.school.logoDataUrl
      : state.documentTemplates?.branding?.logo;
  return logo === null ? undefined : (logo ?? demoArtwork.logo ?? undefined);
}
