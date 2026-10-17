# Frontend AI Instructions --- School Management SaaS

> **Scope for the current phase:** Frontend only. Build a polished,
> complete, interactive frontend using mock data. Do not implement or
> depend on backend APIs yet. Structure the code so a real backend can
> be connected later by changing the data/service layer rather than
> rewriting screens.

## 1. Your Role and Working Principles

Act as a senior frontend engineer, UI/UX designer, and frontend
architect.

-   Build the actual application; do not stop after proposing a plan.
-   Prioritize maintainability, consistency, accessibility, responsive
    behavior, and a professional product experience.
-   Prefer simple, readable solutions over clever abstractions.
-   Reuse components and logic when there is a genuine shared use case.
-   Keep feature-specific logic inside its feature; keep truly reusable
    UI and utilities in shared locations.
-   Do not create huge components, duplicated logic, unexplained
    constants, or unnecessary abstractions.
-   Do not leave dead buttons, fake links, empty screens, or unfinished
    navigation.
-   Do not silently remove existing functionality or overwrite unrelated
    work.
-   Inspect the existing repository, package scripts, installed
    libraries, current UI, and uncommitted changes before editing.
    Preserve existing work and follow the current project conventions
    where they are sound.
-   If a technical decision is unclear, inspect the code first and
    choose the least disruptive maintainable option.

## 2. Current Scope: Frontend Only

For this phase:

-   Implement all agreed screens and frontend workflows.
-   Use realistic, consistent mock data.
-   Persist demo changes locally where useful (for example,
    `localStorage`) so refreshes do not immediately erase the demo
    state.
-   Simulate API latency and loading states where it improves realism,
    but keep the app usable.
-   Do not build backend endpoints, database schemas, authentication
    servers, or integrations.
-   Do not make real WhatsApp, email, SMS, payment gateway, or other
    external requests.
-   Clearly label simulated actions in the UI where users could
    otherwise mistake them for real delivery or payment.
-   Do not put secrets, API keys, or production credentials in frontend
    code.
-   Do not couple screens directly to mock arrays or browser storage.
    All data access must go through a service/repository layer so mock
    implementations can later be replaced with HTTP implementations.

The result should be a convincing demo now and a clean foundation for
backend integration later---not a pretend production backend.

## 3. Inspect Before Implementing

Before changing code:

1.  Inspect the repository structure, `package.json`, scripts,
    TypeScript settings, routing, styling setup, existing components,
    and tests.
2.  Identify which libraries are already installed and use them where
    appropriate.
3.  Review the existing code and preserve useful work.
4.  Write a short implementation checklist, then proceed with
    implementation.
5.  Avoid replacing the application structure or dependencies wholesale
    without a clear reason.

Do not claim that a command, test, or build passed unless you actually
ran it.

## 4. Architecture and Folder Structure

Follow a **feature-first structure**. Adapt this example to the
repository rather than forcing a full restructure if an appropriate
structure already exists.

``` text
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   ├── providers/
│   └── config/
├── components/
│   ├── ui/                 # Low-level reusable UI primitives
│   ├── layout/             # App shell, sidebar, header, page container
│   └── shared/             # Shared product components
├── features/
│   ├── dashboard/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   ├── students/
│   ├── teachers/
│   ├── classes/
│   ├── attendance/
│   ├── fees/
│   ├── academics/
│   ├── examinations/
│   ├── notifications/
│   └── settings/
├── services/
│   ├── api/                # Future HTTP client and shared API configuration
│   └── storage/            # Local demo persistence adapters
├── mocks/
│   ├── data/
│   ├── factories/
│   └── handlers/           # Optional mock handlers if the project uses them
├── hooks/                  # Only genuinely app-wide hooks
├── lib/                    # Library setup and small infrastructure utilities
├── types/                  # Only genuinely shared domain types
├── constants/
├── styles/
└── main.tsx
```

### Folder rules

-   Do not create folders that contain no meaningful code.
-   A small feature may use fewer subfolders; keep the structure
    proportional to complexity.
