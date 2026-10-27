import { apiService, ApiError, isCancelled } from '../../services/apiService';
import { authService, type Session } from '../../services/authService';
export type AuthState = {
  status: 'loading' | 'anonymous' | 'authenticated' | 'error';
  session: Session | null;
  schoolId: string | null;
  error?: string;
};
let state: AuthState = { status: 'loading', session: null, schoolId: null };
let revision = 0;
let restoration: Promise<void> | undefined;
let hasAuthenticatedSession = false;
const expiredMessage = 'Your session has expired. Please sign in again.';
const listeners = new Set<() => void>();
const publish = (next: AuthState) => {
  state = next;
  listeners.forEach((listener) => listener());
};
export const sessionStore = {
  getSnapshot: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  initialize() {
    // The application owns bootstrap; component remounts only subscribe to its result.
    if (restoration) return restoration;
    return state.status === 'loading' ? sessionStore.restore() : Promise.resolve();
  },
  restore(): Promise<void> {
    if (restoration) return restoration;
    const current = ++revision;
    const selectedSchool = state.schoolId;
    if (!state.session) publish({ status: 'loading', session: null, schoolId: null });
    const pending = (async () => {
      try {
        const session = await authService.session();
        if (current === revision) {
          hasAuthenticatedSession = true;
          publish({
            status: 'authenticated',
            session,
            schoolId: session.memberships.some((item) => item.schoolId === selectedSchool)
              ? selectedSchool
              : (session.memberships[0]?.schoolId ?? null),
          });
        }
      } catch (error) {
        if (current !== revision || isCancelled(error)) return;
        publish({
          status: error instanceof ApiError && error.status === 401 ? 'anonymous' : 'error',
          session: null,
          schoolId: null,
          error:
            error instanceof ApiError && error.status === 401
              ? hasAuthenticatedSession
                ? expiredMessage
                : undefined
              : error instanceof Error
                ? error.message
                : 'Unable to load your session.',
        });
      }
    })().finally(() => {
      if (restoration === pending) restoration = undefined;
    });
    restoration = pending;
    return pending;
  },
  async login(email: string, password: string) {
    try {
      await authService.login(email, password);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        throw new Error('Email or password is incorrect.', { cause: error });
      throw error;
    }
    revision++;
    restoration = undefined;
    await sessionStore.restore();
  },
  async logout(all = false) {
    // Keep the session visible on network failure; do not claim an HttpOnly cookie was cleared.
    await authService.logout(all);
    revision++;
    restoration = undefined;
    hasAuthenticatedSession = false;
    publish({ status: 'anonymous', session: null, schoolId: null });
  },
  selectSchool(id: string) {
    if (state.session?.memberships.some((item) => item.schoolId === id))
      publish({ ...state, schoolId: id });
  },
};
apiService.onUnauthorized(() => {
  revision++;
  restoration = undefined;
  publish({
    status: 'anonymous',
    session: null,
    schoolId: null,
    error: hasAuthenticatedSession ? expiredMessage : undefined,
  });
});
