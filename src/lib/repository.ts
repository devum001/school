import { appMode } from '../services/runtimeConfig';
import type { SchoolRepository } from './demoRepository';
import type { DemoState } from '../types/domain';
import type { DocumentTemplates } from '../types/ledger';
import {
  DEFAULT_DOCUMENT_TEMPLATES,
  saveDocumentTemplates as applyDocumentTemplates,
} from './documentData';
import { createSeed } from '../mocks/seed';

export type { SchoolRepository } from './demoRepository';

let liveAdapter: Partial<SchoolRepository> | null = null;
export function setLiveRepositoryAdapter(adapter: Partial<SchoolRepository> | null) {
  liveAdapter = adapter;
  notify();
}

const TEMPLATES_KEY = 'schoolwell_live_document_templates';

function getLiveDocumentTemplates(): DocumentTemplates {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TEMPLATES_KEY) : null;
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_DOCUMENT_TEMPLATES;
}

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) {
    try {
      l();
    } catch {}
  }
}

// Initial live fallback state for document rendering & template previews
let liveSnapshot: DemoState = {
  ...createSeed(),
  documentTemplates: getLiveDocumentTemplates(),
};

export function updateLiveSnapshotSchool(schoolInfo: Partial<DemoState['school']>) {
  liveSnapshot = {
    ...liveSnapshot,
    school: { ...liveSnapshot.school, ...schoolInfo },
  };
  notify();
}

// Load local persistence and seeds only for the independent demo application.
export const repository: SchoolRepository =
  appMode === 'demo'
    ? (await import('./demoRepository')).repository
    : new Proxy({} as SchoolRepository, {
        get(_target, prop: string | symbol) {
          if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') {
            return undefined;
          }
          if (liveAdapter && typeof (liveAdapter as any)[prop] === 'function') {
            return (liveAdapter as any)[prop];
          }
          if (prop === 'getSnapshot') {
            return () => liveSnapshot;
          }
          if (prop === 'saveDocumentTemplates') {
            return (input: DocumentTemplates) => {
              liveSnapshot = applyDocumentTemplates(liveSnapshot, input);
              try {
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem(
                    TEMPLATES_KEY,
                    JSON.stringify(liveSnapshot.documentTemplates),
                  );
                }
              } catch {}
              notify();
            };
          }
          if (prop === 'subscribe') {
            return (listener: () => void) => {
              listeners.add(listener);
              return () => {
                listeners.delete(listener);
              };
            };
          }
          if (prop === 'reset') {
            return () => {};
          }
          return (..._args: any[]) => {
            console.warn(`Repository method ${String(prop)} called in live mode without adapter.`);
          };
        },
      });