-   Put components used only by one feature inside that feature.
-   Put cross-feature reusable components in `components/shared`.
-   Put primitive controls such as buttons, inputs, dialogs, badges,
    tables, and dropdowns in `components/ui`.
-   Keep page composition in page components and move repeated or
    complex sections into feature components.
-   Avoid circular imports and overly deep relative import paths;
    configure aliases if the existing build setup supports them.
-   Keep filenames, exports, and naming conventions consistent.

## 5. Reusable Components and UI Consistency

Create and reuse shared components for repeated patterns, where
appropriate:

-   `AppShell`, `Sidebar`, `Topbar`, `PageContainer`, `PageHeader`,
    `Breadcrumbs`
-   `StatCard`, `ChartCard`, `SectionHeader`
-   `DataTable`, `TableToolbar`, `SearchInput`, `FilterBar`,
    `Pagination`
-   `StatusBadge`, `Avatar`, `EmptyState`, `ErrorState`, `LoadingState`
-   `ConfirmDialog`, `FormDialog`, `Drawer`, `Toast`/notification
    feedback
-   `FormField`, `SelectField`, `DatePickerField`, `TextAreaField`
-   `PageLoader`, `Skeleton`, `NoResults`
-   Consistent buttons, inputs, cards, tabs, menus, and tooltips

Rules:

-   Avoid duplicating markup and business rules across screens.
-   Do not create one giant component with dozens of unrelated props.
-   Keep reusable components configurable, typed, and accessible.
-   Do not abstract a component just because two small snippets look
    similar; abstract when it improves consistency or maintainability.
-   Ensure interactive elements have labels, keyboard support, visible
    focus states, and appropriate accessible semantics.
-   Use consistent spacing, typography, borders, radii, icons, colors,
    and status meanings throughout the product.
-   Prefer the project's existing UI library if it is already configured
    and suitable. Do not install another UI system without checking the
    current stack first.

## 6. Styling and Product Quality

Aim for a polished, modern, professional school-management SaaS suitable
for demonstrating to school owners.

-   Use a consistent design system with design tokens/CSS variables for
    colors, spacing, radius, shadows, and typography.
-   Keep the interface clean and information-dense without being
    cluttered.
-   Use clear visual hierarchy, readable tables, useful filters,
    restrained colors, and meaningful data visualizations.
-   Make the main app responsive for desktop, tablet, and mobile.
    Complex tables should have an intentional small-screen treatment.
-   Use one icon library consistently; avoid emoji as UI icons.
-   Use realistic content and dates, not repeated placeholder text.
-   Charts must use coherent mock data and include labels/tooltips where
    helpful.
-   Every page must support loading, empty, error, and success states
    where relevant.
-   Avoid gratuitous animations; respect reduced-motion preferences.
-   Use confirmation for destructive actions and provide useful
    success/error feedback.
-   Do not use `alert()` for normal product interactions.
-   Do not use random values during rendering to simulate data; mock
    data should be stable and internally consistent.

## 7. API Calls: One Central `apiService.ts` + Feature Hooks

Follow the API pattern used in the provided `ecommerceAPP-main` reference project:

- One central `src/services/apiService.ts` owns the shared Axios client and common HTTP methods.
- Feature-specific hooks live in `src/hooks/` (or in feature-local `hooks/` if the existing project already uses that convention) and call the central `apiService`.
- Screens/components call hooks; they must not call Axios, `fetch`, or browser storage directly.
- Feature hooks must not create their own Axios instances or duplicate base URL, timeout, headers, and shared request configuration.
- Keep this pattern consistent across the whole frontend.

### Recommended request flow

```text
Page / Component
      ↓
Feature Hook (e.g. useStudents, useAttendance)
      ↓
src/services/apiService.ts
      ↓
Mock data adapter (now)  →  Real backend HTTP requests (later)
```

### Central API service

Create or maintain a single `src/services/apiService.ts` as the shared HTTP entry point. If the repository already has a suitable implementation, extend it instead of creating a competing client.

