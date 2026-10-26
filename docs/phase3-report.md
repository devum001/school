# Phase 3 implementation and verification report

Live mode now connects authentication and read-only Settings → General to the backend. The protected profile endpoint resolves school data and the selected academic year within the same tenant. Demo mode stays independent. Profile editing and all other school modules remain outside this integration.

## Delivered behavior

- Central typed API service with credentialed cookies, in-memory CSRF management and login rotation, safe errors, timeouts, and cancellation.
- Minimal login using existing UI styles, session restoration, safe logout, school selection from verified memberships, and explicit empty/error/retry states.
- Explicit demo/live Vite configuration and separate application imports. Live mode never reads or writes the demo repository, merges demo records, or changes modes after a backend failure.
- Session and active-membership checks plus `school.profile.view` on the new profile GET. Approved response fields only; academic-year queries include both ID and school ID.
- Minimal academic-year storage/reference, nullable setup state, and idempotent transactional initialization of the new grant for existing built-in owners. Custom roles require explicit delegation.
- Additive `schoolName` labels in the account's own active membership response. No public school listing or operator secrets in the frontend.

The existing uncommitted backend changes and frontend `PROJECT_INTEGRATION_AUDIT.md` were preserved. No baseline files were deleted. The demo router matches the original router byte-for-byte except its exported variable name. Neither repository's dependency manifest nor lockfile changed. Private environment files were not edited, and production Atlas data was not used.

## Actual verification results

| Check | Result |
| --- | --- |
| Frontend `npm run typecheck` | Passed |
| Frontend `npm run lint` | Passed |
| Frontend `npm test` | 202 tests passed across 33 files |
| Frontend `npm run build` in demo mode | Passed |
| Frontend `VITE_APP_MODE=live VITE_API_BASE_URL=http://127.0.0.1:3107/api/v1 npm run build` | Passed; live build emits the live application without the demo router bundle |
| Backend `yarn typecheck` | Passed |
| Backend `yarn lint` | Passed |
| Backend `yarn test` | 97 tests passed across 17 suites |
| Backend `yarn build` | Passed |
| Live Playwright suite | All 6 tests passed against the isolated local backend, with deliberately intercepted failure/empty/delayed-response cases |
| Settings, accessibility, and header browser regressions | All 6 selected tests passed on the final rerun |
| Existing demo suite | 8 tests passed; 1 pre-existing test failed as described below |
| Both repositories `git diff --check` | Passed |

Browser tests used `/usr/bin/google-chrome` via `PLAYWRIGHT_CHROME_PATH`. The live suite command was `npx playwright test --config playwright.live.config.ts`. The selected demo regression command was `npx playwright test tests/demo.e2e.ts tests/settings.e2e.ts tests/accessibility.e2e.ts tests/header-fit.e2e.ts --workers=2`. The settings/accessibility/header subset was rerun successfully after separating artifact directories. These runs establish 14 distinct passing existing browser regressions; the entire unrelated browser suite was not run.

The first combined regression run had 13 passes and 2 failures: the stale demo selector below and a test-artifact collision from concurrent Playwright runs. Separate demo/live output directories resolved the collision. An initial live fixture import-order failure and an assertion using incomplete Playwright request headers were corrected before the six-test successful run. No new tests were skipped to make the checks pass.

The existing `tests/demo.e2e.ts:17` asks for a navigation link named **Classes & sections**, which the original AppShell no longer contains. It times out before its remaining presentation steps. The same test failed at the same line when run with the original committed router; the Phase 3 router was restored afterward and verified. That test and the unrelated demo navigation were left unchanged. This pre-existing failure means the selected browser set is not entirely green.

Nonfatal tool output included an existing npm user-config `node_gyp` warning, Playwright color-environment notices, and Rollup warnings about annotations in Zod dependencies. They did not fail typecheck, lint, unit tests, or builds.

## Scope and remaining configuration

Set frontend `VITE_APP_MODE=live` and `VITE_API_BASE_URL` including the API prefix, then restart/rebuild Vite. Configure the backend's authentication flag, private session secret, exact frontend CORS origin, MongoDB URI, and appropriate cookies. Keep onboarding credentials exclusively on the server. No production environment values were supplied or altered by this task.

Atlas connectivity and transaction/index privileges still require deployment validation. The new authenticated startup step adds the profile-read grant to existing built-in owners and records an audit event; new academic-year indexes are additive. No migrations, seed scripts, or destructive database commands were run.

