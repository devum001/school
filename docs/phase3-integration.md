# Phase 3 school profile integration

Live mode connects sign-in and Settings → General to the existing backend. It uses server sessions, verified school memberships, and a read-only school profile. Demo mode remains a separate application with its existing browser data and screens. Students, attendance, finance, messaging, and other settings are not integrated in live mode.

## Running demo and live modes

Copy `.env.example` to a private frontend environment file. Vite variables are public build configuration, so never put passwords, session secrets, or the operator key in them.

```dotenv
VITE_APP_MODE=live
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

`VITE_APP_MODE` accepts `demo` or `live` and defaults to `demo`. Live mode requires a valid absolute HTTP(S) API URL including the route prefix. Invalid configuration fails rather than switching to demo. Restart Vite after changing configuration; rebuild static deployments because these settings are embedded at build time. Use HTTPS for deployed frontend and backend URLs.

Start the frontend with `npm run dev`. In the backend repository, configure authentication using the existing `.env.example` and Phase 2 documentation, then run `yarn dev`. For local HTTP development, use the same hostname on both sides, such as `localhost` on ports 5173 and 3000. Mixing `localhost` with `127.0.0.1` changes cookie site behavior. Set backend `CORS_ORIGINS` to the exact frontend origin, including its port. If Vite selects another port, update the allowlist or start it with `--strictPort`.

Required backend configuration includes `AUTH_ENABLED=true`, `MONGO_ENABLED=true`, the existing `MONGODB_URI`, a private `JWT_SECRET`, and `DEMO_ENABLED=false`. Keep sockets disabled. Production requires Secure/HttpOnly cookies and exact HTTPS origins; genuinely cross-site deployments need the backend's `SameSite=None` setting plus Secure, and may be affected by browser third-party-cookie restrictions. Same-site deployment is simpler.

School/account provisioning remains an operator-controlled backend action. Do not put `ONBOARDING_KEY` in the frontend. Use an existing provisioned account with active membership and the explicit profile permission. Existing owners receive that permission during backend startup as described below. Atlas connectivity, credentials, and network access must be verified in the deployment environment; this phase used isolated local databases only.

## Authentication and API foundation

`src/services/apiService.ts` is the only live application fetch boundary. It uses `credentials: 'include'`, typed responses, sanitized errors, abort signals, and a 15-second request timeout. It checks the backend response envelope and exposes status/request identifiers without displaying raw server errors. Feature adapters validate session and profile data before rendering it.

Before a JSON mutation, the client requests `/auth/csrf` and keeps the token only in memory. It coalesces concurrent acquisition requests and refreshes expired tokens. Login sends the CSRF header and JSON credentials; the browser supplies Origin. The client replaces its CSRF token with the session-bound token returned by successful login, then inspects `/auth/session` for identity and memberships. Passwords are cleared from the login form after submission. Session tokens remain in HttpOnly backend cookies, and no live credentials or session state are stored in localStorage.

Session restoration distinguishes signed-out users from unavailable backends. A protected 401 clears authenticated UI. Forbidden responses remain errors, without substituting demo data. Failed mutations are not automatically replayed. Logout is reported as complete only after the backend revokes the session or confirms it has already expired. A network failure during logout keeps the current session visible with an explicit retry message.

School selection uses the account's active memberships. `/auth/session` now adds `schoolName` to each returned membership, using only active schools belonging to that account. The backend still verifies every requested school independently. Selection is held in memory and defaults to the first membership on reload. The existing backend session response limit of 100 memberships remains unchanged.

## School profile API

`GET /api/v1/schools/:schoolId/profile` requires a valid session, active account/school/membership, and `school.profile.view`. The route prefix remains configurable through the backend's existing configuration.

A successful response is:

```json
{
  "status": 200,
  "data": {
    "school": {
      "id": "<school id>",
      "name": "Example School",
      "slug": "example-school",
      "code": null,
      "email": null,
      "phone": null,
      "timezone": "Asia/Kolkata",
      "status": "active"
    },
    "academicYear": null,
    "setupRequired": true
  },
  "error": null
}
```

When configured, `academicYear` contains only `{ id, name, start, end }`, with date-only start/end strings. Schools now have an optional `currentAcademicYearId`, referencing a minimal `academic_years` record with `schoolId`, name, dates, and timestamps. The lookup always includes both the selected year ID and the school ID. Absent, missing, or foreign-school references return `academicYear: null` and `setupRequired: true`; they cannot expose another school's year.

The profile selects and constructs an explicit response projection. Internal version fields, memberships, account credentials, grants, and raw database documents are not returned. Missing/inaccessible schools return 404, absent sessions 401, missing permission 403, malformed IDs 400, unavailable database 503, and unexpected failures a sanitized 500 using the existing error envelope.

The new permission is in the server-defined catalog and is subject to the existing delegation ceiling. New owner roles receive it at onboarding. At authenticated startup, an idempotent initializer adds only `school.profile.view` to existing built-in Owner roles, within the school's authorization transaction boundary. It records `role.profile_grant_initialized` once when a grant is inserted. Custom roles remain unchanged, including custom roles named Owner without the built-in marker. Concurrent startup is covered by the unique grant index and transaction retry. The initializer does not run when authentication is disabled. This is an intentional additive startup write; no migration or seed command is required or was run.

There is no profile editing or academic-year setup endpoint in this phase. Newly provisioned schools therefore show the academic-year setup state until an approved future administration workflow configures it. Do not interpret that state as a failed profile fetch. Do not create years by running demo seeds against a real database. Board, principal, location, website, school hours, and other legacy demo-only fields remain unconfigured in the live screen rather than being populated with fictional data.

## User interface and mode isolation

General settings retains the profile banner, school mark, details layout, and disabled Edit Details button. Loading, setup-required, permission errors, backend failures, and retry are visible. Profile requests are cancelled on school change/unmount, and late responses cannot overwrite the selected school. Accounts with no active membership see a school-setup message.

The existing demo router is preserved separately, and the entry router dynamically imports only the chosen application. Live mode does not import the demo repository or modify its `schoolwell-demo-v1` key. Live routes for unconnected modules display an availability message instead of rendering demo students, fees, or other records. The live shell uses the existing design styles and authenticated account identity. There is no public signup, recovery, invitation, MFA, or operator-provisioning screen.

The build target is ES2022 to support the explicit dynamic application entry. Supported browsers must also provide Fetch, AbortController, and AbortSignal timeout/composition, as used by the API service.

## Testing and local fixtures

Frontend commands:

```sh
npm run typecheck
npm run lint
npm test
npm run build
PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome npx playwright test --config playwright.live.config.ts
PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome npx playwright test tests/settings.e2e.ts tests/accessibility.e2e.ts tests/header-fit.e2e.ts --workers=2
```

Backend commands are `yarn typecheck`, `yarn lint`, `yarn test`, and `yarn build` from `/home/devendra/scholl backend/type-ORM-backend-Node`.

The live Playwright configuration starts Vite at `127.0.0.1:5176` and a test-only backend at `127.0.0.1:3107`. It starts a fresh MongoDB replica set using the existing isolated fixture, verifies ownership of that process, and creates synthetic accounts through the onboarding service. It never uses the configured Atlas URI. Its bootstrap sets test configuration before loading application modules. Playwright requests graceful SIGTERM shutdown; the fixture closes HTTP/MongoDB and removes only its own temporary data directory.

The fixture requires a local MongoDB binary, default `/usr/bin/mongod`, configurable through `MONGOD_BINARY`, and a Playwright-compatible Chrome installation. Set `PLAYWRIGHT_CHROME_PATH` to the local executable when needed. CI needs loopback sockets and process permissions. `playwright.live.config.ts` contains the backend path from this workspace; adjust that path for another checkout layout. Demo and live browser runs use separate artifact directories. Browser failure cases are intercepted deliberately; the primary session/profile/logout flow uses the real isolated API and MongoDB.

See [Phase 3 verification and changed files](phase3-report.md) for actual results, the pre-existing demo-test failure, and the complete file inventory.
