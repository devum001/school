# Schoolwell architecture and production path

## Repository inspection

The workspace initially contained only `type-ORM-backend-Node/` and protected workspace metadata. There was no frontend application to preserve. The backend copy had a clean working tree. Its original README is a short generic TypeORM startup note; the frontend does not change it.

Inspected backend characteristics:

- Node `.nvmrc`: 22.13.0; TypeScript declared `^5.8.2`; CommonJS, decorator metadata, path aliases. Although `strict` is enabled, `noImplicitAny` and `strictNullChecks` are disabled there. The new frontend independently uses strict checking without those exceptions.
- Express 4.21, `routing-controllers`, `typedi`, `class-validator`, and microframework loaders. Controllers delegate to services and repositories; Mongo repositories are already used.
- Models/services/controllers currently cover users, groups, wallets, transactions and split requests. They are not school domain modules and were preserved.
- TypeORM **0.3.21** is pinned. MongoDB driver is declared `^6.17.0`. Both `ormconfig.ts` and `ormconfig.default.ts` construct MongoDB DataSources. Consolidating these is a later backend change, not a prerequisite for the frontend.
- The checked-in package lock declares TypeORM 0.3.21's MongoDB peer as **`^5.8.0`**, not 6.x. The current combination is outside that declared range; successful existing runtime behavior is not evidence that every needed operation is supported. Do not use `--legacy-peer-deps` as a compatibility fix. Evaluate a minimal TypeORM update whose published driver peer supports the chosen MongoDB version, then run integration tests against the actual server. Do not silently downgrade the driver, replace TypeORM, or introduce Mongoose.
- Existing authentication verifies JWTs, loads a user, and attaches the user to the request. It does not establish school memberships or tenant context. The decoded ID type is declared numeric but consumed as an ObjectId; it also returns the caught error object in its auth failure response. These require review before serving real records.
- Existing centralized error middleware and response classes provide conventions to retain, but controllers returning a body with an error status do not necessarily set the HTTP response status. New endpoints must set both correctly.
- Existing Jest/ts-jest tests cover error middleware and enum helpers. Existing lint/format tooling was inspected. No backend database or environment was configured; no backend tests or migrations were executed.

