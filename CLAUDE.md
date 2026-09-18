# Project: [Store Name] POS System

## Stack

- Backend: NestJS + Prisma + PostgreSQL
- Frontend: Next.js (App Router) + Tailwind + TypeScript
- Auth: JWT (access + refresh), role guards for ADMIN / CASHIER

## Conventions

- All API DTOs validated with class-validator
- All money values stored as integers (cents) to avoid float rounding — convert to display format only in UI
- All stock mutations go through the inventory ledger service — never mutate `products.current_stock` directly
- Sale totals are always recalculated server-side at checkout; never trust client-submitted totals
- SKU format: PRD-000001, sequential, generated server-side

## Do NOT build (explicitly out of scope for MVP)

- Supplier/purchase management
- Customer management
- Employee management beyond admin/cashier roles
- Barcode hardware integration
- Multi-branch or multi-tenant features

## UI/design conventions

- Content pages should always use the full width of the main content area — no narrow `max-w-*` wrappers that leave large empty margins on wide screens. Use a responsive grid (e.g. stack on mobile, multi-column on desktop) instead of a single centered narrow column. Exception: genuinely single-purpose centered screens like `/login`.
- Give forms and cards generous, symmetric padding — especially bottom padding around footer buttons. Nothing should look cramped against a card's edge.
- This shadcn install is built on **Base UI**, not Radix — some APIs differ:
  - Use `render={<Link .../>}` instead of `asChild` for polymorphic components (Dialog/Menu/Sheet triggers, etc.). When a `Button` renders as a non-`<button>` element this way, also pass `nativeButton={false}` or Base UI logs a console warning.
  - `Menu.Item` fires `onClick`, not `onSelect` — `onSelect` type-checks (it's a real but unrelated React DOM event) yet silently never fires.
  - `Select.Value` shows the raw `value` string unless given a render-function child: `<SelectValue>{(value) => lookup(value)}</SelectValue>`. It does not auto-derive the label from the matching `SelectItem` the way Radix does — check this whenever adding a new `Select`.

## Current phase

Foundations, Catalog, Inventory, Sales/Checkout, Khata/Credit, Accounting/Reporting, Expenses, and Dashboard are all built. See `ROADMAP.md` for what's next and why — keep it updated instead of tracking phase numbers here.

## DEV Instructions

### General

- Think before making changes and understand the existing implementation first.
- Prefer extending existing code over introducing new patterns.
- Make the smallest change necessary to accomplish the task.
- Match the project's existing architecture and coding style.
- Keep code simple, readable, and maintainable.

### Reusability

#### Components

- Before creating a new component, search for an existing one that can be reused.
- If a component will be used in multiple places, extract it into a reusable component.
- Keep reusable components generic and configurable through props.
- Avoid duplicating UI implementations.

#### Functions

- Before writing a new function, search for an existing implementation.
- Extract repeated logic into shared utility functions.
- Keep functions focused on a single responsibility.
- Avoid duplicate business logic.

#### Types

- Reuse existing types and interfaces whenever possible.
- Avoid creating duplicate types representing the same data.
- Create types into a dedicated folder, grouping related ones into their own files - keep shared types in shared.ts file

### Backend

- Prefer the project's ORM over writing raw SQL queries.
- Reuse existing repositories, services, and utilities before creating new ones.

### Imports

- Keep all imports at the top of the file.
- Group imports in the following order:
  1. Third-party dependencies
  2. Absolute/internal project imports
  3. Relative imports
- Leave one blank line between each import group.
- Keep imports organized and remove unused imports.

### Formatting

- Separate logical code blocks with a blank line to improve readability.
- Add a blank line after:
  - Import groups
  - Type and interface declarations
  - Enums
  - Constants
  - Functions
  - Classes
- Avoid unnecessary blank lines inside logical blocks.
- Keep formatting consistent with the surrounding code.

### Code Quality

- Prefer early returns over deeply nested conditions.
- Use descriptive names for variables, functions, and types.
- Keep functions small and focused.
- Remove unused variables, imports, and dead code.
- Do not leave commented-out code behind.
- Avoid code duplication.
- Prioritize readability over cleverness.

### Before Finishing

Verify that:

- Existing implementations were reused where appropriate.
- No duplicate logic was introduced.
- Imports are organized.
- Formatting is consistent.
- No unused imports or variables remain.
- No dead or commented-out code remains.
- The implementation follows the existing project patterns.
