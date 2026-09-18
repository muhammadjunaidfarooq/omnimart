## 1. Tech Stack (recommended, adjust if you have a preference)

| Layer | Choice | Notes |
|---|---|---|
| Backend | NestJS + TypeScript | Modular structure maps 1:1 to feature list below |
| ORM | Prisma | Fast schema iteration, good with PostgreSQL |
| Database | PostgreSQL | Matches spec's DB requirement |
| Auth | JWT (access + refresh) | Passport.js strategy in Nest |
| Frontend | Next.js (App Router) + TypeScript | You already have deployment experience here |
| Styling | Tailwind CSS | Fast POS UI iteration |
| State | Zustand or React Query | React Query for server state, Zustand for cart/UI state |
| Printing | ESC/POS via `node-thermal-printer` or browser print CSS | Decide in Phase 6 |
| Deployment | VPS + PM2 + Nginx | Matches your existing setup pattern |
| File storage | Local disk or S3-compatible (product images) | Local is fine for MVP single-shop |

---

## 2. Suggested Repo Structure

```
pos-system/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/
│   └── shared-types/ # Shared TS types/DTOs between api & web
├── CLAUDE.md
├── PLAN.md
└── docker-compose.yml   # postgres for local dev
```

Monorepo (npm/pnpm workspaces) keeps shared types in sync — worth the setup cost given POS + Inventory + Reports all share DTOs.

---

## 3. Phased Development Plan

Each phase lists: goal, concrete deliverables, and a "definition of done" so you know when to move on.

### **Phase 1 — Foundations & Auth (Days 1–2)**
**Goal:** working skeleton with login.
- Monorepo scaffold (Nest API + Next.js web)
- PostgreSQL schema for `users` table + Prisma setup
- JWT auth: login, logout, refresh token, guard middleware
- Roles: `ADMIN`, `CASHIER` — role-based route guards on API
- Basic protected layout in Next.js (redirect to `/login` if unauthenticated)

**Done when:** Admin and cashier can log in, get routed to different landing pages, and hitting an admin-only API route as a cashier returns 403.

---

### **Phase 2 — Product & Catalog Management (Days 2–3)**
**Goal:** admin can fully manage the catalog.
- Prisma models: `products`, `categories`, `brands`, `units`
- SKU auto-generation service (`PRD-000001` format, sequential + gapless)
- CRUD APIs for products/categories/brands
- Product image upload (local disk, served via static route)
- Admin UI: product list (table, search, filter by category), create/edit form, category & brand management screens

**Done when:** Admin can create a product end-to-end (image, price, tax, discount, stock levels) and see it in a searchable list.

---

### **Phase 3 — Inventory Management (Days 3–4)**
**Goal:** stock tracking independent of sales.
- `inventory` table + stock movement log table (append-only ledger: type = IN / OUT / ADJUSTMENT, qty, reason, timestamp, user)
- Stock-in / manual adjustment API + UI
- Low-stock / out-of-stock computed status (based on `minimum_stock_level`)
- Dashboard-ready aggregate queries (current stock value, low stock count)

**Done when:** Adjusting stock updates `products.current_stock` and writes a ledger entry; low-stock items are queryable.

---

### **Phase 4 — POS Core (Days 4–6)** ⭐ Critical path
**Goal:** a cashier can complete a real sale.
- POS UI: product search (by name + SKU), category quick-filter, tap-to-add cart
- Cart logic: quantity update, per-item discount, tax calc, live totals (client-side calc mirrored by server-side recalculation at checkout — never trust client totals)
- Checkout: payment method selector (Cash / Online Transfer), cash tendered input, transfer reference input
- Sale creation API: transaction that (a) creates `sales` + `sale_items`, (b) decrements stock via the ledger from Phase 3, (c) records payment method and updates cash/bank totals — all in one DB transaction
- Hold bill / resume bill (store as a `DRAFT` sale)
- Invoice generation (on-screen, printable HTML view first — thermal printer comes in Phase 9)
- Keyboard shortcuts (barcode-style Enter-to-add, F-keys for payment method, etc.)