TypeORM documents [basic MongoDB support](https://typeorm.io/docs/drivers/mongodb/) and Mongo-specific repositories; relational query/transaction APIs cannot be assumed. The current online docs refer to newer driver versions, so use the **pinned package's metadata/source** for version compatibility rather than applying today's documentation blindly.

## Frontend boundary

The feature pages consume a shared typed snapshot via `useSchool`. All mutations pass through `SchoolRepository`. Pure operations validate inputs and return new state; the browser repository persists the mutable subset before notifying subscribers. There is no HTTP call or real dispatch transport in the prototype.

A future HTTP implementation must introduce asynchronous query state, server errors and pagination. It should expose scoped operations rather than download an entire school's historical dataset as `getSnapshot`. Keep the pure display calculations and shared domain DTOs where useful, but replace the demo snapshot subscription with query caches per school/year/date/class/page. The current repository is a useful seam, not a claim that a production API adapter is implemented.

Identifiers are stable fictional strings. Production Mongo ObjectIds should serialize as strings in API DTOs. Currency uses integer paise; date-only school calendar values use `YYYY-MM-DD` in the school's timezone. Persist timestamps in UTC and distinguish them from attendance dates.

## Academic results implemented in the browser

`Examination` includes test type, class/optional section scope, date and subject maximums. `ExamResult` records the subject marks and an explicit absent flag. A missing result is pending; an absent result contains zero marks with the test's full maximum. `src/lib/academics.ts` validates creation and score updates before the repository commits them to localStorage. Older stored states without examination/result fields retain their other records and receive the initial academic dataset.

Overall rankings use completed tests common to the selected class/section and calculate total earned divided by total maximum. Per-test rankings remain provisional until all eligible students are recorded. Ties receive the same competition rank. The production adapter must preserve these semantics on the server, freeze the eligible exam roster, and audit score changes. The current browser prototype derives eligibility from the active roster.

Proposed additional endpoints are `POST /examinations` for class/section/type/date/subject maximums, `PUT /examinations/:id/results` for validated score changes with expected revision, and `GET /academic-rankings` for school/year/class/section/type/date-scoped summaries. These are design contracts, not implemented backend routes.

## Backend extension strategy

Retain the existing controller/service/repository conventions under `src/api`. Add school entities to `models`, request validation to `controllers/request`, controllers to `controllers`, business operations to `services`, and Mongo data access to `repositories`; extract feature modules only when their size justifies it. Do not create empty parallel scaffolds. Keep database setup in the existing loader/config path and central errors in middleware.

Introduce school, academic year, membership, class, section, student, enrollment, attendance-register, fee-obligation, payment, examination, result and notification-job collections. No ORM relation decorators or relational cascade assumptions: use explicit references, validate scope/existence in services, and batch-load needed metadata.

### School context and authorization

1. Authenticate using a secure session/token flow and load an active user.
2. Resolve the requested school through an active, authorized membership. A browser school ID is only a selector, never proof of access.
3. Construct a server-owned `SchoolContext { schoolId, userId, membershipId, permissions }` in middleware.
4. Require that context in every school repository method. Every query/update/delete includes school scope, including lookup-by-ID, aggregate pipelines, exports and background jobs.
5. Check permission and ownership relationships before mutation: academic year, student, enrollment, class and section must belong to the same school; section must belong to class; teacher must be assigned where required.
6. Return 404 for inaccessible foreign-school objects and log the attempt internally without revealing the object.

| Role                    | Intended scope                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Platform administrator  | Platform provisioning and support; explicit audited elevation for school data                |
| School owner/principal  | School operations, aggregate reports, staff permissions                                      |
| School administrator    | Enrollment, classes, school configuration and allowed operational data                       |
| Teacher                 | Assigned classes, attendance and approved academic results; no unrestricted financial access |
| Accounts staff          | Obligations, authorized payment recording, receipts and reconciliation                       |
| Parent/guardian (later) | Only explicitly linked children's released records                                           |

A frontend menu or role switch is not authorization. The prototype has one clearly labeled principal identity and no role-switch controls implying security.

### API contracts to implement next

Base path `/api/v1`. Tenant context comes from membership middleware, even when a route contains a school selector. Use request DTO validators and a consistent `{ data, meta? }` response, with safe `{ error: { code, message, requestId, fields? } }` failures. HTTP status must match the operation outcome.

| Endpoint                                                                          | Purpose and constraints                                                                                                                                                 |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /students?academicYearId=&classId=&sectionId=&status=&query=&cursor=&limit=` | Authorized school directory, capped server-side pagination; name/admission indexes                                                                                      |
| `GET /students/:studentId`                                                        | School-scoped identity, current enrollment and allowed guardian fields                                                                                                  |
| `GET /classes?academicYearId=`                                                    | Classes, sections and counts, without loading every student                                                                                                             |
| `GET /attendance?date=&sectionId=&academicYearId=`                                | Section register with explicit unmarked entries and revision                                                                                                            |
| `PUT /attendance/registers/:sectionId/:date`                                      | Validated `{ academicYearId, expectedRevision, records: [{ enrollmentId, status }] }`; reject duplicates, invalid dates and foreign enrollments; 409 for stale revision |
| `GET /dashboard?date=&academicYearId=`                                            | Server-calculated consistent attendance/finance summaries                                                                                                               |
| `GET /enrollments/:id/fees`                                                       | Obligations, adjustments, payments and balance with currency unit                                                                                                       |
| `POST /enrollments/:id/payments`                                                  | `{ amountPaise, method, effectiveDate, reference }` plus idempotency key; authorized, append-only and audited                                                           |
| `GET /examinations?academicYearId=&classId=`                                      | Published exam metadata and allowed summary scope                                                                                                                       |
| `GET /enrollments/:id/results?examId=`                                            | Validated result DTO with maximum marks and grading rule                                                                                                                |
| `POST /notifications/preview`                                                     | Server recomputes absence/contact eligibility from selected enrollments; no dispatch                                                                                    |
| `POST /notifications/jobs`                                                        | Explicitly authorized enqueue only; response means queued, not delivered                                                                                                |
| `GET /notifications/jobs/:id`                                                     | Provider outcomes and audit trail within school scope                                                                                                                   |

The prototype intentionally has no real notification or payment transport. Production dispatch requires approved provider integration, recipient consent/policies appropriate to deployment, template management, server-side eligibility rechecking, idempotency, retries with backoff, and webhook verification. Queued, accepted, delivered and failed are distinct states.

### Indexes and concurrency

Proposed compound unique keys (include school scope):

- Students: `(schoolId, admissionNumber)`.
- Classes: `(schoolId, academicYearId, name)`; sections: `(schoolId, academicYearId, classId, name)`.
- Memberships: `(schoolId, userId)`.
- Enrollments: `(schoolId, academicYearId, studentId)` for one enrollment per year in the initial policy; retain older year documents during promotion. Validate rules for within-year transfers explicitly.
- Attendance register: `(schoolId, academicYearId, sectionId, date)`; one embedded record per enrollment, validated in service. A document per register allows atomic revision-checked replacement with MongoDB single-document atomicity. Alternatively use per-student records keyed `(schoolId, enrollmentId, date)`, but decide atomic batch semantics first.
- Obligations: `(schoolId, enrollmentId, feeItemId, installmentId)`.
- Payments: `(schoolId, idempotencyKey)`; store reference and immutable audit metadata. Index `(schoolId, enrollmentId, effectiveDate)` for statement queries.
- Results: `(schoolId, enrollmentId, examinationId)`; validate subject uniqueness and marks ≤ maximum.
- Query indexes: attendance `(schoolId, date, sectionId)`; enrollments `(schoolId, academicYearId, classId, sectionId)`; notification jobs `(schoolId, createdAt)`.

MongoDB multi-document transactions must be designed and proven using an appropriate native session path and replica-set topology if needed; TypeORM relational `manager.transaction()` is not the solution. For money operations, a pre-read of balance followed by an insert is insufficient under concurrency. Use a reviewed atomic ledger/account strategy or supported native transaction boundary; idempotency and authoritative balance checks are required. Reversals should be new compensating transactions, never silent history replacement. Add append-only audit records with actor, school, action, entity, request ID and timestamp.

Manage indexes explicitly and verify them in integration tests. Do not assume decorator metadata alone has created required unique indexes in production. Review `synchronize` before deployment, backups/restoration, migration and index-change procedures.

## Production implementation order

1. Reconcile TypeORM/MongoDB compatibility and duplicate DataSource construction in an isolated backend change. Build and run existing tests, then MongoDB integration smoke tests.
2. Add membership-based authentication and permission middleware with cross-tenant denial tests. Do not connect real child data first.
3. Implement school/year/class/section/student/enrollment reads and server-side pagination. Replace directory and profile mock queries incrementally.
4. Implement attendance register validation, atomic revision checks, missing-day/calendar semantics and shared summary queries. Test conflicts, inactive enrollment, promotion history and cross-school writes.
5. Implement the financial ledger with permissions, idempotency, exact minor-unit arithmetic and concurrency tests; preserve reversals/auditability.
6. Add academic results and grading configuration; then authorized notification jobs with verified provider outcomes.
7. Add secure document storage and signed scoped downloads, operational monitoring, rate limiting, safe errors, secure session handling, backup restoration drills and jurisdiction-specific privacy/retention review.
8. Add commercial onboarding/subscriptions only after the core security and operational model is proven.

Passing prototype tests is not production readiness or a compliance claim.

## Student, staff and examination management

`src/lib/management.ts` validates student identity, guardian contacts, unique admission numbers and section roll numbers, staff IDs, contact details and section ownership. Student deletion removes linked enrollment records; teacher deletion releases section assignments. Inactive records remain available for review. Forms use the existing unsaved-change guard and shared confirmation dialog. The repository persists these collections alongside academic and attendance records; restoration filters seed attendance by retained enrollment IDs so deleted students do not return on reload or day rollover.

`updateTest` validates metadata and propagates subject names/maximums into existing results. It rejects maxima below saved scores and locks scope/subject count once results exist. `deleteTest` removes metadata and linked results. Student academic panels handle pending marks and an empty examination list.

Future server contracts include student and teacher create/update/archive operations, section assignment updates, and examination update/delete operations. Server implementation must authorize these per school, validate expected revisions, enforce unique indexes and audit changes. Browser permanent deletion is a presentation capability; production retention rules, financial reversals and archival policies require explicit design before enabling equivalent destructive operations against durable data. No backend route or database connection was added here.
