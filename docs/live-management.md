# Live school management

The live frontend connects login, school selection and profile, roles and permissions, memberships, audit history, and account sessions to the existing backend. There is no demo fallback when an API fails. Student, attendance, fee, academic-year editing, and other school-domain APIs are not implemented yet; those modules remain unavailable in live mode.

## Run locally

The ignored frontend `.env.local` selects `VITE_APP_MODE=live` and `VITE_API_BASE_URL=http://localhost:3000/api/v1`, preserving the original `.env`. Restart Vite after configuration changes:

```sh
cd /home/devendra/schooool
npm run dev
```

The backend's existing `.env` is preserved. Before real login can work, configure these backend variables privately:

- `MONGO_ENABLED=true` and a valid `MONGODB_URI` for a replica set or sharded cluster supporting transactions.
- `AUTH_ENABLED=true` and a cryptographically random `JWT_SECRET` of exactly 64 hexadecimal characters. Changing this secret invalidates existing sessions.
- `FRONTEND_ORIGIN=http://localhost:5173`; if `CORS_ORIGINS` is set, it must also include that exact origin.
- For local HTTP only: `COOKIE_SECURE=false`, `COOKIE_HTTP_ONLY=true`, and `COOKIE_SAME_SITE=lax`. Production requires HTTPS and secure cookies.
- Keep `DEMO_ENABLED=false`.
- For initial setup only, enable `ONBOARDING_ENABLED=true` and configure a separate random 64-hex-character `ONBOARDING_KEY`, different from `JWT_SECRET`. Disable onboarding when finished.

No secrets belong in `VITE_` variables. Do not paste passwords, keys, or MongoDB connection strings into chat, committed files, or shell command arguments.

Start the backend in a separate terminal after completing configuration:

```sh
cd "/home/devendra/scholl backend/type-ORM-backend-Node"
yarn dev
```

`/health/live` indicates the HTTP process is alive; `/health/ready` reports readiness, including the configured database. An alive response alone does not prove that authentication routes are enabled. A 401 from `/api/v1/auth/session` before login is expected; a 404 means the authentication API or API prefix needs checking.

## Create the first school and account

For the Super Admin dashboard and one-time platform administrator setup, see [Super Admin platform administration](super-admin.md). After setup, school/account creation can be done in that protected dashboard. The terminal options below remain available for trusted operator use.

An operator is the trusted person administering the platform. The existing backend deliberately provides no public registration API. Its setup endpoints reject browser-origin calls and require a private key, so school/account creation stays in a trusted terminal.

With onboarding enabled and the backend running, launch:

```sh
cd "/home/devendra/scholl backend/type-ORM-backend-Node"
node commands/onboard.cjs
```

The command reads the operator key privately from backend configuration, prompts for a school and owner or an account only, hides password input, and requires typing `CREATE` before submitting. It calls only the existing local operator API; it does not directly access MongoDB. Running the command and confirming will create real records in the database configured by that running backend.

Choose `school` to create a school and its first owner. Supply an existing owner account ID if that account already exists, or leave the ID empty to create a new account. Choose `account` to create an additional user, then sign in as a school administrator and add that account by email from Members. This is not an email invitation service. No passwords are generated or sent by email.

Disable `ONBOARDING_ENABLED` afterward. Sign in using the account credentials you entered. Recovery, self-service registration, password changes, and profile editing require additional backend APIs and are not presented as working features.

## Connected workflows

| Screen                       | Backend requests                                                    | Behavior                                                                      |
| ---------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Login and session            | GET auth/csrf, POST auth/login, POST auth/refresh, GET auth/session | HttpOnly cookie, CSRF rotation, expiry and safe errors                        |
| School selection and General | GET schools/:id/profile                                             | Membership-based selection, read-only profile, explicit missing academic year |
| Roles                        | GET permissions, GET/POST/PATCH/DELETE schools/:id/roles            | Create, edit, delete unassigned custom roles; immutable Owner                 |
| Members                      | GET/POST/PATCH/DELETE schools/:id/memberships                       | Add existing accounts, change role/status, suspend and reactivate             |
| Activity                     | GET schools/:id/audit-events                                        | School-scoped paginated history, oldest first                                 |
| Account                      | POST auth/logout, POST auth/logout-all                              | Current-device and all-device sign-out                                        |