**Done when:** A cashier can search a product, build a cart, check out with either payment method, stock decrements correctly, and an invoice renders. This is the single most important phase — test it thoroughly before moving on.

---

### **Phase 5 — Sales Management (Day 6–7)**
**Goal:** visibility and correction tools for completed sales.
- Sales history list (admin + cashier's own sales), filters by date/product
- Invoice detail view
- Sales return/refund flow (reverses stock ledger entry + adjusts cash/bank totals; needs its own audit trail, don't just delete/edit the original sale)

**Done when:** A refund correctly reverses both the financial totals and the stock count, and both the original sale and the refund are visible in history.

---

### **Phase 6 — Expenses & Accounting (Day 7–8)**
**Goal:** basic money-in/money-out tracking beyond sales.
- `expenses` table with predefined categories (Rent, Electricity, Internet, Fuel, Maintenance, Misc)
- Expense CRUD + monthly summary
- Accounting module: aggregate Total Sales (Cash + Online), Total Expenses, Net Profit
- Daily cash summary, Profit & Loss statement (simple: revenue − COGS-ish via purchase price − expenses)

**Done when:** P&L numbers reconcile against manually-summed test data.

---

### **Phase 7 — Dashboard (Day 8–9)**
**Goal:** admin's single-screen overview.
- KPI cards (today's sales, profit, expenses, net profit, cash in hand, online transfer total, inventory value, low/out-of-stock counts) — backed by the aggregate queries built in Phases 3 & 6
- Recent sales widget, top-selling products widget, low-stock alert widget
- Charts: daily sales trend, monthly sales, profit vs. expense (Recharts or similar)

**Done when:** Dashboard numbers match what you'd get by manually querying the DB for the same day/month.

---

### **Phase 8 — Reports Module (Day 9–10)**
**Goal:** exportable/filterable reports for all the above.
- Sales reports: daily, monthly, product-wise
- Inventory reports: stock summary, low stock, out of stock
- Financial reports: P&L, expense summary, cash vs. online transfer
- Consider a shared "report table" component (columns + filters + export to CSV/PDF) rather than one-off UIs per report — reduces build time significantly

**Done when:** every report type has a working filter (date range minimum) and can be exported.

---

### **Phase 9 — Printing & Notifications (Day 10–11)**
**Goal:** physical receipt output + alerting.
- Thermal receipt printing integration (decide: browser print + CSS width formatting vs. direct ESC/POS via `node-thermal-printer`)
- SKU label printing (text-only labels)
- Notification system: low stock, out of stock, daily sales summary (in-app notification bell is enough for MVP; email/SMS is future scope)

**Done when:** a real (or emulated) receipt printer produces a correctly formatted receipt from a completed sale.

---

### **Phase 10 — Settings & User Management (Day 11–12)**
**Goal:** admin can configure the shop and manage cashier accounts.
- Business settings: store name, logo, address, currency, tax config
- Invoice/receipt layout settings
- User management: admin creates cashier accounts, password reset, activate/deactivate
- Wire settings into invoice rendering (Phase 4/9) and tax calc (Phase 4)

**Done when:** changing store settings visibly changes the invoice output.

---

### **Phase 11 — Hardening & Deployment (Day 12–14)**
**Goal:** production-ready.
- Input validation everywhere (class-validator DTOs on every endpoint)
- Rate limiting on auth endpoints
- Proper error boundaries + user-facing error states in the UI
- Seed script for demo data
- Environment config (.env for DB, JWT secret, etc.) — never commit secrets
- VPS deployment: PM2 process for Nest API, PM2 or static export for Next.js, Nginx reverse proxy + SSL (Certbot)
- Basic backup strategy for PostgreSQL (cron + pg_dump)
- Smoke-test the full flow: login → create product → stock in → sell → refund → check dashboard/reports

**Done when:** the app is live on the VPS behind Nginx/SSL and the smoke test passes end-to-end.

---

## 4. Explicitly Out of Scope (per spec — don't let Claude Code scope-creep into these)

- Supplier management
- Purchase management
- Customer management
- Employee management (beyond cashier/admin roles)
- Barcode scanning hardware integration
- Multi-branch support
- Full ERP-level accounting
- Multi-tenant SaaS