# Catha Access Control & Permissions

## Database: separate from Jaba

Catha users (admins, super admins, pending) are stored **only** in the **`bar_users`** collection (database: `infusion_jaba`). They are **fully separate** from Jaba: no user record is shared. Sign-in at `/catha/login` uses the `auth_context=bar` cookie and only reads/writes `bar_users`. Jaba uses the `jaba_users` collection only.

---

## Permission keys (page keys)

Used for route and API checks under `/catha`:

| Page key | Label | Route |
|----------|--------|--------|
| `dashboard` | Dashboard | /catha |
| `pos` | POS Sales | /catha/pos |
| `orders` | Orders | /catha/orders |
| `tables` | Tables | /catha/tables |
| `qr-tables` | Table QR Codes | /catha/qr-tables |
| `inventory` | Inventory | /catha/inventory |
| `suppliers` | Suppliers | /catha/suppliers |
| `stock-movement` | Stock Movement | /catha/stock-movement |
| `mpesa-transactions` | M-Pesa Transactions | /catha/mpesa-transactions |
| `expenses` | Expenses | /catha/expenses |
| `clients` | Clients | /catha/clients |
| `users` | User Management | /catha/users |
| `distributor-requests` | Distributor Requests | /catha/distributor-requests |
| `reports` | Reports | /catha/reports |
| `settings` | Settings | /catha/settings |

Each page permission has **actions**: `view`, `create`, `edit`, `delete`.

---

## Ensuring a super_admin exists

**Default super_admin email:** `infusionjaba@gmail.com` (used by the seed script if `SEED_SUPER_ADMIN_EMAIL` is not set).

**Option 1 – Seed script**

1. Set in `.env` (optional):
   - `SEED_SUPER_ADMIN_EMAIL` – Google email that will be super_admin (default: `infusionjaba@gmail.com`)
   - `SEED_SUPER_ADMIN_NAME` – Display name
2. Run (uses `tsx`; works on Windows and Unix):
   ```bash
   npm run seed-catha-super-admin
   ```
   Or: `npx tsx scripts/seed-catha-super-admin.ts`
   This will: update an existing user with that email to `role: super_admin`, or create a new super_admin document if none exists.
3. Sign in at **/catha/login** with that Google account. You will have access to **/catha/users** and can promote others.

**Option 2 – MongoDB**

1. Database: `infusion_jaba`, collection: `bar_users`
2. Insert a document (replace email/name with your Google account):

```json
{
  "name": "Super Admin",
  "email": "your-google@gmail.com",
  "role": "super_admin",
  "status": "active",
  "permissions": [],
  "createdAt": { "$date": "2025-02-25T00:00:00.000Z" }
}
```

3. Sign in at **/catha/login** with that Google account.

**Option 3 – First sign-up then promote**

1. Sign in at **/catha/login** with any Google account (you are created as `pending`).
2. In MongoDB, set that user’s `role` to `super_admin` in `bar_users` (match by `email`).
3. Sign out and sign in again; you can then open **/catha/users** (middleware allows only `super_admin`).

---

## Example admin permission document

An **admin** (non–super_admin) has a `permissions` array. Example for an admin with Orders + Inventory view/create/edit and Reports view-only:

```json
{
  "name": "Jane Manager",
  "email": "jane@example.com",
  "role": "admin",
  "status": "active",
  "permissions": [
    { "pageKey": "dashboard", "actions": { "view": true, "create": false, "edit": false, "delete": false } },
    { "pageKey": "orders", "actions": { "view": true, "create": true, "edit": true, "delete": false } },
    { "pageKey": "inventory", "actions": { "view": true, "create": true, "edit": true, "delete": false } },
    { "pageKey": "reports", "actions": { "view": true, "create": false, "edit": false, "delete": false } }
  ],
  "createdAt": { "$date": "2025-02-25T00:00:00.000Z" }
}
```

(Other page keys can be omitted or have all `false`; the app treats missing pages as no access.)

---

## Roles and rules

- **pending** – New sign-ups. Can only see `/catha/pending-approval`.
- **admin** – Can access `/catha/*` pages allowed by `permissions[].actions.view`; API checks `view`/`create`/`edit`/`delete` per page.
- **super_admin** – Full access; can open `/catha/users`, assign roles and permissions, disable accounts.

Only **super_admin** can access `/catha/users` and assign or change permissions.
