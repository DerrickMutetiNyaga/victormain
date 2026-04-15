# Debugging Permission / Access Denied Issues

When a user gets "Access Denied" or can't see nav items, use these 3 things to pinpoint the issue.

---

## 1. The exact page URL you're blocked from

**Where to find it:**
- Browser address bar when you see "Access Denied" → you're on `/catha/access-denied` or `/jaba/unauthorized`
- The URL you **tried to access** before being redirected (e.g. `/catha/pos`, `/catha/users`, `/catha/inventory`)

**Example:** `https://yoursite.com/catha/pos` → pathname = `/catha/pos`

---

## 2. The permission entry for this user in DB

**Catha (bar_users):**
```javascript
// MongoDB: infusion_jaba.bar_users
db.bar_users.findOne(
  { email: "derrickmuteti2001@gmail.com" },
  { routePermissions: 1, permissions: 1, role: 1, approved: 1 }
)
```

**Jaba (users):**
```javascript
// MongoDB: infusion_jaba.users (or your Jaba DB name)
db.users.findOne(
  { email: "user@example.com" },
  { routePermissions: 1, permissions: 1, role: 1, approved: 1 }
)
```

**Expected `routePermissions` for Catha cashier (example):**
```json
["/catha", "/catha/pos", "/catha/orders", "/catha/tables", "/catha/qr-tables"]
```

---

## 3. The check snippet (middleware)

**File:** `middleware.ts`

```typescript
// Helper: does pathname match any route in permissions?
function hasRoutePermission(pathname: string, routePermissions: string[] | undefined): boolean {
  if (!routePermissions || routePermissions.length === 0) return false
  return routePermissions.some(route => pathname === route || pathname.startsWith(route + '/'))
}

// For cashier_admin / manager_admin:
const routePermissions = (token as any)?.routePermissions as string[] | undefined

// Block if no permission:
if (!hasRoutePermission(pathname, routePermissions)) {
  return NextResponse.redirect(new URL("/catha/access-denied", request.url))
}
```

**Logic:** `pathname` must either:
- exactly match a route (e.g. `/catha` === `/catha`), or
- start with `route + '/'` (e.g. `/catha/pos` starts with `/catha/`)

---

## Quick debug API (super_admin only)

While logged in as **super_admin** to Catha:

```
GET /api/catha/debug-permissions?email=derrickmuteti2001@gmail.com&pathname=/catha/pos
```

Returns:
- `pathname` – the URL checked
- `routePermissions` – from DB
- `hasRoutePermission` – true/false
- `checkLogic.matches` – which routes matched (if any)

---

## Common fixes

| Symptom | Cause | Fix |
|--------|-------|-----|
| Access Denied on `/catha/pos` | `routePermissions` empty or missing `/catha/pos` | Add view permission for POS in User Management |
| No nav items in sidebar | `permissions` not in session, or `routePermissions` empty | Sign out + sign back in; ensure DB has `routePermissions` |
| Redirected to waiting | `routePermissions.length === 0` or `approved === false` | Assign permissions; ensure user is approved |
| Token has wrong permissions | Stale JWT | Sign out + sign back in to refresh token |

