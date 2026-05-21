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
];

const publicRoutes = ["/", "/login", "/auth/callback"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path === "/auth/callback") {
    return NextResponse.next();
  }

  const isProtected = protectedRoutes.some((route) => path === route || path.startsWith(`${route}/`));
  const isPublic = publicRoutes.includes(path);
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
    console.error("[auth/proxy] getUser failed", {
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)"],
};
