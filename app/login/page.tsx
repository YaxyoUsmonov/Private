"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Globe, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  if (appUrl) {
    return appUrl;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production");
  }

  return "http://localhost:3000";
}

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<"google" | "email" | "signup" | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("[auth/login] getSession failed", error);
      }

      if (session) {
        router.replace("/dashboard");
      }
    }

    checkUser();
  }, [router]);

  async function signInWithGoogle() {
    if (loadingAction) {
      return;
    }

    setLoadingAction("google");
    setErrorMessage(null);
    setSuccessMessage(null);

    window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        setLoadingAction(null);
      }
    }, 8000);

    try {
      const redirectTo = `${getAppUrl()}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        console.error("[auth/login] signInWithOAuth failed", error);
        setErrorMessage(error.message);
        setLoadingAction(null);
      }
    } catch (error) {
      console.error("[auth/login] signInWithOAuth crashed", error);
      setErrorMessage(error instanceof Error ? error.message : "Google login failed");
      setLoadingAction(null);
    }
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loadingAction) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      setErrorMessage(t("missingCredentials"));
      return;
    }

    setLoadingAction(authMode === "login" ? "email" : "signup");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error("[auth/login] signInWithPassword failed", error);
          setErrorMessage(error.message);
          return;
        }

        router.replace("/dashboard");
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getAppUrl()}/login`,
        },
      });

      if (error) {
        console.error("[auth/login] signUp failed", error);
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(t("signupSuccess"));
    } catch (error) {
      console.error("[auth/login] email auth crashed", error);
      setErrorMessage(error instanceof Error ? error.message : t("emailAuthFailed"));
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--app-bg)] px-4 text-[var(--app-text)]">
      <div className="pointer-events-none absolute left-1/2 top-[-280px] h-[640px] w-[640px] -translate-x-1/2 transform-gpu rounded-full bg-violet-500/14 blur-[140px] will-change-[opacity]" />
      <section className="relative z-10 w-full max-w-[430px] overflow-hidden rounded-lg border border-violet-300/14 bg-[image:var(--app-modal-bg)] p-7 shadow-[0_28px_90px_rgba(0,0,0,0.20),0_0_34px_rgba(139,92,246,.08)] backdrop-blur">
        <span className="pointer-events-none absolute inset-px rounded-lg bg-[linear-gradient(180deg,rgba(255,255,255,.05),transparent_42%),radial-gradient(circle_at_50%_0%,rgba(168,85,247,.12),transparent_44%)]" />
        <div className="relative z-10 mb-8 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="Private" width={92} height={92} priority className="rounded-lg object-contain shadow-[0_0_24px_rgba(139,92,246,.24)]" />
          <h1 className="mt-5 bg-gradient-to-r from-white via-violet-100 to-violet-300 bg-clip-text text-3xl font-bold text-transparent">Private</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {t("description")}
          </p>
        </div>

        {errorMessage ? (
          <div className="relative z-10 mb-4 rounded-lg border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="relative z-10 mb-4 rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        <form onSubmit={handleEmailAuth} className="relative z-10 space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-violet-300/14 bg-white/[0.035] p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`min-h-11 rounded-md px-3 text-sm font-semibold transition duration-300 ${
                authMode === "login" ? "bg-violet-500/25 text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,.10)]" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t("emailLogin")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`min-h-11 rounded-md px-3 text-sm font-semibold transition duration-300 ${
                authMode === "signup" ? "bg-violet-500/25 text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,.10)]" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t("signup")}
            </button>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-violet-300/80">
              {t("email")}
            </label>
            <input
              name="email"
              type="email"
              autoComplete="email"
              className="min-h-12 w-full rounded-lg border border-violet-300/14 bg-[var(--app-field-bg)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition duration-300 placeholder:text-slate-500 focus:border-violet-200/40 focus:ring-2 focus:ring-violet-500/20"
              placeholder={t("emailPlaceholder")}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-violet-300/80">
              {t("password")}
            </label>
            <input
              name="password"
              type="password"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              minLength={6}
              className="min-h-12 w-full rounded-lg border border-violet-300/14 bg-[var(--app-field-bg)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition duration-300 placeholder:text-slate-500 focus:border-violet-200/40 focus:ring-2 focus:ring-violet-500/20"
              placeholder={t("passwordPlaceholder")}
              required
            />
          </div>

          <button
            type="submit"
            disabled={Boolean(loadingAction)}
            className="flex min-h-13 w-full touch-manipulation transform-gpu items-center justify-center gap-3 rounded-lg border border-violet-300/16 bg-white/[0.055] px-6 py-3.5 font-semibold text-violet-100 shadow-[0_14px_34px_rgba(0,0,0,.16),inset_0_1px_0_rgba(255,255,255,.08)] transition duration-500 hover:border-violet-300/24 hover:bg-violet-500/12 disabled:cursor-wait disabled:opacity-75"
          >
            {loadingAction === "email" || loadingAction === "signup" ? <Loader2 size={18} className="animate-spin" /> : null}
            {authMode === "login" ? t("emailLoginButton") : t("signupButton")}
          </button>
        </form>

        <div className="relative z-10 my-5 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
          <span className="h-px flex-1 bg-violet-300/12" />
          {t("or")}
          <span className="h-px flex-1 bg-violet-300/12" />
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={Boolean(loadingAction)}
          className="relative z-20 flex min-h-14 w-full touch-manipulation transform-gpu items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-4 font-semibold !text-white shadow-[0_16px_40px_rgba(139,92,246,.24)] transition duration-500 hover:scale-[1.01] hover:from-violet-400 hover:to-fuchsia-400 disabled:cursor-wait disabled:opacity-80"
        >
          {loadingAction === "google" ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Globe size={18} />
          )}

          {t("google")}
        </button>
      </section>
    </main>
  );
}
