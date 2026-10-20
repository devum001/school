import { appMode } from '../services/runtimeConfig';
import type { DocumentBranding } from '../types/ledger';
// Sample logos/signatures belong exclusively to the independent demo workspace.
export const demoArtwork: DocumentBranding =
  appMode === 'demo' ? (await import('../mocks/schoolArtwork')).SAMPLE_SCHOOL_ARTWORK : {};
