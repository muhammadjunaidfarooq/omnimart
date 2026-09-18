# Development Roadmap

_Last updated: 2026-09-02_

This is a living plan, not a spec — update it as priorities change or items
land. It replaces the stale "Current phase" note that used to live in
`CLAUDE.md`.

## Where the project actually is

Contrary to the old phase tracker (which still said "Next: Phase 3 —
Inventory Management"), a full audit found Inventory is already built, and
so is everything past it:

- Auth (JWT access+refresh cookies, roles), Users
- Catalog (Products, Categories, Brands, Units), SKU generation
- Inventory (stock-in / adjustment, append-only ledger, low-stock/out-of-stock
  summary, per-batch expiry with FEFO consumption, FIFO price layering)
- Sales (drafts, checkout, refunds, history, per-cashier and store-wide views)
- Khata / credit (borrowers, partial/full payments, overpayment → store
  credit, split cash+khata payments, credit auto-apply at checkout)
- Accounting & reporting (P&L, daily cash summary, monthly trend, cash vs
  transfer, top products, CSV export on every report table)
- Expenses, Dashboard KPIs, Settings/branding

No module is stubbed or incomplete. The gaps below are what's actually
worth planning around next.

## 1. New feature: Loyalty / Rewards program

**Requested rule:** every Rs 500 of *full-price* spend earns the customer a
"ticket" worth Rs 10. Discounted line items (product-level or global
discount) do not count toward the threshold.

**Open scope question — needs a decision before design:** CLAUDE.md
explicitly lists "Customer management" as out of scope for the MVP. Right
now only khata customers (`Borrower`) have any identity in the system — a
plain cash sale has no customer record at all. A rewards program needs
per-customer spend tracking across visits, so pick one:

- **(a) Khata customers only** — no scope change, rewards accrue only for
  borrowers who already have an identity in the system.
- **(b) Every customer** — checkout gains an optional "customer" picker for
  *all* payment methods (not just credit-related ones) so cash customers
  can be identified and tracked too. This is a real, if small, expansion of
  "customer management."

**Once scope is picked, the work breaks down as:**

- **Data model**: a reward balance separate from `Borrower.creditBalance`
  (different rules/semantics — e.g. rewards might later expire or have
  redemption limits) — either a new `Borrower.rewardBalance` field or a
  small ledger table if a history of accrual/redemption events matters.
- **Accrual logic**: at checkout, compute each sale's "qualifying
  subtotal" — sum of line totals with no discount applied — and accumulate
  it per customer; every full Rs 500 accumulated converts to a Rs 10
  reward. Needs a decision on rounding/carry-over (does partial progress
  toward the next Rs 500 persist across sales, or reset?).
- **Redemption**: a way to apply reward balance at a future checkout,
  mirroring the `useCredit` toggle pattern already built for khata.
- **Reporting**: reward balances visible on the khata/customer page, maybe
  a dashboard figure for total outstanding reward liability (same shape as
  the credit-liability gap below).

## 2. Dashboard custom date range & filters — ✅ done 2026-08-25

`DashboardOverview` (`apps/web/src/components/admin/dashboard/dashboard-overview.tsx`)
now sits above the KPI cards and charts with a shared date range +
payment method + cashier filter bar (reuses the existing `DateRangeFilter`
component from the Reports tab). Leaving it untouched preserves each
widget's original default window (today / last 30 days / last 12 months);
setting any filter re-drives `KpiCards`, `SalesTrendChart`,
`MonthlySalesChart`, `ProfitExpenseChart`, `RecentSalesWidget`, and
`TopProductsWidget` together. `LowStockWidget` and the below-the-fold
`ReportsSection` are intentionally unaffected (a live stock snapshot and
independently-filterable reports, respectively).

Category filtering was deliberately deferred — unlike payment method and
cashier (both plain `Sale` columns), a category filter needs revenue
computed from matching sale *lines* rather than whole-sale totals, a
bigger change than the other two. Backend: a shared `SaleFilterDto`
(`apps/api/src/common/dto/sale-filter.dto.ts`) mixed into
`DateRangeQueryDto`/`DailySummaryQueryDto`/`SalesReportQueryDto`/
`SalesHistoryQueryDto`/`DashboardQueryDto`; `AccountingService.getPnl`/
`getDailyCashSummary`/`getMonthlyPnl` and `SalesService.getDailySales`/
`getMonthlySales`/`getTopProducts`/`findHistory` all now honor
`paymentMethod`/`cashierId` (the cashier-role security guard on
`findHistory` — never able to see another cashier's sales — is
preserved). `getDailyCashSummary` also gained an optional `from`/`to`
range alongside its original single-`date` use, needed since its
SPLIT-aware "only the cash portion counts" cash-drawer math isn't
equivalent to `getPnl`'s payment-method revenue breakdown.

## 3. Stock-in price changes only apply to new stock (FIFO layering) — ✅ done 2026-08-25

Built on top of the `StockBatch` model added the same day for expiry/FEFO
tracking (see below) — `StockBatch` gained its own `costPrice`/`sellingPrice`
(migration `20260825063648_add_stock_batch_prices`, backfilled from each
product's price at the time). Sales now price from the active — earliest
non-depleted, same FEFO order expiry already uses — batch via
`InventoryService.resolveLinePrice`, not the product's live price; old stock
keeps its old price until fully sold through.

Decisions made: both `costPrice` and `sellingPrice` are tracked per batch.
When a line's quantity spills past what remains in the active batch, the
**whole line** prices at whichever batch would end up supplying it (no
blended per-unit pricing, no error) — physical stock deduction still
correctly splits across batches underneath via the existing `consumeFefo`.
`ProductsService.findAll`/`findOne` now also return `activeCostPrice`/
`activeSellingPrice` per product, and the cashier product grid/cart preview
were switched to it, so what a cashier sees while shopping always matches
what checkout charges. `AccountingService`'s COGS calculation (previously an
explicitly-flagged simplification using each product's *current* cost) now
uses a weighted-average of the actual batch(es) a sale item drew from
(`SaleItemBatch` → `StockBatch.costPrice`), falling back to the product's
current cost only for sale items that predate batch tracking.

## 3a. Expiry tracking + FEFO consumption — ✅ done 2026-08-25

Per-batch expiry dates with a first-expiry-first-out sell order, plus a
shared Expiry view (Admin + Cashier) showing Expired/Expiring Soon/Good.
See `StockBatch`, `SaleItemBatch`, `InventoryService.consumeFefo`/
`restockToBatches`, and the `/expiry` page. This is the batch model item 3
above builds its pricing on top of.

## 4. Go-live data cleanup (production) — ✅ done 2026-08-24

Executed against production. Backup taken first
(`~/ims-backup-pre-cleanup-20260824133850.sql` on the server). Deleted 17
sales, 22 sale items, 7 khata payments, 2 borrowers, 26 stock movements (0
refunds/expenses existed); reset all 189 products' `currentStock` to 0 and
`invoice_counters` to 0. Verified after: all deleted tables at 0 rows,
`sku_counters` untouched at 189 (correctly in sync with kept products),
catalog/users/business settings all intact.

## 4a. Day closing / cash register close-out — ✅ done 2026-09-02

New `DayClosing` model + `/day-closing` module (mirrors the `expenses`/
`accounting` module shape). Admin closes a day from a new "Close Day" tab
on `/admin/expenses`: enters how much of today's cash was spent on
inventory purchases during the day, and the system snapshots that day's
total sales and net cash-on-hand (reusing `AccountingService.getPnl`/
`getDailyCashSummary`, no duplicated math) to derive a remaining cash
balance. Re-submitting the same date overwrites its record (upsert on
`date`) rather than erroring, so a mistake can be corrected without a
separate edit endpoint. A closing history table backs it with pagination.

Since there's no supplier/purchase module (explicitly out of scope), the
inventory-spend figure is a plain admin-entered cash amount, not derived
from stock-in records.

The Dashboard's KPI row also gained a **Remaining Cash Balance** tile —
`DayClosingService.getInventorySpendTotal()` sums `cashUsedForInventory`
for every day closed within the KPI's date range, and
`DashboardService.getKpis` nets that against live cash-in-hand. It reads
as plain Cash in Hand before any day in range is closed, and keeps moving
with new sales recorded after a day is closed — a running prediction, not
a frozen snapshot.

## 4b. Cash Withdrawal / Cash Deposit — ✅ done 2026-09-02

A cashier can now record a customer cashing out (transfer in, cash out) or
cashing in (cash in, transfer out) — modeled as two new `Service.direction`
values (`CASH_WITHDRAWAL`/`CASH_DEPOSIT`) on the existing Service/
ServiceTransaction feature rather than as their own tables, after an
earlier standalone-model version was reworked into this shape mid-session.
Both directions can carry a fee (same `defaultFee`/`useTieredFee`/
`feePerThousand` config a bill-payment service already had), with a
per-transaction **Fee Included/Excluded** toggle the cashier confirms:
every such transaction has a money-in side and a money-out side
(`fee = amountIn - amountOut`); Included fixes the entered amount as
`amountIn` and deducts the fee to get `amountOut`, Excluded fixes it as
`amountOut` and adds the fee on top to get `amountIn`. `direction` and
`feeInclusive` are both snapshotted onto `ServiceTransaction` at creation
time so a later change to a service's settings never reclassifies past
transactions. `AccountingService.getDailyCashSummary` now classifies each
service transaction by its snapshotted direction (not payment method) to
decide whether it's a cash inflow or outflow — a deposit's cash correctly
adds to Cash in Hand, a withdrawal's correctly subtracts, with zero
revenue leakage into P&L (a fee is real revenue there regardless of
direction, everything else nets to zero).

Fixed a real double-counting bug found along the way: Close Day's
breakdown showed "Cash sales" (which already includes deposit cash) and a
separate "+ Cash deposits" row on top of it, so the displayed rows summed
to a different number than the total shown below them. Both Close Day and
the Daily Cash Summary tab now show "Sales" as product/bill-payment cash
only (deposits excluded) plus a separate "Deposits" row, so every rows-sum
matches its stated total.

**Production deploy note**: one of this feature's migrations
(`20260901203303_snapshot_service_transaction_direction`) originally added
`ServiceTransaction.direction` as bare `NOT NULL` with no default, which
`prisma migrate deploy` cannot apply to a non-empty table — and
`service_transactions` has held real bill-payment data since 2026-08-27.
Caught before deploying: fixed to add the column with
`DEFAULT 'BILL_PAYMENT'` (backfills every pre-existing row, all of which
predate this feature and are genuinely bill payments) then drop the
default, matching the schema's no-default field.

## 5. Gaps surfaced by the audit

### High priority
- **Zero automated test coverage anywhere** — checkout totals, khata
  settlement/credit math, refunds, inventory ledger, P&L all have no
  tests. For a POS handling real money this is the single biggest risk in
  the codebase. Start with unit tests for `SalesService.checkout()`,
  `KhataService`'s settlement logic, and `InventoryService`'s ledger math.
- ~~**No rate limiting on login**~~ — ✅ done 2026-08-25. Added
  `@nestjs/throttler`: a global default (100 req/min per IP,
  `AppModule`/`main.ts`, plus `app.set('trust proxy', 1)` so `req.ip` is
  correct behind nginx in production) and a stricter override on
  `/auth/login` itself (5 attempts / 15 min per IP, `@Throttle(...)` on
  `AuthController.login`). Verified live: a 6th attempt in the window
  returns `429` regardless of whether the password is right, other routes
  are unaffected.
- **No aggregate store-credit-liability view** — nothing computes
  `SUM(Borrower.creditBalance)` across all customers; a store owner has to
  eyeball the khata table to know how much credit is owed in total. Cheap
  to add (dashboard KPI and/or a khata report tab) now that this session
  introduced the concept via the cash-overpayment-credit flow.

### Medium priority
- The frontend never calls the already-built `POST /auth/refresh` —
  sessions hard-expire straight to the auto-logout-on-401 flow (added this
  session) instead of silently refreshing first. If production uses a
  short access-token TTL (the `.env.example` recommends 15m), cashiers
  will get logged out mid-shift more than necessary. Worth adding a
  refresh-then-retry step before the hard redirect.
- "Forgot password" is a static "ask your admin" dialog, no self-service
  reset flow exists. Probably fine for a small single-shop deployment —
  worth a deliberate decision rather than leaving it as an accident.
- API lint debt: 197 errors, concentrated in ~3 auth-strategy files
  (Passport `any`-typing from untyped `validate()`/`req.user`). An
  afternoon of typed-`validate()` cleanup would let CI make `api` lint
  blocking (currently `continue-on-error`).
- Web lint debt is trivial (1 unused-import warning) — its CI lint step
  could be flipped to blocking today at effectively no cost.

### Low priority
- No PDF export (CSV export already exists on every report table).
- Low-stock is dashboard-widget only; no dedicated alert/reorder page.
- Possible duplication between `/admin/expenses`'s P&L/cash-summary views
  and the dashboard's Reports tab — worth a look, not urgent.

## 6. Housekeeping

- ~~Update `CLAUDE.md`'s "Current phase" note~~ — done as part of adding
  this roadmap; it now points here instead of a hardcoded phase number.
