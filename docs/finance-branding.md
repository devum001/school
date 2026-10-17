# Finance, school branding and staff layout

## 1. Screens and workflows

- Teacher detail now has one identity area in Overview; the repeated profile header is removed. Overview and Documents remain.
- Staff Attendance aligns Mark all present with the date/department controls at the right. Date changes commit immediately before attendance actions, avoiding discarded marks during a route transition.
- Leave includes a department filter and a right-aligned Open Staff Attendance action. The selected department and staff scope carry across.
- Fee management is renamed Finance. Overview, Student Fees, Salary Expenses and Transactions share existing fee and salary records. The original /fees route remains compatible.
- Templates provides six distinct PNG designs for each document type, separate accent colors per design, an enlarged preview and 50–150% zoom.
- School logo, header, footer, official signature and stamp can be imported, previewed, saved and removed. Sample PNG artwork is supplied; the sample signature and stamp say SAMPLE. Existing imported artwork takes precedence.
- School logo is shared by Templates, General, both sidebar logo positions, document previews, print and PDF. Updating it from either settings screen updates the others and survives reload.

## 2. Shared components and utilities

GeneratedDocumentPreview remains the shared rendering/download/print component. documentLayout reserves separate areas for artwork, identity, fields, total, signature, stamp and footer. documentWithBranding applies the current shared logo while preserving saved financial fields. schoolLogoFor resolves existing uploads, explicit removal and the sample fallback. readBrandingImage validates and resizes transparent artwork. financeLedger normalizes fee receipts and salary payments for the combined transaction table.

## 3. Architecture

The existing feature folders, primitives, design tokens, useSchool subscription and repository mutation boundary remain. Finance composes the existing fees and salary screens; calculations are shared utilities. No packages or backend endpoints were added. The temporary test server configuration is not copied to the project.

## 4. Data and persistence

The existing local repository stores template choices, a color map for each document type, school artwork, attendance and payment records. Old settings without colors/artwork are accepted. Explicit removal is stored as null. The shared school logo is synchronized atomically with template branding.

New receipts/slips capture header, footer, signature, stamp, financial values and the selected design. Reprints use the current shared school logo. Financial snapshots are not rewritten. Older documents without branding use current configured artwork or the sample fallback.

Finance defaults to the academic year and can filter to a monthly payment-day cycle, up to today. It reports actual recorded student fee collections and salary payments. Net Revenue is collections minus paid salaries. Pending Student Fees is the remaining balance of current student plans, including future installments. Unpaid salaries do not count as paid expenses. All money calculations use the existing integer-paise model. The selected salary cycle's gross salary, deductions and net salary appear in Finance's Salary Overview.

Salary payment, history and slips are available only in Finance → Salary Expenses. Staff & HR retains All Staff, Attendance and Leave. Old /staff?tab=Salary links redirect to Finance with their month, department and staff selection preserved. The financial panel is removed from the main dashboard. Header and footer artwork stretch to the reserved content width on every design; logo, signature and stamp preserve their proportions. Import cards show recommended pixel dimensions and supported file limits.

## 5. Validation

Final check results are recorded in the user-facing implementation report. Checks cover unit calculations and schemas, TypeScript, lint, production build, keyboard/accessibility and desktop/mobile layouts, existing payment workflows, shared-logo reload, independent design colors, artwork uploads, actual downloaded PDF image pixels and attendance-derived leave deductions. Visual inspection includes one-page A4 receipts/slips with all artwork and non-overlapping text.

## 6. Limits and assumptions

This is frontend-only local persistence. Recording payment records an office transaction; it does not move money. No external delivery or integrations were added. PNG/JPEG/WebP imports accept files up to 5 MB and resize them for local storage. Receipt and slip PDFs are raster A4 documents. Other expense categories, refunds, bank reconciliation and accounting reports are outside this pass. Existing browser data is preserved.

## 7. Next steps

Replace sample artwork with the school's actual assets, then review fee/salary payment records and cycle totals using the existing workflows. Add other expense categories only when needed.

## 8. Backend mapping

Replace repository persistence with confirmed typed backend services for school branding, template choices, attendance, fee transactions and salary payments. Store artwork in file storage, keep immutable financial snapshots/document numbers, and return the same selectors' data shapes. Implement tenant authorization and payment auditing on the server when backend integration begins. Screens do not need to be rewritten.
