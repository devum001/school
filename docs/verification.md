# Verification record

Verified on 10 October 2026 with Node.js 24.14.1, npm 11.11.0, Vite 7.3.7, Vitest 5.0.3, and installed Google Chrome through Playwright.

| Command                                                              | Observed result                                                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                  | Passed strict TypeScript checking                                                             |
| `npm run lint`                                                       | Passed, no errors or warnings                                                                 |
| `npm test`                                                           | 20 tests passed in one domain test file                                                       |
| `npm run build`                                                      | Passed TypeScript project build and Vite production bundle; route chunks generated in `dist/` |
| `PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome npm run test:e2e`     | All 8 tests passed, 14.3 seconds on the final run                                             |
| `npm audit --audit-level=moderate --cache /tmp/schoolwell-npm-cache` | Found 0 vulnerabilities                                                                       |

Formatting is enforced by Prettier; `npm run format:check` is the final formatting check.

## Browser coverage

- Full presentation: dashboard → classes → attendance edits/save → selected/eligible recipients → message preview/confirmation → simulated success/failure → student profile → monthly attendance → simulated payment/receipt → academic report → documents → reload persistence → dashboard.
- Canceling unsaved navigation, discarding a draft, and switching sections without silently saving changes.
- Directory admission-number search, text search, empty state, clearing filters, inactive-student filter and class filtering.
- Mark-all-present with explicitly unmarked students and switching to historical dates.
- Confirmed reset restores the original attendance state.
- Mobile navigation and horizontal overflow checks at 390 × 844; mobile student profile and fees.
- All top-level routes render without uncaught browser errors; desktop overflow checks at 1440 × 1050.
- Axe automated WCAG A/AA rules on the dashboard, directory, attendance register, notification composer, and student fee tab. No violations in the scanned states. This is not a full manual accessibility audit or compliance certification.

The [desktop overview](screenshots/overview.png) and [mobile overview](screenshots/mobile.png) screenshots were captured from the passing browser suite and visually inspected. Responsive data tables scroll inside their panels rather than expanding the page.

## Issues discovered and resolved

- First build found an unused import; it was removed.
- First lint run found payment-reference creation using an impure render-time call; it now uses a lazy state initializer. Route boundaries and feedback hooks were separated to satisfy fast-refresh lint rules without suppressions.
- The original sandbox could not resolve the npm registry (`EAI_AGAIN`), and the local browser server could not start inside the restricted sandbox. Network installation/audit and browser test commands completed with approved execution permissions.
- The first dependency audit found three advisories in the initially selected test toolchain. The new test/lint packages were updated to compatible versions; the final audit reports zero vulnerabilities. Existing backend packages were not changed or audited as part of that result.
- The first browser suite had six passing tests and one failing directory test. Clearing search and immediately changing status could reuse stale URL parameters. Synchronous URL-state updates fixed that regression; the original failing test now passes.
- The first accessibility scan reported low text contrast. Text colors and small type sizes were corrected and the shared local font was added. All five scanned screens pass the final automated check.

## Non-failing warnings and verification limits

The host npm configuration prints an existing `Unknown user config "node_gyp"` warning. Playwright's environment prints a `NO_COLOR`/`FORCE_COLOR` warning. Vite reports two upstream Zod comment-annotation warnings and removes the comments while building successfully. None were hidden or treated as passing failures.

The backend was inspected but neither started nor tested. No MongoDB server, migration, real authentication, cross-tenant backend access, live parent message, real payment, external document store, or hosted deployment was exercised. Backend production guarantees remain proposed work in [architecture.md](architecture.md).

Printing uses the browser's print dialog with an isolated receipt/report print stylesheet; preview rendering was tested, but physical printer output was not tested. Chrome was the only browser engine used. Multi-tab concurrent edits and durable server persistence are not implemented.

## Presentation update — 11 October 2026

Following the portal copy refresh, Hindi notification template, saved-record copy migration, and forest-teal/gold theme change:

- `npm run lint`: passed.
- `npm test`: all 22 tests passed, including Hindi personalization/date formatting and preservation of stored attendance and financial totals during legacy display-copy refresh.
- `npm run build`: strict TypeScript compilation and production build passed; the same non-failing upstream Zod annotation warnings remain.
- `npm run format:check`: passed.
- `PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome npm run test:e2e`: all 8 tests passed in 14.3 seconds on the isolated test server. The suite also verifies Hindi message text and absence of demo-related wording on every top-level page. The automated accessibility audit passes with the new dark school theme.
- Desktop and mobile screenshots above were refreshed; the desktop screenshot was visually reviewed.

Screenshot review found a pre-existing dev server was serving stale shell styling. Playwright now uses a fresh server on port 5175 and explicitly asserts the sidebar/header background colors. The final screenshot confirms the teal-and-gold theme.

The first attempt to authorize browser execution timed out in automatic approval review. The permitted retry succeeded. No backend connection or real message dispatch was introduced.

## Live school date — 11 October 2026

Removed the fixed application date. Current-date defaults and new transactions now use Asia/Kolkata. Current-month attendance summaries follow the calendar; the shared date hook updates on focus/visibility and at 30-second intervals. Historical records and explicitly selected historical dates are preserved. An open attendance register retains its date so an overnight rollover cannot move an unsaved draft to another day.

Verification: lint and formatting passed, 24 unit tests passed, strict TypeScript/production build passed, and all 9 browser tests passed (17.0 seconds). Date tests cover India's midnight boundary, month/year changes, defaults across screens, and retaining a selected historical date after rollover. A payment/activity field-mapping error caught during the initial build and browser run was fixed before the final passing runs. Existing non-failing Zod build warnings remain.

