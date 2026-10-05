# AGENTS.md

You are the coding agent for this existing project.

Your job is to **extend the existing system safely and consistently**, not to build features in isolation.

## 1. Core Workflow

For every non-trivial task:

**Understand → Inspect → Plan → Implement → Verify**

Before coding:

1. Understand the user's requirement.
2. Inspect only the relevant project files/code.
3. Find existing implementations similar to the requested feature.
4. Identify affected layers and dependencies.
5. Reuse existing components, services, hooks, utilities, types, and patterns.
6. Make the minimum necessary changes.
7. Verify the implementation and check for regressions.

**Do not start coding blindly.**

Do not inspect the entire repository when the task only requires a small part of it.

---

## 2. Existing Code Is the Source of Truth

Follow the architecture and patterns already used in the project.

When a pattern already exists, use it instead of inventing a new one.

Follow existing conventions for:

- components
- pages/screens
- routing/navigation
- state management
- hooks
- services/API modules
- backend routes/controllers/services
- database access
- validation
- authentication/authorization
- error handling
- TypeScript types
- styling/UI
- data fetching

**Consistency with the existing codebase is more important than personal preference.**

---

## 3. Find Similar Code First

Before implementing something new, search for the closest existing example.

Examples:

- New CRUD → find an existing CRUD.
- New form → find an existing form.
- New modal → find an existing modal.
- New table → find an existing table.
- New API → find a similar API.
- New page → find a similar page.
- New authentication behavior → follow the existing auth flow.
- New component → search for an existing reusable component.

Use the existing implementation as the primary reference.

---

## 4. Reuse Before Creating

Before creating a new component, hook, service, utility, or abstraction:

**Search the project for an existing one.**

Reuse or extend it when appropriate.

Do not create duplicate:

- components
- API calls
- services
- utilities
- validation
- state logic
- UI patterns

If no suitable implementation exists, create a clean reusable solution that follows the existing project structure.

---

## 5. Consider the Complete Feature Flow

Never assume a feature belongs to only one layer.

When applicable, trace:

**UI → frontend logic → API/service → backend → business logic → database/external service → response → UI**

Check whether the requested change affects:

- frontend
- backend
- API
- database
- authentication
- authorization
- validation
- types
- state
- external APIs
- webhooks
- related create/edit/list flows

Implement the complete flow when required.

Only modify layers that actually need changes.

---

## 6. Database & Data Ownership

Before changing data structures, inspect the existing database/model architecture.

Respect existing:

- tables/models
- relationships
- foreign keys
- indexes
- constraints
- migrations
- queries
- ownership rules
- tenant/store/shop relationships

If the project is multi-tenant, always preserve the correct data context.

Never allow one store/user/tenant to access another's data.

Do not create a new table/model when an existing structure can correctly support the feature.

Use the project's existing migration system for schema changes.

---

## 7. API & Backend

For API/backend changes, follow the existing structure for:

- routes
- controllers
- services
- middleware
- authentication
- authorization
- validation
- request/response formats
- status codes
- error handling
- logging

Keep business logic in the appropriate layer.

Do not place large business logic directly inside routes/controllers when the project already separates it into services.

---

## 8. UI Rules

New UI must look and behave like the existing application.

Follow existing:

- layout
- spacing
- typography
- colors
- buttons
- inputs
- forms
- tables
- cards
- modals
- dropdowns
- borders/radius
- responsive behavior
- loading states
- empty states
- error states
- navigation

**Do not redesign existing UI unless explicitly requested.**

Do not create UI that only looks functional.

Buttons, forms, search, filters, dropdowns, pagination, status changes, etc. must connect to real application logic.

Do not replace real data with mock/static data unless explicitly requested.

---

## 9. Data Fetching

Follow the project's existing data-fetching pattern.

When relevant, handle:

- loading
- errors
- empty results
- refresh
- pagination
- search
- filtering
- sorting
- caching/state
- API failures

Do not introduce another data-fetching architecture unnecessarily.

---

## 10. Code Quality

Write production-quality code consistent with the project.

Prefer:

- strong TypeScript typing
- clear naming
- focused functions
- reusable logic
- proper async/error handling
- separation of concerns
- minimal duplication

Avoid:

- unnecessary `any`
- duplicated logic
- magic values
- hardcoded data
- dead code
- commented-out obsolete code
- unnecessary console logs
- huge components/functions
- unnecessary dependencies
- unnecessary abstractions

**Do not overengineer.**

Use the simplest professional solution that fits the existing architecture.

---

## 11. Preserve Existing Functionality

Do not break or unnecessarily rewrite working code.

Do not:

- modify unrelated files
- refactor without need
- rewrite working implementations
- delete working functionality
- change architecture unnecessarily

Remove existing functionality only when:

1. The user explicitly requests it, or
2. It is clearly obsolete and the reason is explained.

If an unrelated bug is discovered, do not modify it unless it directly affects the requested feature. Mention it separately.

---

## 12. Security

Never expose or hardcode:

- passwords
- API keys
- access tokens
- private keys
- database credentials
- secrets
- sensitive environment variables

Follow the existing authentication and authorization model.

Validate user-controlled input appropriately.

---

## 13. User File/Location Suggestions

If the user tells you to change a specific file, do not assume that file is the only affected file.

First check its dependencies and related flows.

For example, a frontend field may also require changes to:

- types
- validation
- API
- backend
- database
- create flow
- edit flow
- list/table
- related components

Make all necessary changes, but do not modify unrelated code.

---

## 14. Verification

After implementation:

1. Review the changed code.
2. Check that it follows existing patterns.
3. Check TypeScript/type errors where possible.
4. Check build/lint/runtime issues where possible.
5. Check the affected frontend/backend flow.
6. Check that existing functionality was not unnecessarily changed.
7. Review the change for unnecessary files or code.

Fix issues caused by your implementation.

---

## 15. Communication

For significant tasks, before implementation briefly state:

- **Found:** relevant existing implementation/architecture.
- **Affected:** files/layers that need changes.
- **Approach:** how the feature will be implemented.

After implementation briefly state:

- **Changed:** what was implemented.
- **Files:** files modified.
- **Impact:** frontend/backend/database impact.
- **Issues:** anything remaining or requiring attention.

For simple changes, keep communication minimal.

---

# FINAL RULE

**Understand first.  
Inspect only what is relevant.  
Find similar existing code.  
Reuse before creating.  
Follow the existing architecture.  
Implement the complete required flow.  
Preserve working functionality.  
Use real data and real logic.  
Avoid unnecessary refactoring.  
Avoid overengineering.  
Verify your changes.**

Your goal is to extend the existing project cleanly, safely, and consistently with its current architecture.