All protected management tabs check `GET schools/:id/memberships/me`. Server authorization remains authoritative on every request. Manage does not implicitly grant view permission. The member role picker requires roles.view and offers only roles the current account can assign. Owner membership changes require an owner; the backend refuses removal of the last active owner. Assigned roles remain protected even when their memberships are suspended.

Mutation failures never cause an automatic write retry. If a network error occurs after submitting, refresh to verify whether it succeeded before retrying. School/tab changes discard old read responses. Changes to your own permissions refresh the access context after successful writes.

## Verification on 18 October 2026

- Frontend: `npm run typecheck`, `npm run lint`, `npm test` — passed, 210 tests in 34 files.
- Frontend live build: `VITE_APP_MODE=live VITE_API_BASE_URL=http://localhost:3000/api/v1 npm run build` — passed.
- Backend: `npm run typecheck`, `npm run lint`, `npm test` — passed, 98 tests in 17 suites.
- Terminal setup client: `node --check commands/onboard.cjs` and `node --test commands/onboard.test.cjs` — passed, 3 tests. HTTP requests are mocked in these client tests; the existing backend integration suite separately tests the real operator endpoints. The interactive terminal itself has not been used to create real accounts.
- Live browser tests: `PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome npx playwright test --config playwright.live.config.ts` — 7 passed. These start the real backend with an owned temporary local MongoDB replica set, never the configured Atlas URI.

Browser coverage includes cookie login, session restoration, logout, error sanitization, profile retries, stale-response cancellation, role creation/edit/deletion, adding/suspending/reactivating a member, school isolation, permission denials, last-owner protection, audit history, all-device logout, mobile overflow, and accessibility checks. Failures such as 503 and stale profile responses are explicitly intercepted; the management workflow uses real HTTP endpoints and real isolated persistence.

The full unrelated demo browser suite was not rerun for this work. Build output contains existing dependency annotation warnings from Zod; npm reports an existing user-level node_gyp configuration warning. These do not fail the checks.

## Files changed for this extension

Frontend additions: `src/services/schoolAccessService.ts`, its test file, `src/features/live/LiveSettings.tsx`, `LiveRoles.tsx`, `LiveMembers.tsx`, `LiveAudit.tsx`, `LiveAccount.tsx`, `useRemote.ts`, this guide, and ignored `.env.local`.

Frontend updates: `src/features/live/LiveApp.tsx`, `live.css`, `src/features/auth/sessionStore.ts`, `src/services/apiService.ts`, `apiService.test.ts`, `authService.ts`, and `tests/live-api.e2e.ts`.

Backend additions: `commands/onboard.cjs`, `commands/onboard.test.cjs`. Backend updates: `src/api/controllers/schoolAccess.controller.ts` adds safe name/email and role-name projections only for the authorized membership page; `src/security/foundation.integration.test.ts` verifies projection and tenant isolation; `src/test/phase3BrowserRuntime.ts` adds a synthetic account to the isolated browser fixture.

Existing changes from prior phases were preserved. No dependencies, lockfiles, existing `.env` files, Atlas records, or production databases were modified. Both `.env` files and the frontend override are Git-ignored. The live screens are tested; enabling authentication and creating your real first account remain manual configuration steps.

## JWT authentication update

Live mode now uses short-lived JWT access cookies and rotating JWT refresh cookies. Both are HttpOnly; JavaScript never receives or stores their values. The API client renews only on the server's `REFRESH_REQUIRED` response, which is emitted before entering a protected controller, and retries that rejected request once. Ordinary failures and ambiguous mutation results are not automatically retried. Same-tab renewal is coalesced; browsers supporting Web Locks serialize renewal across same-origin tabs and recheck the session before rotating again. Without Web Locks, simultaneous cross-tab rotation may safely force a new login through replay detection.

The backend validates algorithm, signature, issuer, audience, token type, subject, session identifier and expiry. Access lifetime defaults to five minutes. The session's absolute lifetime is not extended by refresh. A reused refresh token revokes that session, including its access JWTs. Account status, Super Admin status, school status, membership and permissions remain database-checked, so stale JWT claims cannot grant access. JWT payloads contain no role or school grants.

