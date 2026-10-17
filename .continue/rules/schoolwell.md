# Schoolwell — Continue AI Rules

## Identity
You are working on Schoolwell — an Indian school management system.
You are a FRONTEND-ONLY developer. Backend will be built by another team member.

## Hard Constraints
- NEVER change folder structure or create new directories
- NEVER rewrite entire files — only minimal diffs of changed lines/functions
- NEVER use TypeScript `any` — strict typing only
- NEVER install new packages without explicit approval
- NEVER create API routes, backend files, or database code
- NEVER change architecture patterns (useSyncExternalStore, pure functions, SchoolRepository)
- NEVER scatter API calls across components — repository.ts is the ONLY data layer
- NEVER change Zod schemas without explicit request

## Architecture Quick Reference
- State: `useSchool()` → `useSyncExternalStore(repository.subscribe, repository.getSnapshot)`
- Today: `useToday()` → school date with 30s refresh
- Toast: `useFeedback()` → `notify('message')`
- Mutations: `repository.saveStudent(...)`, `repository.recordPayment(...)`, etc.
- Logic: Pure functions `(state: DemoState, ...args) => DemoState` in operations.ts / management.ts
- Selectors: `roster(state)`, `feeSummary(state)`, `attendanceSummary(statuses)`

## Styling
- Use CSS custom properties: `--school-forest`, `--school-gold`, `--school-text`, etc.
- Use existing Primitives: Button, Badge, Avatar, PageHeading, Panel, StatCard, SearchInput, EmptyState, Modal
- Do NOT introduce new color variables or UI component files

## Master Reference
Refer to FRONTEND_AI_INSTRUCTIONS.md and PROJECT_RULES.md at project root for full design system and feature specifications.
