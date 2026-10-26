# Schoolwell — school management prototype

A React/TypeScript school workspace with two explicit modes. **Demo mode** preserves the fictional Vidya Niketan Public School and runs entirely in the browser. **Live mode** connects login, school profiles, bulk academic setup, staff/student imports, annual enrollments, teaching assignments, roles, members, activity, and account sessions to the backend. A separate **Super Admin** dashboard manages school registrations and accounts without automatic access to school operations. See [current demo-to-live product integration](docs/product-integration.md), [bulk school onboarding](docs/bulk-onboarding.md), [live setup](docs/live-management.md) and [Super Admin setup and controls](docs/super-admin.md).

## Start the application

Use **Node.js 24 LTS** and npm. The prototype was verified with Node 24.14.1.

```bash
cd /home/devendra/schooool
npm ci
npm run dev
```

Open the local URL printed by Vite, normally **http://localhost:5173**. If that port is occupied, Vite prints its alternate port. To review the production build:

```bash
npm run build
npm run preview
```

The preview normally runs at http://localhost:4173. A deployed static host needs an SPA fallback to `index.html` for nested routes. This work is local; no hosted site was published.

## Present the demo in five minutes

The application uses **today’s date in Asia/Kolkata**, including new attendance filters, payment records, notifications, and current-month student summaries. The configured academic year remains **2026–2027**. Attendance presentation data is populated for today and recent dates. Saved attendance edits, payments, and notification history are preserved.

1. Open **Overview**. There are 143 active students, 12 teachers, six grades, and two sections per grade. One additional inactive student's enrollment and financial history are retained.
2. Open **Classes & sections → Grade 5 → Section A → Register**.
3. Mark Ananya Sharma, Vihaan Sharma, and Diya Sharma absent. Optionally mark Aarav Sharma absent to demonstrate a missing parent contact. Click **Save attendance**.
4. Open **Notify parents**, then **Select all**. Compare selected students with eligible contacts. Switch the preview recipient to inspect personalized messages.
5. Click **Review notification → Confirm notifications**. The third eligible recipient intentionally needs attention; the history uses “Ready” and “Needs attention.” No messages leave the browser.
6. Open Ananya Sharma from the history. Explore **Attendance**, **Fees**, **Academics**, and **Documents**.
7. In Fees, record a **₹1,000 payment**. Review the sample receipt. The student's original ₹18,000 outstanding balance becomes ₹17,000, and the school total changes by the same amount.
8. Open **Academics → Tests & results** to review daily, monthly and term results. Select Grade 10 for pre-board results; add a test and enter marks to update rankings. Preview an individual academic report from a student profile. Receipt and report previews can be printed.
9. Return to **Overview** and inspect the updated attendance and fee totals.
10. Use **School settings → Reset workspace data** to restore the original presentation state. Reset asks for confirmation.

A workspace guide is also available in the footer. Sample attendance covers nine recent dates ending today, with present, absent, late, half-day, and unmarked students ready for presentation. Existing saved records take precedence over sample records; missing recent records are filled automatically. Default dates refresh on focus and within 30 seconds of an India calendar-day change. Explicit historical selections and an already-open attendance register retain their selected date, preserving unsaved drafts.

## What works

- Responsive application shell, mobile navigation, principal context, fixed academic year, and directory search from the header.
- Dashboard charts and counters derived from the same records as attendance, profiles, and finances. Dashboard date selector and metric navigation.
- Classes, sections, class teachers, and filtered student navigation.
- Student add/edit/delete, guardian contacts and enrollment validation; A–Z directory with class, section and status filters, pagination and CSV export.
- Teacher add/edit/delete, searchable staff profiles, contact details, active/inactive status, class-teacher assignments and CSV export.
- Individual attendance, mark all present, late/half-day/unmarked statuses, local save, historical dates, and unsaved-change protection for navigation, filters and browser unload.
- Absent recipient selection, contact eligibility, personalized preview, explicit confirmation, simulated success/failure, and history.
- Student overview, monthly attendance, fees and installment allocation, examination comparisons, printable report, and clear document-storage empty state.
- Fee filters, searchable payments, append-only demo recording, overpayment and duplicate-reference rejection, sample receipt, and CSV export.
- Daily/monthly tests, pre-boards and term exams; class/section/date/type filters, configurable subjects and maxima, test editing/deletion, marks entry/editing, pending/absent distinctions, top-three ranks, complete-test overall rankings, CSV exports, student histories and printable reports.
- Read-only school/account configuration and confirmed demo reset.

