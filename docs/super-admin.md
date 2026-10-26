# Super Admin platform administration

Super Admins manage school registrations and user accounts from `/platform`. School Owners continue to manage their own school's roles, memberships, and operations. Platform privileges do not automatically grant access to a school's management APIs or create a school membership.

## Available controls

| Area        | Super Admin controls                                                                                   | Removal behavior                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Schools     | List all registrations, create with a new or existing owner, edit name/slug/timezone, suspend, restore | Remove archives the registration and blocks school access; school records remain intact                     |
| Accounts    | List and find by exact email, create ordinary accounts, edit name/email, reset passwords, reactivate   | Remove access disables the account globally and revokes all sessions; memberships and history remain intact |
| Activity    | Paginated platform activity, actor and record references                                               | Activity records are retained                                                                               |
| Own account | View session/account information, sign out, sign out all devices                                       | Super Admin identities are protected from ordinary account editing, disabling, and password reset           |

Suspended and archived schools remain visible in the platform list so they can be restored. School slugs and codes remain reserved while archived. Reactivating an account permits a new login; revoked sessions do not become valid again. Changing an account's email or resetting its password also revokes all of its sessions.

Platform administration does not include students, attendance, grades, fees, timetables, or changes to school-specific roles and memberships. The initial owner is assigned when a school is created; subsequent school access management belongs to that school's authorized administrators.

## First Super Admin setup

Existing accounts are ordinary users by default. No account is automatically promoted, and ordinary school roles cannot grant platform authority. There is no public Super Admin registration form.

