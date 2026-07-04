# Jaba Processing Plant — Complete Application Reference

This document is the **full reference** for the **Jaba** area of the app: beverage / processing plant operations (batches, packaging, QC, raw materials, storage, distribution, partners, reports, users, and settings). Use it for onboarding, RBAC setup, API integration, and **building new features such as an AI-powered business analysis page**.

---

## Table of contents

1. [What Jaba is](#1-what-jaba-is)
2. [Tech stack](#2-tech-stack)
3. [Source layout (`app/jaba`)](#3-source-layout-appjaba)
4. [Authentication](#4-authentication)
5. [Middleware and route access](#5-middleware-and-route-access)
6. [Layout shell and sidebar](#6-layout-shell-and-sidebar)
7. [Permissions (RBAC)](#7-permissions-rbac)
8. [Complete route catalog](#8-complete-route-catalog)
9. [Pages — behavior and typical APIs](#9-pages--behavior-and-typical-apis)
10. [Dashboard data model (for analytics / AI)](#10-dashboard-data-model-for-analytics--ai)
11. [API routes (`/api/jaba/*`) — full index](#11-api-routes-apijaba--full-index)
12. [MongoDB (`infusion_jaba`)](#12-mongodb-infusion_jaba)
13. [Important shared libraries](#13-important-shared-libraries)
14. [Environment variables](#14-environment-variables)
15. [End-to-end product flow](#15-end-to-end-product-flow)
16. [Operator walkthrough: batch → package → distribute](#16-operator-walkthrough-batch--package--distribute)
17. [Building an AI / intelligent business analysis page](#17-building-an-ai--intelligent-business-analysis-page)
18. [Known gaps and security notes](#18-known-gaps-and-security-notes)

---

## 1. What Jaba is

Jaba is a **Next.js App Router** UI under **`/jaba`**. It models a **processing plant** workflow:

| Domain | Capabilities |
|--------|----------------|
| **Production** | Batches (including infusion / flavour child lines), packaging sessions, QC checklist and results |
| **Inventory** | Raw materials, **material flow** (in/out/transfer ledger), finished storage, stock movements |
| **Distribution** | Delivery notes, distributors, stock validation against packaging |
| **Partners** | Suppliers, distributors, distributor requests |
| **Analytics** | Dashboard KPIs, batch / production / material / distribution reports with exports |
| **System** | Users, permissions, settings, SMS (super admin), barcodes |

**Database:** MongoDB database **`infusion_jaba`** (unless noted otherwise). User documents use the shared user model (`lib/models/user`) with Jaba-specific roles and `routePermissions`.

---

## 2. Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (App Router), React client components on most Jaba pages |
| Auth | NextAuth v5 (`jabaAuth` in `lib/auth-jaba.ts`), Google OAuth |
| API | Route handlers under `app/api/jaba/**/route.ts` |
| RBAC | `lib/jaba-permissions.ts`, `lib/api-jaba-permissions.ts` |
| Charts | Recharts (dashboard and reports) |
| UI | shadcn-style components (`components/ui/*`), Tailwind |

---

## 3. Source layout (`app/jaba`)

```
app/jaba/
├── layout.tsx                 # Shell: sidebar, permissions, /api/jaba/auth/me sync
├── page.tsx                   # Dashboard → GET /api/jaba/dashboard
├── login/page.tsx
├── signup/page.tsx
├── waiting/page.tsx
├── unauthorized/page.tsx
├── account-suspended/page.tsx
├── batches/
│   ├── page.tsx
│   ├── add/page.tsx
│   ├── [id]/page.tsx
│   └── edit/[id]/page.tsx
├── packaging-output/
│   ├── page.tsx
│   └── add/page.tsx
├── qc/
│   ├── checklist/page.tsx
│   └── results/page.tsx
├── raw-materials/
│   ├── page.tsx
│   ├── add/page.tsx
│   └── flow/page.tsx          # Material flow ledger → /api/jaba/raw-materials/flow
├── distribution/
│   ├── page.tsx               # Delivery notes list / status / CRUD patterns
│   └── create/page.tsx
├── suppliers/
│   ├── page.tsx
│   └── add/page.tsx
├── distributors/
│   ├── page.tsx
│   └── add/page.tsx
├── distributor-requests/page.tsx
├── storage/
│   ├── finished/page.tsx
│   └── movement/page.tsx
├── reports/
│   ├── page.tsx               # Placeholder “coming soon”
│   ├── batches/page.tsx
│   ├── production/page.tsx
│   ├── materials/page.tsx
│   └── distribution/page.tsx
├── barcodes/page.tsx
├── users/page.tsx
├── settings/page.tsx
└── sms-notifications/page.tsx # Sidebar: super_admin only
```

There is **no** `app/jaba/distribution/dispatch/page.tsx` in the repo; the permission `distribution.dispatch` exists for admin matrices and future use.

---

## 4. Authentication

| Item | Detail |
|------|--------|
| **Provider** | Google OAuth |
| **Auth instance** | `lib/auth-jaba.ts` → `jabaAuth` |
| **API route** | `/api/auth/jaba/*` → `app/api/auth/jaba/[...nextauth]/route.ts` |
| **basePath** | `/api/auth/jaba` |
| **Session** | JWT, **30 days** |
| **Cookie (dev)** | `jaba.session-token` |
| **Cookie (HTTPS / prod)** | `__Secure-jaba.session-token` |
| **Secret** | **`AUTH_SECRET_JABA`** required in production; dev may fall back to `NEXTAUTH_SECRET` |
| **User store** | Shared `lib/models/user` with Jaba `app` / `userCollection` / role / `permissions` / `routePermissions` |

**Roles (typical):**

- **`super_admin`** — full access; bypasses per-page permission checks.
- **`cashier_admin` / `manager_admin`** — must be **approved** and have per-page `view` / `add` / `edit` / `delete` flags.
- Others — usually redirected to **`/jaba/waiting`** until promoted.

**Session refresh:** `app/jaba/layout.tsx` calls **`GET /api/jaba/auth/me`** to refresh role, `status`, `approved`, and `permissions` after login and for accurate sidebar filtering.

---

## 5. Middleware and route access

**File:** `middleware.ts` (repository root).

| Rule | Behavior |
|------|----------|
| **Jaba cookie** | Protected `/jaba/*` routes require a valid Jaba session cookie (see `JABA_COOKIE_NAMES`). |
| **App isolation** | Token must have **`app === 'jaba'`** and **`userCollection === 'jaba'`** (no Catha cross-login). |
| **Inactive** | `status === 'inactive'` → **`/jaba/account-suspended`**. |
| **Approved + routes** | Non–super-admins must be **approved** and have **`routePermissions`** matching the path (prefix match, e.g. `/jaba` covers `/jaba/...`). |
| **Dev bypass** | If `NODE_ENV !== 'production'` and `ALLOW_OFFLINE_DEV=true`, middleware may allow `/jaba` UI without full API checks (offline UI work only). |

**Public / unauthenticated Jaba pages (no shell requirement from middleware path rules):**

- `/jaba/login`
- `/jaba/signup`
- `/jaba/waiting`
- `/jaba/unauthorized`
- `/jaba/account-suspended`

**Layout behavior:** For authenticated users, `layout.tsx` additionally enforces role/approval and fetches `/api/jaba/auth/me` before showing the main shell (except the auth pages above, which render without the sidebar).

---

## 6. Layout shell and sidebar

**File:** `app/jaba/layout.tsx`

**Navigation groups** (items are filtered by `canView` + `NAV_ITEM_PERMISSION_MAP`, except SMS — see below):

| Group | Items (href) |
|-------|----------------|
| **Overview** | Dashboard → `/jaba` |
| **Production** | Batch Production `/jaba/batches`, Packaging `/jaba/packaging-output`, QC `/jaba/qc/checklist` |
| **Inventory** | Raw Materials `/jaba/raw-materials`, **Material flow** `/jaba/raw-materials/flow`, Storage `/jaba/storage/finished`, Distribution `/jaba/distribution` |
| **Partners** | Suppliers, Distributors, Distributor Requests |
| **Analytics** | **Reports** links to **`/jaba/reports/batches`** (not `/jaba/reports`), Barcode Labels |
| **System** | User Management, Settings, SMS Notifications |

**Special cases:**

- **`/jaba/qc/results`** is not in the sidebar; reach via QC workflows or direct URL.
- **`/jaba/reports/production`**, **`materials`**, **`distribution`** are not top-level nav items; use Reports hub links or URLs.
- **SMS Notifications** (`/jaba/sms-notifications`): shown only if **`role === 'super_admin'`** (even if permissions would allow). Nav permission key is mapped to `system.settings` for non–super-admin logic, but the item is super-admin gated in code.

**Active route rule:** `/jaba/raw-materials` is **not** active when on `/jaba/raw-materials/flow` (sibling page).

---

## 7. Permissions (RBAC)

**Source of truth:** `lib/jaba-permissions.ts`

- Each route maps to a **`PermissionKey`** (e.g. `production.batches`).
- Admins store **`UserPermissions`** by legacy **page id** (e.g. `batches`). Mapping: `PAGE_ID_TO_ROUTE`, `PERMISSION_KEY_TO_PAGE_ID`.
- **API enforcement:** `lib/api-jaba-permissions.ts` → `requireJabaAction(permissionKey, 'view' | 'add' | 'edit' | 'delete')`.

### 7.1 All permission keys

`production.batches`, `production.addBatch`, `production.packaging`, `production.createSession`, `production.rawMaterials`, `production.addMaterial`, `production.qcChecklist`, `production.qcResults`, `distribution.main`, `distribution.create`, `distribution.dispatch`, `distribution.suppliers`, `distribution.addSupplier`, `distribution.distributors`, `distribution.addDistributor`, `storage.finished`, `storage.movement`, `reports.batches`, `reports.production`, `reports.materials`, `reports.distribution`, `reports.main`, `system.dashboard`, `system.users`, `system.settings`.

### 7.2 Route → permission key (from `ROUTE_PERMISSION_MAP`)

| Route prefix / path | Permission key |
|---------------------|----------------|
| `/jaba` | `system.dashboard` |
| `/jaba/batches`, `/jaba/batches/[id]` | `production.batches` |
| `/jaba/batches/add`, `/jaba/batches/edit/...` | `production.addBatch` |
| `/jaba/packaging-output` | `production.packaging` |
| `/jaba/packaging-output/add` | `production.createSession` |
| `/jaba/qc/checklist` | `production.qcChecklist` |
| `/jaba/qc/results` | `production.qcResults` |
| `/jaba/raw-materials` | `production.rawMaterials` |
| `/jaba/raw-materials/flow` | `production.rawMaterials` |
| `/jaba/raw-materials/add` | `production.addMaterial` |
| `/jaba/distribution` | `distribution.main` |
| `/jaba/distribution/create` | `distribution.create` |
| `/jaba/distribution/dispatch` | `distribution.dispatch` *(no `page.tsx` yet)* |
| `/jaba/suppliers`, `/jaba/suppliers/add` | `distribution.suppliers`, `distribution.addSupplier` |
| `/jaba/distributors`, `/jaba/distributors/add` | `distribution.distributors`, `distribution.addDistributor` |
| `/jaba/storage/finished` | `storage.finished` |
| `/jaba/storage/movement` | `storage.movement` |
| `/jaba/reports` | `reports.main` |
| `/jaba/reports/batches` | `reports.batches` |
| `/jaba/reports/production` | `reports.production` |
| `/jaba/reports/materials` | `reports.materials` |
| `/jaba/reports/distribution` | `reports.distribution` |
| `/jaba/users` | `system.users` |
| `/jaba/settings` | `system.settings` |

### 7.3 Layout `NAV_ITEM_PERMISSION_MAP` overrides

| Nav href | Key used for `canView` |
|----------|-------------------------|
| `/jaba/barcodes` | `system.dashboard` |
| `/jaba/distributor-requests` | `distribution.distributors` |
| `/jaba/sms-notifications` | `system.settings` *(plus super_admin-only filter)* |

---

## 8. Complete route catalog

| Path | File | Purpose (short) |
|------|------|------------------|
| `/jaba` | `page.tsx` | Production dashboard (KPIs, charts, polls `GET /api/jaba/dashboard` ~30s) |
| `/jaba/login` | `login/page.tsx` | Google sign-in |
| `/jaba/signup` | `signup/page.tsx` | Sign-up |
| `/jaba/waiting` | `waiting/page.tsx` | Pending approval / no permissions |
| `/jaba/unauthorized` | `unauthorized/page.tsx` | Valid session, route not allowed |
| `/jaba/account-suspended` | `account-suspended/page.tsx` | Inactive account |
| `/jaba/batches` | `batches/page.tsx` | Batch list |
| `/jaba/batches/add` | `batches/add/page.tsx` | Create batch |
| `/jaba/batches/[id]` | `batches/[id]/page.tsx` | Batch detail, infusion / flavour actions |
| `/jaba/batches/edit/[id]` | `batches/edit/[id]/page.tsx` | Edit batch |
| `/jaba/packaging-output` | `packaging-output/page.tsx` | Packaging sessions list |
| `/jaba/packaging-output/add` | `packaging-output/add/page.tsx` | New packaging session |
| `/jaba/qc/checklist` | `qc/checklist/page.tsx` | QC checklist |
| `/jaba/qc/results` | `qc/results/page.tsx` | QC results history |
| `/jaba/raw-materials` | `raw-materials/page.tsx` | Materials master / stock |
| `/jaba/raw-materials/add` | `raw-materials/add/page.tsx` | Add material |
| `/jaba/raw-materials/flow` | `raw-materials/flow/page.tsx` | **Flow ledger** (filters, `GET /api/jaba/raw-materials/flow`) |
| `/jaba/distribution` | `distribution/page.tsx` | Delivery notes |
| `/jaba/distribution/create` | `distribution/create/page.tsx` | Create/edit delivery note |
| `/jaba/suppliers` | `suppliers/page.tsx` | Suppliers |
| `/jaba/suppliers/add` | `suppliers/add/page.tsx` | Add supplier |
| `/jaba/distributors` | `distributors/page.tsx` | Distributors |
| `/jaba/distributors/add` | `distributors/add/page.tsx` | Add distributor |
| `/jaba/distributor-requests` | `distributor-requests/page.tsx` | Inbound requests |
| `/jaba/storage/finished` | `storage/finished/page.tsx` | Finished goods |
| `/jaba/storage/movement` | `storage/movement/page.tsx` | Movements |
| `/jaba/reports` | `reports/page.tsx` | Placeholder only |
| `/jaba/reports/batches` | `reports/batches/page.tsx` | `GET /api/jaba/batch-reports` |
| `/jaba/reports/production` | `reports/production/page.tsx` | `GET /api/jaba/production-reports` + PDF/Excel export |
| `/jaba/reports/materials` | `reports/materials/page.tsx` | `GET /api/jaba/material-reports` |
| `/jaba/reports/distribution` | `reports/distribution/page.tsx` | `GET /api/jaba/distribution-reports` |
| `/jaba/barcodes` | `barcodes/page.tsx` | Barcode labels |
| `/jaba/users` | `users/page.tsx` | User admin |
| `/jaba/settings` | `settings/page.tsx` | Settings |
| `/jaba/sms-notifications` | `sms-notifications/page.tsx` | SMS config / logs (super_admin nav) |

---

## 9. Pages — behavior and typical APIs

### 9.1 Auth and account

- **Login / signup / waiting / unauthorized / account-suspended** — no sidebar; redirect logic in `layout.tsx` and middleware.

### 9.2 Dashboard (`/jaba`)

- **`GET /api/jaba/dashboard`** — aggregated stats, recent batches/deliveries, low stock, time series for charts (see [§10](#10-dashboard-data-model-for-analytics--ai)).

### 9.3 Production

- **Batches** — `GET/POST /api/jaba/batches`, `GET/PATCH/DELETE /api/jaba/batches/[id]`, infusion `POST /api/jaba/batches/[id]/infuse`, flavour output `.../batches/flavour-output/[id]`.
- **Packaging** — `GET/POST /api/jaba/packaging-output`, **`GET /api/jaba/packaging-material-stock`** for consumables checks.
- **QC** — checklist and results pages (batch/QC APIs as wired in each page).

### 9.4 Inventory

- **Raw materials** — `GET/POST/PATCH /api/jaba/raw-materials`.
- **Material flow** — **`GET /api/jaba/raw-materials/flow`** with query params: `direction`, `material`, `from`, `to`, `limit` (page uses `limit=800`).
- **Usage audit** — `GET /api/jaba/raw-materials/usage-logs`.
- **Storage** — finished goods and movements via `GET /api/jaba/finished-goods`, `GET /api/jaba/stock-movements` (per page implementation).

### 9.5 Distribution

- **List / update status / delete** — `GET`, `PATCH`/`PUT`, `DELETE` patterns on **`/api/jaba/delivery-notes`**; delete may involve **`/api/jaba/delete-otp`**.
- **Create** — `GET /api/jaba/delivery-notes/next-id`, `GET /api/jaba/distributors`, `GET /api/jaba/batches`, `GET /api/jaba/packaging-output`, `GET /api/jaba/delivery-notes` (availability), `POST /api/jaba/delivery-notes`.

### 9.6 Partners

- **Suppliers / distributors** — `GET/POST/PATCH /api/jaba/suppliers`, `.../distributors`; history **`/api/jaba/supplier-history`**, **`/api/jaba/distributor-history`** (+ export routes).
- **Distributor requests** — `GET/POST /api/jaba/distributor-requests`, `GET/PATCH/DELETE /api/jaba/distributor-requests/[id]`.

### 9.7 Reports

| Page | Primary API |
|------|-------------|
| Batch | `GET /api/jaba/batch-reports` |
| Production | `GET /api/jaba/production-reports` (+ `.../export/pdf`, `.../export/excel`) |
| Materials | `GET /api/jaba/material-reports` |
| Distribution | `GET /api/jaba/distribution-reports` |

### 9.8 System

- **Users** — `/api/jaba/users`, `/api/jaba/users/[id]`, `.../role`, `.../status`, `.../permissions`, `.../make-superadmin`.
- **Current user permissions** — `GET /api/jaba/user/permissions`.
- **SMS** — `/api/jaba/sms-notifications` (pairs with `lib/jaba-sms.ts` where used).

### 9.9 Reference data (often used in forms)

- **`GET/POST/PATCH /api/jaba/flavors`**, **`/api/jaba/categories`**.

---

## 10. Dashboard data model (for analytics / AI)

The dashboard client expects JSON shaped like (see `app/jaba/page.tsx`):

- **`dashboardStats`** — `totalBatches`, `batchesThisMonth`, `batchesToday`, `totalLitresManufactured`, `litresProducedToday`, `batchesInQC`, `finishedGoodsStock` (500ml / 1L / 2L), `currentRawMaterials`, `lowStockMaterials`, `pendingDistributions`, `completedDistributions`.
- **`recentBatches`** — id, batchNumber, flavor, status, totalLitres, outputSummary.
- **`recentDeliveries`** — distributor, batch, items, driver.
- **`lowStockMaterials`** — id, name, currentStock, unit, minStock.
- **`dailyProductionData`**, **`weeklyProductionData`**, **`materialUsageTrends`**, **`qcPassFailData`**, **`weeklyDistributionData`** — series for Recharts.

This is the **single highest-level snapshot** for “how is the plant doing right now?” and is ideal input for summarization or anomaly questions in an AI layer.

---

## 11. API routes (`/api/jaba/*`) — full index

All handlers live under `app/api/jaba/`. Most mutating routes use **`requireJabaAction`** — verify each `route.ts` for HTTP verbs and exact permission keys.

| Path | Role |
|------|------|
| `GET /api/jaba/auth/me` | Current Jaba user (role, status, approved, permissions) |
| `GET /api/jaba/dashboard` | Aggregated dashboard metrics (see §18 for auth hardening) |
| `GET/POST /api/jaba/batches` | List / create batches |
| `GET/PATCH/DELETE /api/jaba/batches/[id]` | Single batch |
| `POST /api/jaba/batches/[id]/infuse` | Infusion / child flavour line |
| `PATCH/DELETE /api/jaba/batches/flavour-output/[id]` | Flavour line output updates |
| `GET/POST/PATCH/DELETE /api/jaba/packaging-output` | Packaging output |
| `GET /api/jaba/packaging-material-stock` | Packaging consumables stock |
| `GET/POST/PATCH/DELETE /api/jaba/raw-materials` | Raw materials CRUD |
| `GET /api/jaba/raw-materials/usage-logs` | Usage audit from movements |
| `GET /api/jaba/raw-materials/flow` | **Material flow ledger** (direction, filters, pagination) |
| `GET/POST/PATCH/DELETE /api/jaba/delivery-notes` | Delivery notes |
| `GET/POST /api/jaba/delivery-notes/next-id` | Next delivery note id |
| `GET /api/jaba/stock-movements` | Stock movements |
| `GET /api/jaba/finished-goods` | Finished goods snapshot |
| `GET/POST/PATCH/DELETE /api/jaba/suppliers` | Suppliers |
| `GET /api/jaba/supplier-history` | Supplier history |
| `GET /api/jaba/supplier-history/export` | Export supplier history |
| `GET/POST/PATCH/DELETE /api/jaba/distributors` | Distributors |
| `GET /api/jaba/distributor-history` | Distributor history |
| `GET /api/jaba/distributor-history/export` | Export |
| `GET/POST /api/jaba/distributor-requests` | Distributor requests |
| `GET/PATCH/DELETE /api/jaba/distributor-requests/[id]` | Single request |
| `GET /api/jaba/distribution-reports` | Distribution analytics |
| `GET /api/jaba/production-reports` | Production analytics |
| `GET /api/jaba/production-reports/export/excel` | Excel export |
| `GET /api/jaba/production-reports/export/pdf` | PDF export |
| `GET /api/jaba/batch-reports` | Batch report data |
| `GET /api/jaba/material-reports` | Material report data |
| `GET/POST/PATCH/DELETE /api/jaba/flavors` | Flavours |
| `GET/POST/PATCH/DELETE /api/jaba/categories` | Categories |
| `GET/POST /api/jaba/users` | User list / create |
| `GET/PATCH/DELETE /api/jaba/users/[id]` | User detail |
| `PATCH /api/jaba/users/[id]/role` | Role |
| `PATCH /api/jaba/users/[id]/status` | Active/inactive |
| `PATCH /api/jaba/users/[id]/permissions` | Permissions |
| `POST /api/jaba/users/make-superadmin` | Elevate super admin |
| `GET /api/jaba/user/permissions` | Current user permission payload |
| `GET/POST/PATCH /api/jaba/sms-notifications` | SMS |
| `POST /api/jaba/delete-otp` | OTP helper for guarded deletes |

---

## 12. MongoDB (`infusion_jaba`)

| Collection | Typical use |
|------------|-------------|
| `jaba_batches` | Batches + child flavour / infusion lines |
| `jaba_packagingOutput` | Packaging runs |
| `jaba_deliveryNotes` | Delivery notes and line items |
| `jaba_rawMaterials` | Material master + quantities |
| `jaba_inventory_movements` | Inventory audit trail |
| `jaba_suppliers` / `jaba_distributors` | Partners |
| `jaba_supplierHistory` / `jaba_distributorHistory` | Partner transaction history |
| `jaba_flavors` | Flavour reference |
| `jaba_categories` | Categories |

Users live in the **shared users collection** (see `lib/models/user`), not necessarily `jaba_*` prefixed.

---

## 13. Important shared libraries

| Module | Role |
|--------|------|
| `lib/jaba-permissions.ts` | RBAC keys, route map, `canView` / `canAction`, page id mapping |
| `lib/api-jaba-permissions.ts` | `requireJabaAction` for APIs |
| `lib/auth-jaba.ts` | NextAuth Jaba instance |
| `lib/jaba-batch-utils.ts` | Batch display / flavour normalization |
| `lib/jaba-flavour-lines.ts` | Flavour line merging |
| `lib/jaba-sms.ts` | SMS hooks |

---

## 14. Environment variables

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET_JABA` | JWT secret for Jaba (required in production) |
| `NEXTAUTH_SECRET` | Dev fallback if `AUTH_SECRET_JABA` unset |
| `NEXTAUTH_URL` | Canonical site URL (trailing slash stripped in auth config) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `MONGODB_URI` (or project convention) | MongoDB connection |
| `ALLOW_OFFLINE_DEV` | Dev-only middleware bypass for `/jaba` UI |

---

## 15. End-to-end product flow

1. **Raw materials** recorded in `jaba_rawMaterials`.
2. **Batch** created → may consume ingredients → movements in `jaba_inventory_movements`.
3. **Infusion / flavour lines** may split a parent batch.
4. **QC** updates status via checklist / results.
5. **Packaging output** records units by bottle size (e.g. 250ml–2L).
6. **Delivery notes** ship stock; **delivered** notes affect finished-goods / dashboard logic.
7. **Reports** aggregate the same data for exports and charts.

---

## 16. Operator walkthrough: batch → package → distribute

You need the right permissions (`production.addBatch`, `production.createSession`, `distribution.create`). Detailed steps are unchanged from the implementation in:

- **`app/jaba/batches/add/page.tsx`** — batch number via `GET /api/jaba/batches?nextNumber=true`, `POST /api/jaba/batches`.
- **`app/jaba/packaging-output/add/page.tsx`** — `GET /api/jaba/batches`, `GET /api/jaba/batches/[id]`, packaging stock `GET /api/jaba/packaging-material-stock`, `POST /api/jaba/packaging-output`.
- **`app/jaba/distribution/create/page.tsx`** — `GET /api/jaba/delivery-notes/next-id`, distributors, batches, packaging, existing notes, `POST /api/jaba/delivery-notes` (or `PUT` when editing with `?edit=`).

After delivery, update status on **`/jaba/distribution`** so finished-goods views stay consistent.

---

## 17. Building an AI / intelligent business analysis page

This section is for a **new** feature (e.g. **`/jaba/insights`**, **`/jaba/ai-analyst`**, or an embedded panel) that answers natural-language questions (“Why did throughput drop last week?”, “Summarize low-stock risk”, “Compare distributors by volume”) using your existing data.

### 17.1 What to reuse (no new business logic required)

| Data need | Prefer |
|-----------|--------|
| Live plant snapshot | `GET /api/jaba/dashboard` |
| Deep production KPIs | `GET /api/jaba/production-reports` (+ export routes for attachments) |
| Batch quality / throughput | `GET /api/jaba/batch-reports` |
| Materials | `GET /api/jaba/material-reports`, `GET /api/jaba/raw-materials/flow`, `GET /api/jaba/raw-materials/usage-logs` |
| Sales / dispatch side | `GET /api/jaba/distribution-reports`, `GET /api/jaba/delivery-notes` (with care for payload size) |
| Stock position | `GET /api/jaba/finished-goods`, `GET /api/jaba/stock-movements` |
| Partners | `GET /api/jaba/supplier-history`, `GET /api/jaba/distributor-history` |

You can **compose** these in a **server route** (e.g. `app/api/jaba/ai-context/route.ts`) that:

1. Calls `requireJabaAction` with a key such as `reports.production` or `system.dashboard` (or add a dedicated `reports.ai` key in `jaba-permissions.ts` if you want strict separation).
2. Fetches normalized subsets (not full Mongo dumps) in parallel.
3. Returns one JSON “context package” for the LLM **or** streams a short summary.

### 17.2 Suggested architecture

1. **UI page** (client): chat or “Ask the plant” bar; shows citations (which report/API the answer used).
2. **Aggregation API** (server): builds `context` from the table above; redacts PII if needed.
3. **LLM call** (server only): send `context` + user question to your provider; never expose API keys to the browser.
4. **Optional:** cache dashboard + report responses for 1–5 minutes to reduce cost.

### 17.3 Permissions

- Reuse **`reports.*`** or **`system.dashboard`** for read-only analysis, or introduce **`reports.ai`** / **`system.aiInsights`** and add it to `ROUTE_PERMISSION_MAP`, `PAGE_ID_TO_ROUTE`, and user admin matrices.

### 17.4 Security checklist

- **Session required** on any new API; align **`/api/jaba/dashboard`** with the same guard if you expose sensitive aggregates publicly today (see §18).
- **Rate-limit** the LLM endpoint.
- **Do not** send raw secrets or full user tables to the model.

### 17.5 Product ideas

- **Daily digest** email/SMS from the same context builder (uses `lib/jaba-sms.ts` patterns).
- **Anomaly hints** (rule-based first): e.g. low stock count from dashboard + material flow spikes.
- **Compare periods** using production report date filters already supported by `production-reports`.

---

## 18. Known gaps and security notes

- **`/jaba/reports`** root is a **placeholder**; real reports live under **`/jaba/reports/*`**. Sidebar “Reports” points to **`/jaba/reports/batches`**.
- **`distribution.dispatch`** permission exists; **no** `dispatch/page.tsx` in the repo — dispatch UX may live inside **`/jaba/distribution`** or is planned.
- **`GET /api/jaba/dashboard`** — confirm whether it should require the same session + `requireJabaAction('system.dashboard', 'view')` as other Jaba APIs; **harden before production** if currently open.

---

*Maintainers: update this file when adding routes, APIs, or permission keys. The route map is derived from `lib/jaba-permissions.ts` and `app/jaba/layout.tsx`.*
