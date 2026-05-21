import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");
  const origin = request.nextUrl.origin;
  const successUrl = new URL("/dashboard", origin);
  const loginUrl = new URL("/login", origin);
  const response = NextResponse.redirect(successUrl);
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

  if (error) {
    console.error("[auth/callback] provider returned error", {
      error,
      errorDescription,
      searchParams,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    loginUrl.searchParams.set("error", errorDescription ?? error);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    console.error("[auth/callback] missing code in callback URL", {
      searchParams,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    loginUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(loginUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[auth/callback] Supabase env vars are missing", {
      hasUrl: Boolean(supabaseUrl),
      hasAnonKey: Boolean(supabaseAnonKey),
    });
    loginUrl.searchParams.set("error", "missing_supabase_config");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
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

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession failed", exchangeError);
    loginUrl.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