It should centralize:

- Axios instance creation.
- Base URL configuration through environment variables (never hard-code deployment-specific URLs).
- Default headers and request timeout.
- Common `get`, `post`, `put`, `patch`, and `delete` methods with TypeScript generics.
- Shared request/response interceptors only when needed, such as future auth headers or normalized error handling.
- Common error normalization so UI hooks can show understandable messages.

Use the project's installed HTTP client if one already exists. If Axios is the established pattern, follow it. Do not create multiple API clients without a documented reason. Do not use `any` as the default generic type; prefer `unknown` or explicit response types.

A typical structure is:

```text
src/
├── services/
│   └── apiService.ts       # Single shared HTTP client and HTTP methods
├── hooks/
│   ├── useStudents.ts      # Student list/query hook
│   ├── useStudent.ts       # Student detail hook
│   ├── useAttendance.ts    # Attendance query/mutation hook
│   ├── useFees.ts          # Fee query/mutation hook
│   └── ...
└── types/
    └── ...
```

Feature-first hooks are also acceptable if the current repository uses that structure, for example `src/features/students/hooks/useStudents.ts`. Do not duplicate hooks in both locations.

### Feature hook responsibilities

Create small, resource-oriented hooks such as:

- `useStudents`, `useStudent`, `useCreateStudent`, `useUpdateStudent`
- `useTeachers`, `useClasses`, `useAttendance`
- `useFeeSummary`, `useStudentFees`, `useRecordPayment`
- `useExaminations`, `useStudentResults`
- `useNotifications`, `useSchoolSettings`

Each hook should:

- Own its feature's fetching or mutation lifecycle.
- Expose a predictable typed result, such as `{ data, loading, error, refetch }` for queries.
- Expose mutation state and an action function for writes.
- Handle errors deliberately and provide a retry/refetch path where useful.
- Avoid duplicating common request configuration.
- Avoid stale updates when request parameters change.
- Keep business calculations in shared feature utilities/selectors rather than duplicating them across screens.
- Use typed parameters and response models.
- Keep component code focused on rendering and user interactions.

Use the existing project's data-fetching convention if it is already established. If TanStack Query is installed or selected, use it for caching, mutation state, and invalidation while still sending HTTP requests through `apiService`. Do not mix several fetching patterns without a clear reason.

### Frontend-only phase: mock implementation

The current project is frontend-only, so do not make real backend calls or assume endpoints exist.

- Keep the same hook-facing interface the UI will use after integration.
- Back the hooks with a mock service/adapter for now.
- Use deterministic, typed mock data and simulate asynchronous behavior when useful.
- Make demo mutations update a single coherent source of mock state, with optional `localStorage` persistence behind an adapter.
- Do not scatter mock arrays or storage access across components.
- Do not show a fake API call as if a real server responded.
- When backend integration begins, connect the hooks to `apiService` and the confirmed API endpoints, or switch the service implementation/configuration, without rewriting the screens.

If a hook uses the central `apiService` today for real requests, keep that pattern. If mock data is required today, route through a mock adapter with the same contract; do not call a non-existent endpoint just to make the architecture appear backend-ready.

### Example shape

```ts
// src/services/apiService.ts
// Illustrative shape only; adapt to the repository's installed versions.
import axios, { type AxiosRequestConfig } from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

const apiService = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    apiClient.get<T>(url, config),
  post: <T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) =>
    apiClient.post<T>(url, data, config),
  put: <T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) =>
    apiClient.put<T>(url, data, config),
  patch: <T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) =>
    apiClient.patch<T>(url, data, config),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    apiClient.delete<T>(url, config),
};

export default apiService;
```

Do not paste this example blindly if it conflicts with the existing build setup. For example, use the environment-variable syntax supported by the project's bundler, and keep the base URL configurable.

**Non-negotiable:** one shared `apiService.ts` for HTTP transport; feature hooks for resource-specific behavior; components consume hooks; mock data stays behind a mock/service layer until real APIs are available.

