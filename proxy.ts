import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { canAccessAdminPath, firstAllowedAdminPath, homePath, isStaffRole } from "@/lib/auth/permissions";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/logout",
  "/forgot-password",
  "/reset-password",
]);

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth")) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/sign-up") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Sign-out is its own action; skip the session DB round-trip so /logout
  // is not gated on getSession before the page can revoke the cookie.
  if (pathname === "/logout") {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });
  const role = session?.user?.role as string | undefined;
  const mustChangePassword = Boolean(
    (session?.user as { mustChangePassword?: boolean } | undefined)?.mustChangePassword,
  );

  if (isPublic(pathname) && pathname !== "/logout") {
    if (pathname === "/login" && role) {
      if (mustChangePassword) {
        return NextResponse.redirect(new URL("/change-password", request.url));
      }
      return NextResponse.redirect(new URL(homePath(role), request.url));
    }
    return NextResponse.next();
  }

  if (!session?.user) {
    if (pathname.startsWith("/admin") || pathname.startsWith("/employee") || pathname === "/change-password") {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  if (mustChangePassword && pathname !== "/change-password" && pathname !== "/logout") {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (!mustChangePassword && pathname === "/change-password") {
    return NextResponse.redirect(new URL(homePath(role), request.url));
  }

  if (role === "employee" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/employee", request.url));
  }

  if (isStaffRole(role) && pathname.startsWith("/admin") && !canAccessAdminPath(role, pathname)) {
    return NextResponse.redirect(new URL(firstAllowedAdminPath(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)",
  ],
};
