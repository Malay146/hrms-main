import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/", "/login", "/sign-up", "/logout"]);

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth")) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname) && pathname !== "/logout") {
    if (pathname === "/login" || pathname === "/sign-up") {
      const session = await auth.api.getSession({ headers: request.headers });
      const role = session?.user?.role;
      if (role === "admin") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      if (role === "employee") {
        return NextResponse.redirect(new URL("/employee", request.url));
      }
    }
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });
  const role = session?.user?.role as string | undefined;

  if (!session?.user && (pathname.startsWith("/admin") || pathname.startsWith("/employee"))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (role === "admin" && pathname.startsWith("/employee")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (role === "employee" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/employee", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)",
  ],
};