## Student and teacher management

Use **Students → Add student**, or the edit/delete actions in the directory and student profile. Admission numbers and section roll numbers must be unique. Set a student inactive to retain their history while removing them from active registers. Permanent deletion asks for confirmation and lists linked records; it removes enrollment, attendance, results, obligations, payments and notification entries. Existing enrollment class/section is locked once records exist. Creating a student does not invent fee obligations.

Use **Teachers** in the sidebar for A–Z staff profiles, search, status/subject filters, CSV export and add/edit/delete. Staff IDs are unique. Assigning a section replaces its current class teacher, with an explicit notice before saving. Making a teacher inactive or deleting them releases their section assignments while preserving students and classes. This manages staff records and class-teacher responsibilities; timetable scheduling, payroll and staff login permissions are outside this implementation.

Tests have edit/delete actions in both history and the selected test view. Maximum-mark edits recalculate saved result percentages; a maximum cannot fall below an existing score. Class, section and subject count are locked once results exist. Deleting a test confirms removal of all its results, including other classes for a shared test. Unsaved forms have discard protection.

## Class results workflow

Open **Academics**, select a class (and optionally a section), and choose **Add test**. Daily tests, monthly tests, pre-boards and term exams can each have one or more subjects with independent maximum marks. A one-subject test can be out of 20 or 30; a four-subject pre-board with 50 marks each totals 200. The sample includes all three maxima.

Enter marks in the class register and save. Zero is a valid score; absent is explicitly recorded as zero; a completely blank student row remains pending. Complete all subjects for a student before saving that row. Saved tests and marks survive reloads. Unsaved edits prompt before dismissal or navigation. Marks entry respects the selected class/section.

The test history is newest first and can be filtered by type and month. A test's leaderboard is provisional while marks remain pending. Overall rankings use only completed tests shared by everyone in the selected class/section, so students are compared over the same papers. Section-specific tests join the overall calculation when that section is selected. Total percentage = total earned marks / total possible marks × 100, rather than the average of individual percentages. For example, 18/20 + 24/30 = 42/50 = 84%. Equal percentages share a competition rank (1, 1, 3); the top three ranks can include more than three students when tied. The main summary and leader cards are independent of the student search field.

## Test absence tracking

Each test’s history row shows **took test / total students**, with separate absent and pending counts. A completed register means every student has either marks or an explicit absence; it does not mean every student took the test. Zero marks count as participation. Test averages, performance bars and per-test rankings exclude absent and pending students. Existing overall cumulative totals retain absence as zero against that test’s maximum.

Open a test or its absent count to see the **Absent student tracker**, ordered A–Z with class/section, guardian and CSV export. Use **Enter / edit marks** to mark or correct an absence. **Notify parent** previews a Hindi WhatsApp notice identifying that student, test and test date. It opens WhatsApp for the user to send; no automatic dispatch or delivery status is claimed. Test absences use the academic result record and are separate from daily attendance.

## Parent report sharing

In a student’s **Academics** tab, use **Share on WhatsApp** beside Report preview (also available from the report preview). Review a Hindi text report for the selected test or all recorded tests, then enter the parent’s mobile number or leave it blank to choose a contact in WhatsApp. The report includes subject marks, actual maximums, totals and grades; absent results are identified and pending results are excluded. **Copy message** provides a fallback.

