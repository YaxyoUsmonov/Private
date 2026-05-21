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

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path === "/auth/callback") {
    return NextResponse.next();
  }

  const isProtected = isRouteMatch(path, protectedRoutes);
  const isPublic = publicRoutes.includes(path as (typeof publicRoutes)[number]);

  if (!isProtected && !isPublic) {
    return NextResponse.next();
  }

  const supabaseConfig = getSupabaseConfig();

  if (!supabaseConfig) {
    console.error("[auth/proxy] Supabase env vars are missing");

    if (isProtected) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
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
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user) && !error;

  if (error) {
    console.error("[auth/proxy] getUser failed", {
      path,
      message: error.message,
    });
  }

  if (isProtected && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublic && isAuthenticated) {
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