Configure `JWT_SECRET` only in the backend or a secret manager: 32 cryptographically random bytes encoded as 64 hexadecimal characters. This single backend uses HS256 with separate derived keys for access and refresh signatures; do not distribute this signing secret to other services. Independent verifying services should use an asymmetric-key issuer or an identity provider. `SESSION_SECRET` is a temporary fallback only when `JWT_SECRET` is absent. Existing opaque-cookie logins must sign in again after upgrading. Rotating the root key immediately invalidates JWTs and CSRF signatures; there is no overlapping-key rollout in this version.

Keep `ONBOARDING_ENABLED=false` after bootstrapping the first Super Admin. Production requires HTTPS, Secure cookies, exact CORS origins, secret-manager configuration, tested backups and monitoring. MFA, account recovery and independent security review remain separate work before a commercial launch; switching to JWT does not provide those features.

Verification for this update: backend Jest passed 130 tests in 20 suites; frontend Vitest passed 217 tests in 35 files; Playwright passed 9 live-browser tests against disposable local MongoDB, including two-tab JWT renewal. The final browser-lock typing fix was checked with all 17 API-client unit tests. TypeScript and lint passed in both repositories, and the explicit live frontend build passed. Existing npm configuration and Zod build annotation warnings remain non-fatal. Local `.env` validation passed after adding the approved JWT key and disabling onboarding, but the development server was not reachable on port 3000 during the final HTTP check. No application database records were modified by these checks.

## Application loading and request reuse

Session initialization is owned by `sessionStore.initialize()`. Concurrent callers join one restoration; component remounts subscribe to its result rather than aborting and restarting it. Revalidation keeps the authenticated workspace mounted and preserves the selected school when membership is still valid. A fresh page load still validates the HttpOnly session with the backend. Anonymous startup produces one session check, with no school queries or expiry warning.

The shared API client coalesces school/platform GET requests and caches successful responses in memory for 30 seconds, with at most 100 entries keyed by the full resource path and query. Canceling a component's read detaches that consumer without canceling a request another consumer needs. Errors are not cached. Auth/CSRF endpoints and mutations bypass this response cache. No tokens, account data or school data are added to localStorage or sessionStorage.

Explicit Refresh/Retry actions and successful mutations invalidate cached resource data. Pending reads invalidated by a data change revalidate; logout, authentication failure and successful login discard previous-session results. Permissions remain enforced by the backend on requests; the bounded cache is for presentation data, not authorization. School access context is shared across tabs and now drives the visible navigation and default landing screen, including the General profile tab.

Verified with 229 frontend unit tests and all 10 live browser tests. The new browser test asserts exactly one anonymous session check, one session restoration after login, one initial platform school-list request, no additional school-list request on a quick tab round trip, a new request on explicit Refresh, and exactly one session plus one school-list request after a normal authenticated full reload. It also asserts no canceled API requests in that workflow. School switching, mutation refresh, Super Admin controls, logout and JWT renewal still pass against the isolated backend fixture.

The duplicate-effect diagnosis follows [React's Strict Mode lifecycle](https://react.dev/reference/react/StrictMode); Strict Mode remains enabled.

## Account routing and demo access

Ordinary school accounts visiting `/platform`, including after signing out of a Super Admin account and signing in on the same URL, are redirected to `/settings`. Only Super Admins see the platform navigation. School tabs are filtered by the selected school's server-provided permissions. The default screen is the first permitted section; Account remains available without school-specific grants. An unavailable or unknown tab redirects to the first permitted section without requesting the restricted section's data. Users with no active school membership see their account and school-setup guidance. Backend authorization remains authoritative for direct API requests.

To review the existing demo screens alongside the live application, run a second frontend process:

```bash
cd /home/devendra/schooool
VITE_APP_MODE=demo yarn dev --host 127.0.0.1 --port 5174 --strictPort
```

Open `http://localhost:5174`. The override applies only to this command; the live app on port 5173 and existing environment files remain unchanged. The demo uses sample browser data, requires no live login, and does not connect its school screens to your MongoDB records. A different port has separate browser storage, so existing demo edits from another origin are not automatically copied. Live school-domain modules beyond the connected management screens still require their backend integration.
