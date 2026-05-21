import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedRoutes = [
  "/dashboard",
  "/moliya",
  "/rejalar",
  "/xatolarim",
  "/xulosalar",
  "/profil",
  "/sozlamalar",
] as const;

const publicRoutes = ["/", "/login", "/auth/callback"] as const;

function isRouteMatch(path: string, routes: readonly string[]) {
  return routes.some((route) => path === route || path.startsWith(`${route}/`));
}

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path === "/auth/callback") {
    return NextResponse.next();
  }

  const isProtected = isRouteMatch(path, protectedRoutes);
  const isPublic = publicRoutes.includes(path as (typeof publicRoutes)[number]);

  if (!isProtected && !isPublic) {
    return NextResponse.next();
  }

  if (!hasSupabaseConfig()) {
    console.error("[auth/middleware] Supabase env vars are missing");

    if (isProtected) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user) && !error;

  if (error) {
    console.error("[auth/middleware] getUser failed", {
      path,
      message: error.message,
    });
  }

  if (isProtected && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublic && isAuthenticated && path !== "/auth/callback") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/moliya/:path*",
    "/rejalar/:path*",
    "/xatolarim/:path*",
    "/xulosalar/:path*",
    "/profil/:path*",
    "/sozlamalar/:path*",
  ],
};