## 8. Redux and State Management

Do not use Redux for every state variable. Select state management based
on the scope and lifetime of the state.

Use:

-   **Local component state (`useState`/`useReducer`)** for modal
    visibility, input state, tabs, and small isolated interactions.
-   **URL search parameters** for shareable or reload-persistent page
    state such as search, filters, sorting, pagination, selected class,
    and date where appropriate.
-   **TanStack Query or the project's existing query library** for
    server-style data fetching, caching, mutation status, and
    invalidation.
-   **Redux Toolkit** only for genuinely shared client-side state that
    is needed across distant parts of the app---for example, current
    tenant/school context, user session/UI preferences, or a complex
    cross-feature workflow.
-   **Context** for low-frequency app-wide values such as theme or a
    small session context when Redux is unnecessary.

If Redux Toolkit is used:

-   Use Redux Toolkit APIs (`configureStore`, `createSlice`, typed
    hooks).
-   Keep slices feature-oriented and state serializable.
-   Do not store duplicate copies of query/server data in Redux if the
    query library already manages it.
-   Do not put every form field or modal flag into Redux.
-   Avoid direct mutation outside Redux Toolkit reducers.
-   Keep selectors typed and reusable.

Add Redux only when the real requirements justify it; do not introduce
it solely because it is listed in these instructions.

## 9. Types, Forms, and Validation

-   Use TypeScript throughout; avoid `any`. If `any` is unavoidable,
    isolate it and explain why.
-   Define domain types and form input types explicitly.
-   Keep API DTO types separate from UI view models when their
    structures differ.
-   Use discriminated unions for finite status/state values.
-   Avoid unsafe type assertions and duplicated types.
-   Validate forms with the project's existing validation solution; if
    appropriate, use React Hook Form and Zod.
-   Show field-level validation messages and preserve user input when
    validation fails.
-   Normalize values such as currency, dates, phone numbers, and
    percentages consistently.
-   Use `Intl.NumberFormat` and `Intl.DateTimeFormat` rather than
    scattered formatting logic.
-   Do not calculate totals independently in multiple screens. Put
    shared calculations in tested domain utilities or selectors.

## 10. Screens and Features to Build

Build all screens below as working frontend screens, not just static
mockups. Adapt names and scope to the product requirements already
established in the project.

### A. App shell and navigation

-   Main dashboard layout with responsive sidebar and top navigation.
-   School/tenant selector as a frontend demo control if useful.
-   Breadcrumbs, profile menu, notifications, global search where
    appropriate.
-   Active navigation states, page titles, and consistent page layout.
-   Useful not-found and unauthorized/access-denied placeholder screens
    where relevant.

### B. Authentication and onboarding UI

-   Sign-in screen and forgot-password screen.
-   Demo-only sign-in flow; do not implement real authentication or
    claim security.
-   School setup/onboarding screen for basic school details.
-   Clear demo-mode messaging if authentication is simulated.

### C. Dashboard

-   Student and teacher totals.
-   Today's attendance summary, including present, absent, and not
    marked.
-   Attendance trend and class-wise summaries.
-   Fee collection, outstanding balance, and recent transactions.
-   Absent students list and recent activity.
-   Date/class filters that update the displayed mock data consistently.
-   Clickable summary cards that navigate to the relevant filtered
    screen.

### D. Students

-   Student directory with search, filters, sorting, pagination, and
    useful empty states.
-   Create/edit student forms with validation.
-   Student detail/profile page with overview, attendance, fees,
    academics, guardian details, and documents tabs.
-   Enrollment/class/section information, status, and profile actions.
-   Confirmation for deletion/deactivation and clear success/error
    feedback.

### E. Teachers and staff

-   Teacher/staff directory, search, and filters.
-   Add/edit teacher forms and profile details.
-   Assigned classes/subjects where appropriate.
-   Staff status and basic contact information.

### F. Classes and sections

