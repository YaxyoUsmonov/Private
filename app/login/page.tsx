"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Globe, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    if (loading) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    const origin = window.location.origin;
    const redirectTo = `${origin}/auth/callback`;

    window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        setLoading(false);
      }
    }, 8000);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        console.error("[auth/login] signInWithOAuth failed", error);
        setErrorMessage(error.message);
        setLoading(false);
      }
    } catch (error) {
      console.error("[auth/login] signInWithOAuth crashed", error);
      setErrorMessage(error instanceof Error ? error.message : "Google login failed");
      setLoading(false);
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

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="relative z-20 flex min-h-14 w-full touch-manipulation transform-gpu items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-4 font-semibold !text-white shadow-[0_16px_40px_rgba(139,92,246,.24)] transition duration-500 hover:scale-[1.01] hover:from-violet-400 hover:to-fuchsia-400 disabled:cursor-wait disabled:opacity-80"
        >
          {loading ? (
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