## Populated current-date presentation — 11 October 2026

Attendance sample data now follows the current school date, supplying today's summary and a recent trend. Browser restoration merges missing records with stored attendance, giving saved statuses precedence, including explicitly unmarked records. Existing payments and notification history are preserved. The same attendance refresh runs when the school date changes while the portal is open.

Verification: lint passed, all 27 unit tests passed, and strict TypeScript/production build passed. All 10 browser tests passed in 16.0 seconds, including restoration from an older browser cache and populated attendance after date rollover. Desktop and mobile screenshots were refreshed; visual review confirms today's dashboard shows 122 attending students, the attendance trend, class summaries, and fee data.

## Class test tracking and rankings — 11 October 2026

Added daily/monthly tests, pre-boards and term exams with class/section scope, custom subject maximums, editable marks, explicit absent and pending states, recent/earlier test history, date/type filters, CSV export, student history and top-three competition ranks. Overall scores use earned marks divided by possible marks across completed tests shared by the selected roster. Tests and marks persist alongside existing browser data; legacy caches keep their attendance and payments. The backend remains unchanged and disconnected.

- All 34 unit tests passed. New cases cover 20/30/200 maxima, weighted percentages, ties, pending-test exclusion, section isolation, absence versus zero and pending, invalid marks, duplicate subject names, dates, record updates and persistence migration.
- All 10 existing browser scenarios passed during the full suite. Two initial new scenarios identified ambiguous select labels; explicit accessible names fixed those controls. All three new academic scenarios then passed, followed by a passing rerun of those scenarios and workspace reset after narrowing marks entry to the selected class/section.
- Browser workflows cover creating daily tests and multi-subject pre-boards, partial entry, completing results, automatic rankings, reload persistence, student history, CSV downloads and unsaved-dismissal protection. Automated WCAG A/AA checks cover the academic overview, test creation and marks entry; mobile overflow checks pass.
- Lint, formatting and strict TypeScript/production build passed. Existing non-failing host and upstream Zod warnings remain.

The [results overview](screenshots/results.png), [mobile results](screenshots/results-mobile.png) and [mobile marks register](screenshots/marks-mobile.png) were captured from the browser checks. Layout review led to clearer mobile search placement, directly clickable test names, and separated student name/section lines.

## Student history and WhatsApp report sharing — 11 October 2026

Replaced compressed horizontal examination cards with spacious, selectable rows with aligned marks/percentage columns and a stacked mobile layout. Added a Hindi text-report preview for one test or all recorded tests, parent-number validation, WhatsApp contact selection, and a copy-message fallback. Sharing prepares a click-to-chat URL; automated checks never open WhatsApp or send a message. PDF attachment and delivery confirmation are not implemented.

Verification: all 38 unit tests passed; lint, formatting and strict TypeScript/production build passed. The existing complete-school and new-test browser workflows passed. The new student-history/share scenario passed after accessibility checks identified two scroll regions needing keyboard focus (the message preview and the mobile marks table). It checks selected-test state, text content, actual maximum marks, encoded URLs, invalid contacts, international number normalization, all-test scope, mobile overflow and automated WCAG A/AA rules. Actual WhatsApp account/login behavior and message delivery were not exercised.

The [student history](screenshots/student-history.png), [mobile history](screenshots/student-history-mobile.png) and [WhatsApp report preview](screenshots/whatsapp-report.png) were captured from the final passing browser scenario and visually reviewed.

## Test absence tracking — 11 October 2026

Added separate took-test, absent and pending counts to examination history, test summaries and marks entry. Test averages, performance bars and per-test rankings use participating students only, including students with a legitimate zero score. Overall cumulative scoring retains the existing zero-for-absence policy. The per-test A–Z absence tracker includes guardian details, CSV export and a Hindi WhatsApp notice preview scoped to the selected student/test/date. Saved absence records are reused, so historical tests and reloads retain their tracker state.

Verification: lint and strict TypeScript/production build passed; all 41 unit tests passed. All five targeted academics, student-sharing and absence-tracking browser scenarios passed (16.3 seconds), including refresh persistence, correcting absence to participation, zero versus pending, phone-link content, mobile overflow and automated WCAG A/AA checks. Unit cases cover each of the four test categories, entirely absent rosters, excluded absences in averages/ranks and refusing notices for a student not absent from that test. No WhatsApp navigation or real message sending was performed.

The [test absence tracker](screenshots/test-absences.png) was captured and visually reviewed after the passing browser run.

## Student, teacher and test management — 11 October 2026

Added student creation/editing/deletion, guardian contacts, enrollment validation and inactive status; teacher profiles, search/filter/export, active status and class-teacher assignments; and examination metadata editing/deletion with saved-score validation. Permanent deletion uses explicit confirmation and identifies affected records. Browser restoration retains these changes, including intentionally empty collections, without recreating deleted student attendance.

Verification: all 48 unit tests passed; lint, formatting and strict TypeScript/production build passed. The complete Chrome suite passed all 19 scenarios in 58.6 seconds. New browser scenarios exercise student add/edit/delete/reload, teacher assignment replacement and release, maximum-mark changes, test deletion, confirmation cancellation, accessibility and mobile overflow. Two initial assertions used incorrect UI selectors; they were corrected before the complete passing run. Existing attendance, fees, parent reports and absence workflows passed unchanged. Non-failing upstream Zod annotation warnings remain.

The [teacher directory](screenshots/teachers.png) and [mobile teacher form](screenshots/teacher-form-mobile.png) were captured and visually reviewed. No backend connection, deployment or external message sending was performed.
