# Dashboard, attendance and simple school administration

## 1. Features

- Finance's duplicated income/expense panel is removed; summary cards and salary/transaction workflows remain connected.
- Main Overview removes the repeated school/date context strip, fees card, Fees in focus and Around the school panels. Student attending today and Staff attending today are adjacent; the staff card opens the staff attendance register for the selected date.
- Leave follow-up lists students and teaching staff with more than three consecutive full-day absences. School working days and staff weekly offs are respected. A present, late, half-day or unmarked working day breaks the streak. Counts come from saved attendance; no leave records are invented.
- Notify parents and View all absent students open Notifications with the correct date and Student Absent filter, scroll to the pending queue and focus it. No additional review-navigation step is required.
- Attendance has Student Attendance and Staff Attendance tabs. Both use the register filter/summary/table/save layout. Student roll numbers and staff row numbers use ordinary 1, 2, 3 numbering. Staff & HR's embedded attendance also uses the same register body. Unsaved changes remain protected.
- Data & Security contains Backup & Restore, Data Export, Login & Session Security and Activity Log. The old destructive demo reset control is removed from the school-admin screen.
- Data Export downloads Excel or CSV for Students, Staff, Attendance, Fees & Payments, Salary, Results / Academics and Notifications History. Financial PDF shortcuts open receipt history or salary slips in Finance. Fee exports include installment obligations and payments; money is exported in INR.
- Preferences contains Regional & Display and Default Context. It stores language, date/time style, current academic year, week start and default landing page. Currency and number format are fixed to INR/Indian style. The single-school demo does not invent branch or academic-year options.

## 2. Shared code

AttendanceTabs provides register navigation. attendanceFollowup calculates absence streaks. adminSettings validates preferences/security and creates audit records. schoolExports maps this school's records to spreadsheet rows. The existing workbook writer supports named sheets while preserving the student-import API. displayPreferences is a derived formatter configuration, updated by the repository before subscribers render.

## 3. Architecture

The feature folders, UI primitives, CSS tokens, useSchool/useSyncExternalStore subscription and repository mutation boundary are preserved. No new dependencies, API endpoints or authentication backend. New preferences, security metadata and audit history are optional fields in the existing saved-state schema, with backward-compatible restore.

## 4. Persistence and behavior

Actual local saves create audit entries for student/staff records, student/staff attendance, fee and salary payments, academics, notification send attempts and school settings. Entries include school, configured administrator name, action, module, detail and timestamp. No-op saves do not add entries. Activity filters cover User, Action, Date and Module; export respects the filters. Up to 2,000 local audit entries are retained.

Backup Now updates preview metadata; Restore previews the flow and does not overwrite records. Password forms validate matching values and never persist passwords. Device sessions, logout, inactivity timeout and sensitive-action requirements are clearly labeled previews, pending real staff-account services. These controls do not enforce real authentication.

Date style is used by shared text-date formatting, time style by school timings, backup time and audit time. Hindi affects navigation and formatted dates; full feature-screen translations remain future frontend work. Week start reorders the working-day selector. Native browser date pickers follow browser conventions. The default landing page applies on a fresh visit to the root URL; clicking Overview still opens the dashboard.

## 5. Validation

The implementation report records actual check results. Unit tests cover working-day absence thresholds, unmarked/half-day behavior, schema validation, display formats, audit metadata, export column alignment and tenant scoping. Browser checks cover direct pending-queue navigation, both registers, attendance-derived dashboard counts, saved activity, real Excel/CSV downloads, safe previews, preference reload, landing behavior, Hindi navigation, existing payments/documents and desktop/mobile accessibility.

## 6. Limits

Frontend/local persistence only. Backup scheduling/restoration and login/session enforcement require real services. The local audit history is a demo record, not a server audit trail. It attributes changes to the configured school administrator because real authentication is not present. Language coverage is limited as described above. Full-day consecutive absence is the dashboard's leave-follow-up definition; approved leave categories and half-day salary deductions remain in their existing workflows.

## 7. Next steps

Review the dashboard and new settings with existing records. Replace the clearly marked backup and account previews with real services when backend contracts are available; complete remaining Hindi screen translations if needed.

## 8. Backend mapping

Replace repository persistence with typed settings, attendance, transaction, export, backup and staff-account services. Server-side authentication supplies the real actor/session identities and enforces inactivity/sensitive actions. Keep attendance/register selectors and export shapes stable. Real backups and audit retention belong on the server; avoid adding technical administration controls to these screens.