-   Class/grade and section list.
-   Class details with students, class teacher, and subject assignments.
-   Add/edit class and section flows.
-   Filters and navigation into the relevant student or attendance
    views.

### G. Attendance

-   Select date, class, and section.
-   Show roster with student name, identifier, and current attendance
    status.
-   Mark all present and update individuals to present, absent, late, or
    leave where supported by the UI.
-   Keep **not marked** distinct from **absent**.
-   Save/update attendance with validation and feedback.
-   Update related dashboard summaries and student profiles from the
    same state/data source.
-   Attendance history and useful filters.
-   Provide a summary before saving and confirmation for bulk changes
    where appropriate.

### H. Fees and payments

-   Fee overview with collected, outstanding, overdue, and collection
    summaries.
-   Student fee ledger and payment history.
-   Fee structures/categories and student fee obligations where in
    scope.
-   Record a simulated payment, show a clear demo notice, and update
    balances and transaction history consistently.
-   Support partial payments/installments where relevant.
-   Validate amounts and prevent a payment exceeding the remaining
    balance unless an explicit adjustment flow is implemented.
-   Never claim that money was actually collected or a payment gateway
    was used.

### I. Academics and examinations

-   Examination list and exam details.
-   Subject/marks entry UI with validation.
-   Compute percentages, totals, and grades through shared tested
    utilities.
-   Student academic history and report-card preview.
-   Include realistic examples and empty states.
-   Ensure calculated totals remain consistent across the marks table,
    student profile, and report preview.

### J. Notifications

-   Notification center and notification history.
-   Compose a notice/message and select recipients or groups.
-   Simulate bulk dispatch and display a clear **Demo only --- no
    message was sent** notice.
-   Track simulated status in mock notification logs; do not present
    simulated delivery as real WhatsApp/SMS delivery.
-   Validate message content and recipient selection.

### K. Settings

-   School profile and academic-year settings.
-   Basic attendance, fee, and notification preferences.
-   Profile/preferences UI and role/permission presentation where
    appropriate.
-   Since authorization is not implemented in this frontend-only phase,
    role-based screens are illustrative and must not be presented as
    secure access control.

### L. Global states and reusable flows

-   Loading skeletons, error states with retry, empty states,
    no-search-results states.
-   Confirmation dialogs, toasts, form validation, unsaved-change
    handling where needed.
-   Consistent filters, tables, pagination, date pickers, and status
    badges.
-   Responsive behavior and keyboard-accessible interactions.

Do not build extra screens just to increase the screen count. Each
screen should have a clear user purpose and be connected to the
product's navigation and workflows.

## 11. Data Consistency and Mock Data

Create centralized, typed mock data with stable IDs and realistic
relationships.

-   Use the same student, teacher, class, attendance, fee, examination,
    and notification records across all features.
-   Use service methods to read and update demo data.
-   Avoid duplicating the same student or transaction as separate
    unrelated objects in multiple mock files.
-   Derive dashboard summaries from the underlying mock records where
    practical.
-   Keep derived values (balances, totals, percentages, grades,
    attendance rates) in shared calculations rather than hard-coded
    independently on each screen.
-   Ensure updates in one workflow appear everywhere they should---for
    example, marking a student absent updates attendance history,
    student profile, and dashboard summaries.
-   Provide a reset-demo-data option if persistence makes it difficult
    to return to the original demo state.
-   Keep persistence behind a storage adapter so it can be removed or
    replaced cleanly.
-   Treat mock IDs as frontend identifiers only; do not assume they
    match future backend IDs.

## 12. Multi-School / Tenant Readiness

The eventual product may serve multiple schools. Keep this future
requirement in mind without implementing backend security now.

-   Model school-specific data with a clear school/tenant context in the
    frontend domain where appropriate.
-   Keep school selection and tenant-specific data access behind a
    dedicated context/service rather than scattering a selected school
    ID across components.
-   Ensure changing the demo school changes the appropriate mock data
    consistently if multi-school demo behavior is included.
-   Avoid global mock data that accidentally mixes records from
    different schools.
