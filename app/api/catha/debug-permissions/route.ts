/**
 * Debug endpoint to pinpoint permission issues.
 * Returns the 3 things needed to debug: pathname, DB routePermissions, and the check logic.
 *
 * Usage (as super_admin, logged into Catha):
 *   GET /api/catha/debug-permissions?email=derrickmuteti2001@gmail.com&pathname=/catha/pos
 *
 * Or with pathname only (uses your session email):
 *   GET /api/catha/debug-permissions?pathname=/catha/pos
 */
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { getBarUserByEmail } from "@/lib/models/bar-user"
import { PERMISSION_PAGE_ROUTES } from "@/lib/permissions"

function hasRoutePermission(pathname: string, routePermissions: string[] | undefined): boolean {
  if (!routePermissions || routePermissions.length === 0) return false
  return routePermissions.some((route) => pathname === route || pathname.startsWith(route + "/"))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pathname = searchParams.get("pathname") || "/catha"
    const emailParam = searchParams.get("email")

    // Get token (Catha)
    const isProduction = process.env.NODE_ENV === "production"
    const secret = process.env.AUTH_SECRET_CATHA || (!isProduction ? process.env.NEXTAUTH_SECRET : undefined)
    const cookieName = isProduction ? "__Secure-catha.session-token" : "catha.session-token"

    const token = await getToken({
      req: request as any,
      secret,
      cookieName,
    })

    const sessionEmail = (token as any)?.email
    const sessionRole = (token as any)?.role

    // Only super_admin can use this debug endpoint
    if (sessionRole !== "super_admin") {
      return NextResponse.json(
        { error: "Only super_admin can access this debug endpoint" },
        { status: 403 }
      )
    }

    const email = emailParam || sessionEmail
    if (!email) {
      return NextResponse.json(
        { error: "Provide ?email=user@example.com or be logged in as super_admin" },
        { status: 400 }
      )
    }

    const barUser = await getBarUserByEmail(email)
    if (!barUser) {
      return NextResponse.json(
        { error: `User not found for email: ${email}` },
        { status: 404 }
      )
    }

    const routePermissions = barUser.routePermissions ?? []
    const passes = hasRoutePermission(pathname, routePermissions)

    return NextResponse.json({
      // 1. The exact page URL you're blocked from
      pathname,
      // 2. The permission entry for this user in DB
      routePermissions,
      permissions: barUser.permissions ?? [],
      role: barUser.role,
      approved: barUser.approved,
      // 3. The check result
      hasRoutePermission: passes,
      // 4. The check logic (for reference)
      checkLogic: {
        code: `hasRoutePermission(pathname, routePermissions)`,
        implementation: `routePermissions.some(route => pathname === route || pathname.startsWith(route + '/'))`,
        pathnameChecked: pathname,
        routePermissionsLength: routePermissions.length,
        matches: routePermissions.filter((r) => pathname === r || pathname.startsWith(r + "/")),
      },
      // 5. All Catha routes for reference
      allCathaRoutes: Object.values(PERMISSION_PAGE_ROUTES),
    })
  } catch (err: any) {
    console.error("[Catha Debug Permissions]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

