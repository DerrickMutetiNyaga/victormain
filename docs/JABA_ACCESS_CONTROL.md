# Jaba Access Control & Permissions

## Database: separate from Catha

Jaba users (admins, super admins, pending) are stored **only** in the **`jaba_users`** collection (database: `infusion_jaba`). They are **fully separate** from Catha: no user record is shared. Sign-in at `/jaba/login` or `/jaba/signup` sets `auth_context=jaba` and only reads/writes `jaba_users`. Catha uses the `bar_users` collection only.

---

## Roles

| Role          | Access |
|---------------|--------|
| `pending`     | Can only see `/jaba/waiting` (waiting for approval). |
| `admin`       | Can access Jaba pages according to `permissions` (view/add/edit/delete per page). |
| `super_admin` | Full access to all pages and **User Management** (`/jaba/users`). Can approve pending users and set admins’ page permissions. |
| `manager` / `user` | Treated as not approved; redirected to `/jaba/waiting` until role is changed to `admin` by a super_admin. |

## Routes

- **`/jaba/login`** – Sign in (Google).
- **`/jaba/signup`** – Sign up (creates user with role `pending`).
- **`/jaba/waiting`** – Shown to pending (and non-approved) users until a super_admin approves them.
- **`/jaba`** – Dashboard and app (admin/super_admin only; admin access is permission-based).
- **`/jaba/users`** – User Management (super_admin only). List users, set role (including `pending` → `admin`), and set per-page permissions for admins.

## Ensuring a super_admin exists (Jaba)

**Default super_admin email:** `infusionjaba@gmail.com`.

**Option 1 – Seed script**

1. Optional in `.env`:
   - `SEED_JABA_SUPER_ADMIN_EMAIL` – Google email for Jaba super_admin (default: `infusionjaba@gmail.com`)
   - `SEED_JABA_SUPER_ADMIN_NAME` – Display name  
   Or use `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_NAME` (shared with Catha seed).
2. Run:
   ```bash
   npm run seed-jaba-super-admin
   ```
   Or: `npx tsx scripts/seed-jaba-super-admin.ts`
3. Sign in at **/jaba/login** with that Google account. You get access to **/jaba/users** and can approve pending users and set admin permissions.

**Option 2 – MongoDB**

1. Database: `infusion_jaba`, collection: `jaba_users`
2. Insert (replace email/name with your Google account):

```json
{
  "name": "Super Admin",
  "email": "your-google@gmail.com",
  "provider": "google",
  "providerId": "",
  "role": "super_admin",
  "status": "active",
  "permissions": {},
  "createdAt": { "$date": "2025-02-25T00:00:00.000Z" }
}
```

3. Sign in at **/jaba/login**; `providerId` will be set on first sign-in.

**Option 3 – First sign-up then promote**

1. Sign in at **/jaba/login** with any Google account (you are created as `pending`).
2. In MongoDB, set that user’s `role` to `super_admin` in `jaba_users` (match by `email`).
3. Sign out and sign in again; you can then open **/jaba/users**.

## Permissions (admins)

Admins have a `permissions` object: per-page (e.g. `dashboard`, `batches`, `reports-batches`) they can have `view`, `add`, `edit`, `delete`. Super admins bypass permission checks and see every page plus User Management.

- Only **super_admin** can open **/jaba/users**, change roles, and edit permissions.
- Pending users appear in User Management; super_admin can set their role to **admin** (and set permissions) to approve them.

## User Management (`/jaba/users`)

- **Super Admin only** – User Management is visible in the sidebar and accessible only to `super_admin`.
- **Jaba users are separate from Catha** – No user record is shared. Jaba uses `jaba_users`; Catha uses `bar_users`.
- **Super Admin assigns permissions to Admins** – When approving a pending user or editing an existing admin:
  1. Choose a role template (Cashier Admin, Manager Admin, or Super Admin).
  2. Optionally customize permissions per page (view, add, edit, delete).
  3. Save – the admin will only see pages they have `view` permission for.

## Summary

- **Pending** – New sign-ups; only `/jaba/waiting`.
- **Admin** (cashier_admin / manager_admin) – Access to Jaba pages allowed by `permissions`; no access to `/jaba/users`.
- **Super admin** – Full access; can open `/jaba/users`, approve pending users, assign roles, and set admin permissions.