The existing backend configuration must first have authentication and MongoDB enabled, a valid MongoDB replica-set/sharded-cluster URI, and a 64-character hexadecimal `JWT_SECRET`. For the initial setup only, enable `ONBOARDING_ENABLED` and configure a separate 64-character hexadecimal `ONBOARDING_KEY`. Do not put either secret in the frontend. See [local backend configuration](live-management.md#run-locally).

Start the configured backend, then run this from its repository:

```sh
cd "/home/devendra/scholl backend/type-ORM-backend-Node"
node commands/onboard.cjs
```

Choose `super-admin`, enter your account name/email and a unique password, and type `CREATE` to submit. Password input is hidden. The command uses the existing private operator key and only permits a local backend target. Confirming creates a real account in the database used by that backend; this setup command was not run against your configured database during implementation.

The first-Super-Admin endpoint is protected by operator authentication and rejects browser-origin requests. It atomically creates the account, a persistent unique bootstrap marker, and an audit event. Repeated or concurrent bootstrap requests cannot create additional Super Admins. A duplicate email rolls back the whole transaction, including the marker.

Disable `ONBOARDING_ENABLED` after setup. Sign in at the normal website login. A Super Admin is directed to `/platform`; platform administration continues to work with operator onboarding disabled. Ordinary accounts go to their school workspace, including when the browser is still on `/platform` after switching accounts. School navigation shows only sections permitted by their school role. An administrator can also use the dashboard's My account section to sign out all devices.

The terminal command still supports its earlier school/account creation options for trusted operator use. Normal daily creation can now take place in the Super Admin dashboard without entering or exposing an operator key in the browser.

## API contract

All paths use the configured `/api/v1` prefix. The platform endpoints require an active authenticated Super Admin on every request. All mutations require the normal browser Origin, JSON content type, and session-bound CSRF token; no onboarding key is accepted as an alternative to a user session.

| Method and path                  | Purpose                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| POST onboarding/super-admin      | One-time trusted bootstrap, operator-only, no browser Origin                                          |
| GET platform/users               | Safe account projections; optional exact `email` and `after` cursor                                   |
| POST platform/users              | Create an ordinary user account                                                                       |
| PATCH platform/users/:id         | Update name, email, or active/disabled status                                                         |
| DELETE platform/users/:id        | Disable account and revoke all sessions                                                               |
| POST platform/users/:id/password | Set a new password and revoke all sessions                                                            |
| GET platform/schools             | All school registrations, including suspended and archived; optional `after` cursor                   |
| POST platform/schools            | Create a school, Owner role/grants, membership, and new owner or existing owner assignment atomically |
| PATCH platform/schools/:id       | Edit registration metadata or set active/suspended status                                             |
| DELETE platform/schools/:id      | Archive school registration without deleting school data                                              |
| GET platform/audit-events        | Platform administrative events only; optional `after` cursor                                          |

Lists are ordered by ascending ID and limited to 50 records with `nextCursor`. Unknown query keys and invalid cursors are rejected. The session DTO adds `user.platformRole` (`user` or `super_admin`); legacy accounts without this field are treated as ordinary users.

The backend also accepts optional school code/email/phone registration updates. The current edit form exposes name, slug, and timezone; school code can be supplied during creation. It does not claim to provide a complete school profile editor.

Platform write transactions recheck the actor's current authority. School status changes share the authorization write lock with school membership/role changes. All responses use explicit safe projections; password hashes, session hashes, authorization counters, and setup secrets are never returned to the browser. User-supplied platform roles and authority fields are rejected.

## Implementation files

Backend additions:

- `src/api/controllers/platform.controller.ts` and `requests/platform.request.ts`
- `src/api/middlewares/platform.middleware.ts`
- `src/api/services/platform.service.ts`, `platformAuthorization.service.ts`, and `platformBootstrap.service.ts`
- `src/security/platform.integration.test.ts`

Backend updates:

- `foundation.models.ts`: platform role/default, platform authorization counter, archived-school status, and a unique bootstrap marker collection
- `onboarding.service.ts`: reuse atomic creation with authenticated platform actor checks and audit attribution
- `auth.controller.ts`, `onboarding.controller.ts`, `registeredControllers.ts`, and its test
- `src/test/phase3BrowserRuntime.ts`: synthetic Super Admin in the isolated browser fixture
- `commands/onboard.cjs` and its test: one-time Super Admin setup option

Frontend additions:

- `src/features/platform/PlatformDashboard.tsx` and `PlatformForms.tsx`
- `src/services/platformService.ts` and its test

Frontend updates:

- `src/features/live/LiveApp.tsx` and `live.css`: protected platform entry, navigation, and forms
- `src/services/authService.ts`: validated platform role in the session
- `src/features/auth/sessionStore.test.ts`: ordinary-user fixture role
- `tests/live-api.e2e.ts`: real Super Admin browser workflow
- This guide, README, and the link from the live-management guide

Existing environment files, credentials, dependencies, lockfiles, and unrelated changes were preserved. Test databases are owned temporary local fixtures; no configured Atlas database was used.

## Operational limits

This version bootstraps one Super Admin. Creating more Super Admins, recovering that identity, changing its password through the UI, MFA, email invitations, and permanent data erasure are not implemented. Keep the initial account credentials secure. The ordinary-user password reset screen does not bypass protection of Super Admin identities.

Global removal controls retain records and audit history. A permanent erase workflow would require a separate, explicit retention and deletion design. There is no school impersonation or automatic tenant-access bypass.

## Verification on 18 October 2026

| Check                              | Command                                                                                                | Result                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Frontend TypeScript                | `npm run typecheck`                                                                                    | Passed                                                       |
| Frontend lint                      | `npm run lint`                                                                                         | Passed                                                       |
| Frontend unit suite                | `npm test`                                                                                             | 214 passed in 35 files                                       |
| Frontend live build                | `VITE_APP_MODE=live VITE_API_BASE_URL=http://localhost:3000/api/v1 npm run build`                      | Passed                                                       |
| Backend TypeScript                 | `npm run typecheck`                                                                                    | Passed                                                       |
| Backend lint                       | `npm run lint`                                                                                         | Passed                                                       |
| Backend unit and integration suite | `npm test`                                                                                             | 107 passed in 18 suites                                      |
| Trusted setup client               | `node --test commands/onboard.test.cjs`                                                                | 4 passed, using mocked HTTP                                  |
| Live browser suite                 | `PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome npx playwright test --config playwright.live.config.ts` | 8 passed against the real backend and isolated local MongoDB |

Security tests cover simultaneous bootstrap requests, rejected repeat bootstrap, legacy-account defaults, owner/anonymous denial, forged authority, missing CSRF, safe projections, query validation, pagination, atomic creation rollback, suspension/archive/restore enforcement, retained school records, disabled-account/session revocation, password reset, protected Super Admin identities, and rechecking existing sessions after role/account changes.

Browser tests include school creation with both a new owner and an existing owner, registration edits, suspend/archive/restore, ordinary account creation/edit/disable/reactivate/reset, activity history, denial of school-management access without membership, denial of platform access to owners, mobile overflow and accessibility checks, plus the previous seven live workflows. All fixture databases were stopped and cleaned up after the runs. The interactive setup command was not used to create a real account.

The earlier live-management verification record remains historical. The full unrelated demo browser suite was not rerun. Existing npm user-configuration and dependency annotation warnings do not fail the checks.

At verification time the backend configuration still had authentication and onboarding disabled and required both secrets to be configured. No existing environment file was edited or secret generated for activation. Those manual setup requirements are separate from the completed implementation and isolated verification above.