-   Never treat frontend tenant filtering as a security boundary. The
    real backend must enforce tenant isolation on every protected
    request.
-   Avoid prematurely building complex multi-tenant infrastructure in
    the frontend.

## 13. Performance and Code Quality

-   Keep components reasonably small and focused.
-   Use stable keys for lists.
-   Avoid unnecessary re-renders, effects, and duplicated derived state.
-   Do not use `useEffect` for calculations that can be performed during
    render or with selectors.
-   Use memoization only when it provides a clear benefit or is required
    for stable references.
-   Lazy-load major routes if the current build setup supports it and
    the app size warrants it.
-   Use pagination for large data sets; do not render thousands of rows
    unnecessarily.
-   Keep charts and heavy UI dependencies scoped to screens that need
    them.
-   Avoid expensive work inside render loops.
-   Handle asynchronous errors and component unmounts correctly.
-   Keep dependencies minimal and compatible with the existing project.

## 14. Testing and Verification

Write or update tests for important logic and workflows where the
project has a test setup.

At minimum, verify:

-   The application starts using the documented command.
-   All routes render without runtime errors.
-   Navigation and active states work.
-   Search, filtering, sorting, and pagination behave correctly.
-   Forms validate and submit successfully in demo mode.
-   Attendance changes persist and update dependent views.
-   Fee payments update balances and transaction history correctly.
-   Academic totals and grades are calculated consistently.
-   Notification simulation clearly states that no real message was
    sent.
-   Loading, empty, error, and success states render correctly.
-   The production build and lint/type checks pass where configured.
-   The layout is usable at common desktop, tablet, and mobile widths.

Do not hide failures or claim unrun checks passed. If a check cannot be
run, state why and what remains to be verified.

## 15. Backend Integration Readiness

When backend integration begins, the expected transition should be:

1.  Confirm actual backend routes, request schemas, response schemas,
    authentication mechanism, and error formats with the backend
    implementation.
2.  Define or update typed API DTOs and frontend domain mapping.
3.  Implement HTTP repository/service methods using the shared HTTP
    client.
4.  Replace the mock repository through configuration or dependency
    injection.
5.  Connect query hooks to real services and implement appropriate cache
    invalidation.
6.  Handle authentication expiry, validation errors, authorization
    errors, loading, retries, and empty results.
7.  Test real API workflows and tenant isolation assumptions with the
    backend team.
8.  Remove or disable demo-only behavior in production builds.

Do not assume endpoint names, response formats, or authorization rules
before checking the actual backend. Keep UI components independent of
these details.

## 16. Definition of Done

A feature is not complete merely because a page exists. It is complete
when:

-   The route is connected to navigation.
-   The layout and visual styling match the product.
-   Data is typed and accessed through hooks/services.
-   Primary actions work in demo mode.
-   Validation and success/error feedback are present.
-   Related screens remain consistent after mutations.
-   Loading, empty, and failure states are handled.
-   The screen is responsive and accessible.
-   No important controls are dead or misleading.
-   Relevant checks have been run and their results reported.
-   Any limitations or assumptions are documented.

## 17. Required Final Report After Each Major Implementation

When a major implementation pass is complete, report:

1.  Screens/features implemented.
2.  Important reusable components and hooks added.
3.  Folder or architecture decisions.
4.  How mock data and local persistence work.
5.  Commands actually run and their results.
6.  Known issues, incomplete features, or assumptions.
7.  Recommended next implementation steps.
8.  How the current design can be connected to real backend APIs later.

Be accurate about what is implemented versus simulated.

------------------------------------------------------------------------

## Final Instruction

**Work frontend-first. Build all agreed screens and connect them with
coherent, interactive mock data. Use shared components, feature-first
folders, typed hooks, and a service/repository abstraction. Use Redux
Toolkit only for state that genuinely needs global client-side
ownership; use a query library for server-style data and local state for
local interactions. Do not implement backend functionality now. Keep the
frontend easy to bind to the real backend later, and preserve all
existing project work.**
