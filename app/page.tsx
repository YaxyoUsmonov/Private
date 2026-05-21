"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("[auth/home] getSession failed", error);
      }
      router.replace(session ? "/dashboard" : "/login");
    }

    checkUser();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050816] text-sm text-slate-400">
      Yuklanmoqda...
    </div>
  );
}
