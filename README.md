# OmniMart — Inventory & POS System

A point-of-sale and inventory management system for a retail store.

## Stack

- **Backend**: NestJS + Prisma + PostgreSQL
- **Frontend**: Next.js (App Router) + Tailwind + TypeScript
- **Auth**: JWT (access + refresh tokens), role guards for `ADMIN` / `CASHIER`
- **Monorepo**: pnpm workspaces (`apps/api`, `apps/web`, `packages/shared-types`)

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (developed on Node 22)
- [pnpm](https://pnpm.io/) 10+ (`npm install -g pnpm`)
- [PostgreSQL](https://www.postgresql.org/) 14+ running locally, or via Docker

## 1. Clone and install dependencies

```bash
git clone <repo-url>
cd omnimart
pnpm install
```

This installs dependencies for the root workspace and both `apps/api` and `apps/web`.

## 2. Set up the database

Create a Postgres database (adjust name/credentials as needed):

```bash
createdb omnimart
```

Or with Docker:

```bash
docker run --name omnimart-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
```

## 3. Configure environment variables

### Backend (`apps/api/.env`)

Copy the example file and fill in your values:

```bash
cp apps/api/.env.example apps/api/.env
```

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/omnimart?schema=public"

JWT_ACCESS_SECRET="change-me"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="change-me"
JWT_REFRESH_EXPIRES_IN="7d"

PORT=3001
WEB_ORIGIN="http://localhost:3000"
```

Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to strong, unique values.

### Frontend (`apps/web/.env.local`)

```bash
cp apps/web/.env.example apps/web/.env.local
```

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## 4. Run database migrations and seed data

From the repo root:

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm --filter api prisma:seed
```

The seed script creates:

| Role    | Email                 | Password    |
| ------- | --------------------- | ----------- |
| ADMIN   | admin@omnimart.local   | Admin@123   |
| CASHIER | cashier@omnimart.local | Cashier@123 |

It also seeds baseline catalog lookups (categories, brands, units).

## 5. Run the app

Start the backend and frontend in separate terminals:

```bash
pnpm dev:api   # NestJS API on http://localhost:3001
pnpm dev:web   # Next.js app on http://localhost:3000
```

Log in at `http://localhost:3000/login` with one of the seeded accounts above.

## Useful scripts (from repo root)

| Command                 | Description                          |
| ------------------------ | ------------------------------------ |
| `pnpm dev:api`           | Start the NestJS API in watch mode   |
| `pnpm dev:web`           | Start the Next.js dev server         |
| `pnpm build`             | Build both API and web apps         |
| `pnpm prisma:generate`   | Generate the Prisma client           |
| `pnpm prisma:migrate`    | Run Prisma migrations (dev)          |
| `pnpm prisma:studio`     | Open Prisma Studio                   |

## Project structure

```
apps/
  api/    NestJS backend (REST API, Prisma, auth, business logic)
  web/    Next.js frontend (App Router, Tailwind, shadcn/Base UI)
packages/
  shared-types/   Types shared between api and web
```

## Notes

- All money values are stored and transferred as integers (cents); the UI is responsible for formatting them for display.
- Stock changes always go through the inventory ledger service — never write directly to a product's stock count.
- Sale totals are recalculated server-side at checkout and are never trusted from the client.