The feature uses the documented [WhatsApp click-to-chat URL](https://faq.whatsapp.com/5913398998672934), opening a prepared message in WhatsApp for the user to send. It does not send automatically, attach a PDF, expose a localhost report link, or claim delivery. Existing sample contact references are never treated as phone numbers. An entered number is used only in the current share dialog and is not saved to the student record.

## Architecture

- **React 19 + Vite + strict TypeScript + React Router**, with lazy feature routes.
- **Tailwind CSS 4** plus shared CSS design tokens and centralized reusable primitives. Radix Dialog supplies focus trapping, Escape handling, modal accessibility and focus restoration. Lucide icons and Recharts supply consistent icons and data-driven charts.
- `src/types/domain.ts`: school, academic year, class, section, teacher, student, enrollment, attendance, fee, payment, examination and notification contracts.
- `src/mocks/seed.ts`: deterministic fictional dataset. Student identity is separate from annual enrollment.
- `src/lib/selectors.ts`: centralized attendance, fees, installment allocation, grades and recipient eligibility.
- `src/lib/operations.ts`: validated attendance and finance mutations, independent of UI/persistence.
- `src/lib/academics.ts`: test creation, marks validation, class/section scope and weighted rankings.
- `src/lib/repository.ts`: repository boundary and versioned browser persistence. `src/app/useSchool.ts` subscribes React to the shared snapshot using `useSyncExternalStore`.
- `src/features/*`: feature screens and reusable profile panels. `src/components/*`: layout, shared filters, UI primitives.
- `src/styles/global.css`: shared visual system, responsive layouts, reduced-motion rules, and printable reports.
- `src/lib/domain.test.ts` and `tests/demo.e2e.ts`: domain and browser acceptance tests.

Currency is stored as **integer paise**. Outstanding = obligations + adjustments − payment transactions. Installments allocate payments in due-date order. Fees include the inactive student's retained obligations, while attendance includes only active enrollments; the different scopes are intentional.

Attendance rate = `(present + late + half day) / marked × 100`. Half day counts as an attending day for this prototype, not as 0.5. Unmarked records are excluded from both absence counts and the rate denominator. The UI explicitly labels these semantics. Monthly views display recorded days only; a production calendar is needed to distinguish holidays from missing records.

See [backend architecture and production plan](docs/architecture.md) for inspected backend findings, API contracts, tenant isolation, indexes, roles and phased integration.

## Demo persistence and limitations

Students, enrollments, teachers, section assignments, fee obligations, attendance, payments, tests, marks, notifications and activity persist under `schoolwell-demo-v1` in this origin's localStorage. Older saved states receive initial roster fields only when those fields are missing; deliberately empty directories and deleted records remain deleted. Invalid cache shapes fall back to fresh data. Storage write failures display an error and do not commit the change to the shared in-memory snapshot.

This is a single-browser presentation store, not a database: clearing browser storage or changing the origin/port loses access to those changes; simultaneous tabs do not coordinate writes. Do not use real student, parent or payment data. The reset action affects only this demo key. Demo mode has no server authentication, tenant isolation, audit integrity, messaging delivery, real payment processing, file storage, or compliance certification. School switching, editing settings, subscriptions and enrollment promotion are outside the prototype scope.

The current backend is at `/home/devendra/scholl backend/type-ORM-backend-Node` and uses Mongoose/Typegoose. It is required only for live mode. Earlier backend assessments in the prototype documentation are historical; use the [live management guide](docs/live-management.md) and [Super Admin guide](docs/super-admin.md) for the current implemented workflows. The [Phase 3 integration guide](docs/phase3-integration.md) documents the original profile integration.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

Browser tests launch an isolated local Vite server on port 5175 automatically and default to Playwright Chromium. Install it once with `npx playwright install chromium`, or use `PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome npm run test:e2e` to use installed Chrome. On a minimal Linux system, browser OS dependencies may need installation. Tests use isolated contexts; they do not change an existing user's browser demo data.

Tests cover relationship consistency, inactive students, attendance denominators/upserts, section validation, payments and allocation, notification eligibility/outcomes, grading, the full demo journey, unsaved changes, filters, reset, responsive layouts and route rendering. See [verification record](docs/verification.md) for commands actually run and observed results.

## Presentation update — 11 October 2026

The portal uses regular school-management wording without demo, fictional, or simulation badges. The sidebar and header use a forest-teal and warm-gold school theme. Parent attendance messages and dates are in Hindi, with student/school names preserved. Existing saved balances and attendance are retained when old display labels are refreshed.

This is a presentation change, not a backend integration. Notification status “Ready” means a prepared record, not a delivered WhatsApp message. Local storage, simulated notification outcomes, and payment recording still work as described above. Internal storage keys and model names remain compatible with earlier saved state.
