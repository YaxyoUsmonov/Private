import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const redirectUrl = new URL(next, requestUrl.origin);
  const response = NextResponse.redirect(redirectUrl);
  const searchParams = Object.fromEntries(requestUrl.searchParams.entries());

  if (error) {
    console.error("[auth/callback] provider returned error", {
      error,
      errorDescription,
      searchParams,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription ?? error)}`, requestUrl.origin),
    );
  }

  if (!code) {
    console.error("[auth/callback] missing code in callback URL", {
      searchParams,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    return NextResponse.redirect(new URL("/login?error=missing_code", requestUrl.origin));
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin),
    );
  }

  return response;
}
