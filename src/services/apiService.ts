import { apiBaseUrl } from './runtimeConfig';
import { ReadCache } from './readCache';

type RequestOptions = {
  fresh?: boolean;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
const messages: Record<number, string> = {
  400: 'Check the information you entered and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have access, or the security check expired. Please retry.',
  404: 'This school or resource is no longer available to your account.',
  409: 'This request conflicts with an existing record.',
  429: 'Too many attempts. Please wait before trying again.',
};
const setupMessages: Record<string, string> = {
  EXAM_SAVED_MARKS:
    'Keep classes, sections and subjects with saved marks selected. Clear those marks in the marks sheet before removing them.',
  HR_PREVIOUS_PUNCH:
    'An earlier day still has an incomplete punch. Ask your administrator to review that day before starting a new attendance session.',
  EXAM_EMPTY: 'This class has no active students. Add students before creating a test.',
  HR_LEAVE_STATE:
    'Only a pending leave request that has not started can be cancelled. Contact your administrator about approved leave.',
  LEARNING_NOT_READY:
    'School learning storage requires initialization. Ask your operator to run the school learning preflight and initialization command.',
  EXAM_INVALID:
    'Check the test date, assigned classes, sections, configured subjects and marks. Marks must be within the selected maximum, A for absent, or blank for pending.',
  ROSTER_CHANGED: 'The class roster changed. Reopen the register or marks sheet before saving.',
  HR_PUNCH_DISABLED:
    'Teacher punching is disabled for this period. Ask your school administrator to select Punch in salary and attendance setup.',
  HR_EMPLOYMENT_DATES:
    'Your joining date is missing or today is outside your employment dates. Ask your school administrator to correct your profile.',
  HR_NOT_WORKING_DAY: 'Today is a holiday or weekly off in your school work rules.',
  HR_ON_LEAVE:
    'Approved full-day leave applies today. Ask your administrator to review it before punching.',
  HR_LOCATION_SETUP:
    'Your school has not configured a punch location. Ask your administrator to add the campus in Work & Leave settings.',
  HR_DAY_REVIEWED:
    'An administrator has already reviewed today. Request a correction instead of punching.',
  HR_PUNCH_COMPLETE: 'Today’s punch-in and punch-out are already recorded.',
  HR_ALREADY_IN: 'You are already punched in. Refresh your attendance and use Punch out.',
  HR_NOT_IN: 'Punch in before recording a punch out.',
  HR_NOT_READY:
    'Staff HR storage is not initialized. Ask the operator to review and run the HR initialization command.',
  HR_LOGIN_EMAIL:
    'This email cannot be used for a new login. Use a different email or link an existing authorized school member.',
  HR_LOGIN_LINKED: 'This staff member is inactive or already has a linked login.',
  HR_DEPARTMENT_USED: 'This department has staff. Reassign them before deleting it.',
  HR_DEPARTMENT_DUPLICATE: 'A department with this name already exists.',
  HR_INVALID: 'Check the settings, dates and amounts.',
  HR_STALE: 'This record changed. Refresh before saving again.',
  HR_LINK: 'Link this active school account to exactly one active staff profile first.',
  HR_PUNCH: 'Punching is not enabled for this teacher or the punch sequence is invalid.',
  HR_LOCATION:
    'A fresh, accurate location inside an allowed school area is required. Try again or request an attendance correction.',
  HR_LOCKED: 'This period has approved payroll. Use an adjustment in an open period instead.',
  HR_LEAVE:
    'Leave overlaps an existing request, exceeds the paid balance, or is outside employment dates.',
  HR_SELF_APPROVAL:
    'Another authorized administrator must approve your own leave or attendance correction.',
  HR_REVIEW: 'Resolve attendance and leave issues before approving payroll.',
  HR_SALARY: 'Configure salary and joining date for this period first.',
  HR_PAYMENT:
    'Approve payroll first. Payment must be positive and cannot exceed the outstanding balance.',
  HR_ADVANCE: 'Advance recovery cannot exceed the outstanding advance balance.',
  HR_PERIOD: 'Payroll can be approved only after the salary month has ended.',
  HR_LIMIT:
    'This HR workspace exceeds its supported record limit. Ask the operator to review the school size before continuing.',

  ACTIVE_REFERENCES:
    'Active enrollments or teaching assignments still use this record. Reassign or archive them first.',
  DUPLICATE_ROW: 'Remove duplicate names or identifiers from this batch.',
  IMPORT_BUSY:
    'Three student imports are processing. Wait for one to finish or cancel it before starting another.',
  IMPORT_INVALID: 'Check your file headers, row limits and highlighted fields.',
  IMPORT_LIMIT:
    'This school has ten unfinished imports. Complete or cancel one before starting another.',
  IMPORT_STATE:
    'This import changed or cannot be edited now. Reload it. You can keep up to ten unfinished imports per school.',
  STALE_REVISION:
    'Another administrator changed this record. Close this form, refresh, and apply your changes again.',
  INVALID_DATES: 'Use valid dates with the end after the start.',
  YEAR_OVERLAP: 'These dates overlap an existing academic year.',
  YEAR_CLOSED: 'Closed academic years are read-only.',
  YEAR_DATES_LOCKED: 'Dates can only change while the year is a draft.',
  CURRENT_YEAR: 'Select another current year before closing this one.',
  ACTIVE_CHILDREN: 'Archive the active sections and subjects before archiving this class.',
  CLASS_ARCHIVED: 'Restore the class before changing its sections or subjects.',
  LAST_USABLE_OWNER:
    'Assign another active owner before disabling this account or removing its ownership.',
  OWNER_RECOVERY_NOT_NEEDED:
    'This school already has an active owner. Ask that owner to manage membership.',
  PROFILE_INVALID: 'Check the contact details, website, timezone and school hours.',
};
export const isCancelled = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

export class ApiService {
  private reads = new ReadCache();
  private csrf = '';
  private csrfExpiry = 0;
  private csrfPending?: Promise<string>;
  private generation = 0;
  private sessionEpoch = 0;
  private refreshPending?: Promise<void>;
  private unauthorized = new Set<() => void>();
  constructor(
    private baseUrl: string,
    private transport: typeof fetch = (...args) => fetch(...args),
  ) {}
  onUnauthorized(listener: () => void) {
    this.unauthorized.add(listener);
    return () => {
      this.unauthorized.delete(listener);
    };
  }
  clearSession() {
    this.reads.clear();
    this.sessionEpoch++;
    this.generation++;
    this.csrf = '';
    this.csrfExpiry = 0;
    this.csrfPending = undefined;
  }
  invalidateReads() {
    this.reads.invalidate();
  }
  setCsrfToken(token: string) {
    this.generation++;
    this.csrf = token;
    const expiry = Number(token.split('.')[1]);
    this.csrfExpiry = Number.isFinite(expiry) ? expiry - 5000 : 0;
  }
  async csrfToken(): Promise<string> {
    if (this.csrf && this.csrfExpiry > Date.now()) return this.csrf;
    if (!this.csrfPending) {
      const generation = this.generation;
      const pending = this.request<{ csrfToken: string }>('/auth/csrf')
        .then((data) => {
          if (generation !== this.generation)
            throw new DOMException('Session changed', 'AbortError');
          if (typeof data.csrfToken !== 'string' || !data.csrfToken)
            throw new ApiError(0, 'INVALID_RESPONSE', 'The server returned an invalid response.');
          this.setCsrfToken(data.csrfToken);
          return data.csrfToken;
        })
        .finally(() => {
          if (this.csrfPending === pending) this.csrfPending = undefined;
        });
      this.csrfPending = pending;
    }
    return this.csrfPending;
  }
  private async refreshAccess(): Promise<void> {
    if (!this.refreshPending) {
      const epoch = this.sessionEpoch;
      const renew = async () => {
        if (epoch !== this.sessionEpoch) throw new DOMException('Session changed', 'AbortError');
        // Another tab may have refreshed while this tab waited for the browser lock.
        try {
          await this.request('/auth/session', {}, true, true);
          return;
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 401)) throw error;
        }
        const csrf = await this.request<{ csrfToken: string }>('/auth/csrf', {}, true, true);
        if (epoch !== this.sessionEpoch) throw new DOMException('Session changed', 'AbortError');
        if (typeof csrf.csrfToken !== 'string' || !csrf.csrfToken)
          throw new ApiError(0, 'INVALID_RESPONSE', 'The server returned an invalid response.');
        this.setCsrfToken(csrf.csrfToken);
        const result = await this.request<{ csrfToken: string }>(
          '/auth/refresh',
          { method: 'POST' },
          true,
          true,
        );
        if (epoch !== this.sessionEpoch) throw new DOMException('Session changed', 'AbortError');
        if (typeof result.csrfToken !== 'string' || !result.csrfToken)
          throw new ApiError(0, 'INVALID_RESPONSE', 'The server returned an invalid response.');
        this.setCsrfToken(result.csrfToken);
      };
      const pending = (async () => {
        if (typeof navigator !== 'undefined' && navigator.locks)
          await navigator.locks.request(`schoolwell-auth:${this.baseUrl}`, renew);
        else await renew();
      })().finally(() => {
        if (this.refreshPending === pending) this.refreshPending = undefined;
      });
      this.refreshPending = pending;
    }
    return this.refreshPending;
  }
  request<T>(
    path: string,
    options: RequestOptions = {},
    renewed = false,
    quietUnauthorized = false,
  ): Promise<T> {
    if (
      !options.fresh &&
      (options.method ?? 'GET') === 'GET' &&
      /^\/(platform|schools)\//.test(path)
    ) {
      return this.reads.read(
        path,
        () =>
          this.performRequest<T>(
            path,
            { ...options, signal: undefined },
            renewed,
            quietUnauthorized,
          ),
        options.signal,
      );
    }
    return this.performRequest<T>(path, options, renewed, quietUnauthorized);
  }
  private async performRequest<T>(
    path: string,
    options: RequestOptions = {},
    renewed = false,
    quietUnauthorized = false,
  ): Promise<T> {
    if (!this.baseUrl) throw new ApiError(0, 'CONFIGURATION', 'The backend URL is not configured.');
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path');
    const method = options.method || 'GET';
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers['X-CSRF-Token'] = await this.csrfToken();
    }
    options.signal?.throwIfAborted();
    const generation = this.generation;
    const sessionEpoch = this.sessionEpoch;
    const timeout = AbortSignal.timeout(15000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    try {
      const response = await this.transport(`${this.baseUrl}${path}`, {
        method,
        headers,
        credentials: 'include',
        signal,
        body: method === 'GET' ? undefined : JSON.stringify(options.body ?? {}),
      });
      if (
        response.status === 401 &&
        !renewed &&
        !['/auth/login', '/auth/refresh', '/auth/csrf'].includes(path)
      ) {
        const failure = await response
          .clone()
          .json()
          .catch(() => null);
        // Only this code guarantees rejection before a mutation handler ran.
        if (failure?.error?.code === 'REFRESH_REQUIRED') {
          if (sessionEpoch !== this.sessionEpoch)
            throw new DOMException('Session changed', 'AbortError');
          try {
            await this.refreshAccess();
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
              this.clearSession();
              this.unauthorized.forEach((listener) => listener());
            }
            throw error;
          }
          if (sessionEpoch !== this.sessionEpoch)
            throw new DOMException('Session changed', 'AbortError');
          return this.performRequest<T>(path, options, true);
        }
      }
      // Authentication failure must clear protected UI even if a proxy returns a non-JSON body.
      if (
        response.status === 401 &&
        !quietUnauthorized &&
        path !== '/auth/login' &&
        generation === this.generation
      ) {
        this.clearSession();
        this.unauthorized.forEach((listener) => listener());
      }
      if (response.status === 403 && method !== 'GET' && !quietUnauthorized) this.clearSession();
      if (!response.ok) {
        const failure = await response
          .clone()
          .json()
          .catch(() => null);
        if (
          failure?.error?.code === 'STUDENT_FIELDS_INVALID' &&
          failure.error.fields &&
          typeof failure.error.fields === 'object'
        ) {
          const allowed = new Set([
            'name',
            'admissionNumber',
            'birthDate',
            'guardianName',
            'guardianRelation',
            'guardianPhone',
            'address',
            'classId',
            'sectionId',
            'rollNumber',
            'status',
          ]);
          const fields = Object.fromEntries(
            Object.entries(failure.error.fields).filter(
              ([key, value]) =>
                allowed.has(key) && typeof value === 'string' && value.length <= 400,
            ),
          ) as Record<string, string>;
          if (Object.keys(fields).length)
            throw new ApiError(
              response.status,
              'STUDENT_FIELDS_INVALID',
              Object.values(fields)[0],
              response.headers.get('X-Request-ID') || undefined,
              fields,
            );
        }
        const safeCode =
          typeof failure?.error?.code === 'string' &&
          Object.hasOwn(setupMessages, failure.error.code)
            ? (failure.error.code as string)
            : '';
        if (safeCode)
          throw new ApiError(
            response.status,
            safeCode,
            setupMessages[safeCode],
            response.headers.get('X-Request-ID') || undefined,
          );
        throw new ApiError(
          response.status,
          `HTTP_${response.status}`,
          response.status === 404 && path.startsWith('/auth/')
            ? 'The authentication API is unavailable. Enable backend authentication and verify the API URL, then restart the backend.'
            : messages[response.status] || 'The backend is unavailable. Please retry.',
          response.headers.get('X-Request-ID') || undefined,
        );
      }
      const envelope: unknown = await response.json().catch(() => {
        throw new ApiError(0, 'INVALID_RESPONSE', 'The server returned an invalid response.');
      });
      if (
        !envelope ||
        typeof envelope !== 'object' ||
        !('data' in envelope) ||
        !('status' in envelope) ||
        envelope.status !== response.status ||
        !('error' in envelope) ||
        envelope.error !== null
      ) {
        throw new ApiError(0, 'INVALID_RESPONSE', 'The server returned an invalid response.');
      }
      if (path === '/auth/login' && method === 'POST') this.reads.clear();
      else if (method !== 'GET' && path !== '/auth/refresh') this.invalidateReads();
      return envelope.data as T;
    } catch (error) {
      if (isCancelled(error)) throw error;
      if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        0,
        timeout.aborted ? 'TIMEOUT' : 'NETWORK',
        timeout.aborted
          ? 'The backend took too long to respond. Please retry.'
          : 'Unable to reach the backend. Check your connection and retry.',
      );
    }
  }
}
export const apiService = new ApiService(apiBaseUrl);