Academic-year setup and profile edits have no endpoint in this phase. New schools correctly show setup required, and unsupported profile fields show Not configured. Production needs HTTPS, reviewed cookie/site topology, existing Phase 2 operator processes, and deployment-specific secret management. Account recovery, invitations, and MFA remain unimplemented.

The live browser fixture uses two synthetic schools in a generated, owned local MongoDB replica set. It requires a local `mongod` binary and permitted loopback sockets/process creation. It never consumes the configured Atlas URI. It cleans up only the process and temporary data directory it created. An initial cleanup check found three stopped fixture directories left by Playwright’s default forced shutdown. Their process IDs, test replica names, recorded data paths, and filesystem ownership were verified before removing those temporary directories. The test configuration now requests graceful SIGTERM shutdown so the fixture can perform its own cleanup. The final live run passed all six tests and left zero fixture directories. One intermediate run was interrupted by a Vite reload while watched documentation was edited; the final run completed without concurrent source edits. Its configured backend checkout path and browser executable path may need adjustment on CI or another machine.

See [integration configuration and API contract](phase3-integration.md) and the backend's `PHASE3_API.md` for details.

## Frontend changed files

Paths are relative to `/home/devendra/schooool`. The inventory compares fingerprints captured before Phase 3, excluding generated artifacts and private environment files.

| File | Change |
| --- | --- |
| [.env.example](../.env.example) | Added |
| [README.md](../README.md) | Modified |
| [docs/phase3-integration.md](../docs/phase3-integration.md) | Added |
| [playwright.config.ts](../playwright.config.ts) | Modified |
| [playwright.live.config.ts](../playwright.live.config.ts) | Added |
| [src/app/demoRouter.tsx](../src/app/demoRouter.tsx) | Added |
| [src/app/liveRouter.tsx](../src/app/liveRouter.tsx) | Added |
| [src/app/router.tsx](../src/app/router.tsx) | Modified |
| [src/features/auth/LoginScreen.tsx](../src/features/auth/LoginScreen.tsx) | Added |
| [src/features/auth/sessionStore.test.ts](../src/features/auth/sessionStore.test.ts) | Added |
| [src/features/auth/sessionStore.ts](../src/features/auth/sessionStore.ts) | Added |
| [src/features/auth/useSession.ts](../src/features/auth/useSession.ts) | Added |
| [src/features/live/LiveApp.tsx](../src/features/live/LiveApp.tsx) | Added |
| [src/features/live/live.css](../src/features/live/live.css) | Added |
| [src/features/settings/LiveSchoolProfile.tsx](../src/features/settings/LiveSchoolProfile.tsx) | Added |
| [src/features/settings/useSchoolProfile.ts](../src/features/settings/useSchoolProfile.ts) | Added |
| [src/services/apiService.test.ts](../src/services/apiService.test.ts) | Added |
| [src/services/apiService.ts](../src/services/apiService.ts) | Added |
| [src/services/authService.ts](../src/services/authService.ts) | Added |
| [src/services/runtimeConfig.ts](../src/services/runtimeConfig.ts) | Added |
| [src/services/schoolProfileService.ts](../src/services/schoolProfileService.ts) | Added |
| [src/vite-env.d.ts](../src/vite-env.d.ts) | Added |
| [tests/live-api.e2e.ts](../tests/live-api.e2e.ts) | Added |
| [vite.config.ts](../vite.config.ts) | Modified |
| [docs/phase3-report.md](../docs/phase3-report.md) | Added |

## Backend changed files

Paths are relative to `/home/devendra/scholl backend/type-ORM-backend-Node`. Pre-existing Phase 1 and Phase 2 changes are excluded.

| File | Change |
| --- | --- |
| `PHASE3_API.md` | Added |
| `README.md` | Modified |
| `src/api/controllers/auth.controller.ts` | Modified |
| `src/api/controllers/registeredControllers.ts` | Modified |
| `src/api/controllers/schoolProfile.controller.ts` | Added |
| `src/api/models/foundation.models.ts` | Modified |
| `src/api/services/schoolProfile.service.test.ts` | Added |
| `src/api/services/schoolProfile.service.ts` | Added |
| `src/loaders/foundationLoader.test.ts` | Modified |
| `src/loaders/foundationLoader.ts` | Modified |
| `src/security/foundation.integration.test.ts` | Modified |
| `src/security/permissions.ts` | Modified |
| `src/security/profileOwnerGrant.ts` | Added |
| `src/security/schoolProfile.integration.test.ts` | Added |
| `src/test/phase3BrowserRuntime.ts` | Added |
| `src/test/phase3BrowserServer.ts` | Added |
