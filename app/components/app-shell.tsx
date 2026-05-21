"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calendar,
  LogOut,
  Menu,
  Settings,
  User,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { AiChat } from "./ai-chat";
import { useAppData } from "../hooks/use-app-data";

const mainNav = [
  { href: "/dashboard", label: "dashboard", icon: BarChart3 },
  { href: "/moliya", label: "finance", icon: Wallet },
  { href: "/rejalar", label: "plans", icon: Calendar },
  { href: "/xatolarim", label: "mistakes", icon: AlertTriangle },
  { href: "/xulosalar", label: "summary", icon: BookOpen },
];

const accountNav = [
  { href: "/profil", label: "profile", icon: User },
  { href: "/sozlamalar", label: "settings", icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  const reduceMotion = useReducedMotion();
  const t = useTranslations("sidebar");

  return (
    <Link
      href={href}
      prefetch
      className={`group relative flex transform-gpu items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-3.5 text-[15px] transition-[background-color,box-shadow,color,transform] duration-500 will-change-transform hover:translate-x-0.5 ${
        active
          ? "bg-[linear-gradient(135deg,rgba(139,92,246,.26),rgba(217,70,239,.10))] text-[var(--app-text)] ring-1 ring-violet-200/22 shadow-[0_16px_38px_rgba(109,40,217,.18),inset_0_1px_0_rgba(255,255,255,.08)]"
          : "text-[var(--app-muted)] hover:bg-white/[0.055] hover:text-[var(--app-text)]"
      }`}
    >
      {active ? (
        <span
          className="absolute inset-0 bg-[radial-gradient(circle_at_22%_50%,rgba(196,181,253,.20),transparent_42%)]"
        />
      ) : null}
      <span
        className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-2xl transition duration-500 ${
          active
            ? "bg-white/10 text-violet-100 shadow-[0_0_22px_rgba(167,139,250,.18),inset_0_1px_0_rgba(255,255,255,.08)]"
            : "bg-white/[0.03] text-slate-400 group-hover:text-[var(--app-text)]"
        }`}
      >
        <motion.span
          animate={active && !reduceMotion ? { opacity: [0.88, 1, 0.88] } : { opacity: 1 }}
          transition={{ duration: 3.4, repeat: active && !reduceMotion ? Infinity : 0, ease: "easeInOut" }}
          className="relative z-10 flex"
        >
          <Icon size={17} strokeWidth={2.2} />
        </motion.span>
      </span>
      <span className="relative z-10">{t(label)}</span>
    </Link>
  );
}

function MobileNavLink({
  href,
  label,
  icon: Icon,
  active,
  buttonRef,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  buttonRef: (node: HTMLAnchorElement | null) => void;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const t = useTranslations("sidebar");

  return (
    <Link
      href={href}
      prefetch
      data-mobile-nav-href={href}
      ref={buttonRef}
      onClick={(event) => onNavigate(event, href)}
      className={`relative z-10 flex min-h-12 min-w-0 flex-1 select-none flex-col items-center justify-center gap-1 overflow-hidden rounded-[20px] px-1.5 py-2 text-[10px] font-semibold outline-none transition duration-400 ease-out active:scale-95 ${
        active
          ? "-translate-y-px scale-[1.025] text-[var(--app-text)]"
          : "text-[var(--app-muted)] hover:bg-violet-500/8 hover:text-[var(--app-text)]"
      }`}
    >
      {active ? (
        <span className="pointer-events-none absolute inset-x-4 top-1 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      ) : null}
      <Icon
        size={18}
        strokeWidth={2.2}
        className={`relative z-10 shrink-0 transition duration-400 ${active ? "drop-shadow-[0_0_8px_rgba(168,85,247,.35)]" : ""}`}
      />
      <span className="relative z-10 max-w-full truncate">{t(label)}</span>
    </Link>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  const router = useRouter();
  const [previewHref, setPreviewHref] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const holdTimerRef = useRef<number | null>(null);
  const releaseTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const pillX = useMotionValue(0);
  const pillWidth = useMotionValue(0);
  const pillScale = useMotionValue(1);
  const pillSkew = useMotionValue(0);
  const springX = useSpring(pillX, { stiffness: 360, damping: 34, mass: 0.62 });
  const springWidth = useSpring(pillWidth, { stiffness: 380, damping: 36, mass: 0.58 });
  const springScale = useSpring(pillScale, { stiffness: 300, damping: 22, mass: 0.58 });
  const springSkew = useSpring(pillSkew, { stiffness: 260, damping: 24, mass: 0.55 });
  const highlightedHref = previewHref ?? pathname;

  useEffect(() => {
    for (const item of mainNav) {
      router.prefetch(item.href);
    }
  }, [router]);

  function setButtonRef(href: string) {
    return (node: HTMLAnchorElement | null) => {
      buttonRefs.current[href] = node;
    };
  }

  function navTargetFromPoint(clientX: number, clientY: number) {
    const target = document.elementFromPoint(clientX, clientY);
    return target?.closest("[data-mobile-nav-href]") as HTMLAnchorElement | null;
  }

  function movePillToTarget(target: HTMLAnchorElement | null, enlarged = false) {
    const navRect = navRef.current?.getBoundingClientRect();

    if (!target || !navRect) {
      return null;
    }

    const targetRect = target.getBoundingClientRect();
    const nextX = targetRect.left - navRect.left + 4;
    const nextWidth = Math.max(0, targetRect.width - 8);
    const previousX = pillX.get();
    const direction = nextX - previousX;

    pillX.set(nextX);
    pillWidth.set(nextWidth);
    pillScale.set(enlarged ? 1.1 : 1);
    pillSkew.set(enlarged ? Math.max(-3, Math.min(3, direction * 0.045)) : 0);

    if (enlarged) {
      window.setTimeout(() => pillSkew.set(0), 140);
    }

    return target.getAttribute("data-mobile-nav-href");
  }

  function movePillToHref(href: string, enlarged = false) {
    return movePillToTarget(buttonRefs.current[href] ?? null, enlarged);
  }

  useEffect(() => {
    function updateActivePill() {
      const target = buttonRefs.current[pathname];
      const navRect = navRef.current?.getBoundingClientRect();

      if (!target || !navRect) {
        return;
      }

      const targetRect = target.getBoundingClientRect();
      pillX.set(targetRect.left - navRect.left + 4);
      pillWidth.set(Math.max(0, targetRect.width - 8));
      pillScale.set(1);
      pillSkew.set(0);
    }

    updateActivePill();
    window.addEventListener("resize", updateActivePill);

    return () => window.removeEventListener("resize", updateActivePill);
  }, [pathname, pillScale, pillSkew, pillWidth, pillX]);

  function navigate(href: string) {
    if (href !== pathname) {
      router.push(href);
    }
  }

  function handleClickNavigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (suppressClickRef.current) {
      event.preventDefault();
      return;
    }

    if (href === pathname) {
      event.preventDefault();
      setPreviewHref(null);
      return;
    }

    setPreviewHref(href);
    window.setTimeout(() => setPreviewHref(null), 900);
  }

  function clearHoldTimer() {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch") {
      return;
    }

    clearHoldTimer();
    if (releaseTimerRef.current) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }

    suppressClickRef.current = false;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    const startX = event.clientX;
    const startY = event.clientY;
    const target = navTargetFromPoint(startX, startY) ?? buttonRefs.current[pathname];
    const href = target?.getAttribute("data-mobile-nav-href") ?? pathname;

    holdTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      setHolding(true);
      setPreviewHref(href);
      movePillToTarget(target, true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }, 180);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch") {
      return;
    }

    if (!holding) {
      const deltaX = Math.abs(event.clientX - pointerStartRef.current.x);
      const deltaY = Math.abs(event.clientY - pointerStartRef.current.y);

      if (deltaX > 10 || deltaY > 10) {
        clearHoldTimer();
      }
      return;
    }

    const target = navTargetFromPoint(event.clientX, event.clientY);
    const href = movePillToTarget(target, true);

    if (href) {
      setPreviewHref(href);
    }
  }

  function handlePointerEnd(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch") {
      return;
    }

    clearHoldTimer();

    if (!holding) {
      return;
    }

    const target = navTargetFromPoint(event.clientX, event.clientY);
    const nextHref = movePillToTarget(target, false) ?? previewHref ?? pathname;
    setHolding(false);

    releaseTimerRef.current = window.setTimeout(() => {
      navigate(nextHref);
      setPreviewHref(null);
      suppressClickRef.current = false;
    }, 170);
  }

  function handlePointerCancel(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch") {
      return;
    }

    clearHoldTimer();
    setHolding(false);
    setPreviewHref(null);
    movePillToHref(pathname, false);
    suppressClickRef.current = false;
  }

  return (
    <motion.nav
      ref={navRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerCancel}
      initial={false}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24, mass: 0.72 }}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-3 right-3 z-40 grid grid-cols-5 gap-1.5 overflow-visible rounded-[28px] border border-violet-100/16 bg-[image:var(--app-mobile-dock-bg)] p-2 shadow-[var(--app-mobile-dock-shadow)] backdrop-blur-2xl transition duration-400 lg:hidden"
    >
      <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(circle_at_50%_100%,rgba(168,85,247,.10),transparent_68%)]" />
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ opacity: 1 }}
        style={{ x: springX, width: springWidth, scale: springScale, skewX: springSkew }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute inset-y-2 z-0 origin-center rounded-[18px] border border-violet-200/18 bg-[linear-gradient(145deg,rgba(255,255,255,.18),rgba(168,85,247,.13)_48%,rgba(76,29,149,.10))] shadow-[0_0_24px_rgba(168,85,247,.14),inset_0_1px_0_rgba(255,255,255,.22),inset_0_-1px_0_rgba(76,29,149,.10)] backdrop-blur-xl"
      />
      {mainNav.map((item) => (
        <MobileNavLink
          key={item.href}
          {...item}
          active={highlightedHref === item.href}
          buttonRef={setButtonRef(item.href)}
          onNavigate={handleClickNavigate}
        />
      ))}
    </motion.nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const t = useTranslations("sidebar");
  const { data } = useAppData();
  const profile = data.profile_data;
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    for (const item of [...mainNav, ...accountNav]) {
      router.prefetch(item.href);
    }
  }, [router]);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[auth/logout] signOut failed", error);
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--app-bg)] text-[var(--app-text)] transition-colors duration-300">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0 bg-[image:var(--app-aura)]"
          animate={reduceMotion ? undefined : { opacity: [0.88, 1, 0.88] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/2 top-[-340px] h-[720px] w-[720px] -translate-x-1/2 transform-gpu rounded-full bg-violet-500/14 blur-[150px] will-change-[opacity]"
          animate={reduceMotion ? undefined : { opacity: [0.72, 0.9, 0.72] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-250px] right-[-160px] h-[520px] w-[520px] transform-gpu rounded-full bg-fuchsia-500/8 blur-[130px] will-change-[opacity]"
          animate={reduceMotion ? undefined : { opacity: [0.62, 0.78, 0.62] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 min-h-screen min-w-0">
        <header className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-40 isolate flex items-center justify-between overflow-hidden rounded-[24px] border border-violet-200/14 bg-[image:var(--app-header-bg)] p-2.5 shadow-[0_18px_54px_rgba(10,10,30,.24),0_0_28px_rgba(139,92,246,.10),inset_0_1px_0_rgba(255,255,255,.13)] backdrop-blur-2xl lg:hidden">
          <span className="pointer-events-none absolute inset-px rounded-[23px] bg-[radial-gradient(circle_at_18%_0%,rgba(216,180,254,.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,.075),transparent_48%)]" />
          <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
          <span className="pointer-events-none absolute -right-14 -top-16 h-36 w-36 rounded-full bg-violet-400/12 blur-3xl" />
          <Link href="/dashboard" prefetch className="relative z-10 flex min-w-0 items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Private"
              width={42}
              height={42}
              className="shrink-0 rounded-2xl object-contain shadow-[0_0_18px_rgba(139,92,246,.18)]"
              priority
            />
            <div className="min-w-0">
              <p className="truncate bg-gradient-to-r from-[var(--app-text)] to-violet-500 bg-clip-text text-base font-bold text-transparent">Private</p>
              <p className="truncate text-[9px] uppercase tracking-[0.22em] text-violet-300/70">{t("brandSubtitle")}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="relative z-10 flex h-11 w-11 shrink-0 transform-gpu items-center justify-center rounded-2xl border border-violet-300/14 bg-violet-500/10 text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition duration-400 hover:border-violet-300/24 hover:bg-violet-500/15 active:scale-95 active:opacity-90"
            aria-label={t("settings")}
          >
            <Menu size={19} />
          </button>
        </header>
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-30 h-[calc(env(safe-area-inset-top)+7.5rem)] bg-[linear-gradient(180deg,var(--app-bg)_0%,rgba(139,92,246,.055)_52%,transparent_100%)] [mask-image:linear-gradient(to_bottom,black_0%,black_58%,transparent_100%)] backdrop-blur-[1.5px] lg:hidden" />

        <aside className="fixed bottom-4 left-4 top-4 z-30 hidden w-[286px] overflow-hidden rounded-[34px] border border-violet-200/12 bg-[image:var(--app-sidebar-bg)] px-4 py-5 shadow-[var(--app-sidebar-shadow)] backdrop-blur-2xl lg:block">
          <span className="pointer-events-none absolute inset-px rounded-[33px] bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,.045),transparent_22%)]" />
          <Link href="/dashboard" prefetch className="relative z-10 mb-8 flex items-center gap-3 rounded-[24px] border border-violet-200/12 bg-white/[0.045] p-3 shadow-[0_18px_42px_rgba(0,0,0,.22),inset_0_1px_0_rgba(255,255,255,.06)]">
            <div className="relative">
              <div className="absolute inset-1 rounded-[22px] bg-violet-500/24 blur-lg" />
              <Image
                src="/logo.png"
                alt="Private"
                width={64}
                height={64}
                className="relative rounded-[20px] object-contain shadow-[0_0_22px_rgba(139,92,246,.24)]"
                priority
              />
            </div>
            <div>
              <p className="bg-gradient-to-r from-[var(--app-text)] to-violet-500 bg-clip-text text-xl font-bold text-transparent">Private</p>
              <p className="text-[10px] uppercase tracking-[0.28em] text-violet-300/70">{t("brandSubtitle")}</p>
            </div>
          </Link>

          <nav className="relative z-10 space-y-2">
            {mainNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>

          <div className="absolute bottom-5 left-4 right-4 z-10 border-t border-violet-300/10 pt-4">
            <div className="space-y-2">
              {accountNav.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}

              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full transform-gpu items-center gap-3 rounded-2xl px-3 py-3 text-sm text-red-300 transition duration-500 hover:bg-red-500/10 hover:text-red-200"
              >
                <LogOut size={18} />
                <span>{t("logout")}</span>
              </button>
            </div>

            <div className="mt-4 rounded-[22px] border border-violet-300/12 bg-gradient-to-br from-white/[0.06] to-violet-500/[0.035] p-3 shadow-[0_18px_42px_rgba(0,0,0,.22),inset_0_1px_0_rgba(255,255,255,.06)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-300/20 bg-[radial-gradient(circle_at_35%_20%,rgba(217,70,239,.32),rgba(124,58,237,.22)_45%,rgba(5,8,22,.92))] font-bold shadow-[0_0_18px_rgba(139,92,246,.18)]">
                  {profile.shortName[0] || profile.name[0] || "P"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{profile.name}</p>
                  <p className="truncate text-xs text-slate-500">{t("premiumUser")}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className={`fixed inset-0 z-50 lg:hidden ${accountOpen ? "" : "pointer-events-none"}`}>
          <button
            type="button"
            aria-label={t("closeAccountMenu")}
            onClick={() => setAccountOpen(false)}
            className={`absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-400 ${accountOpen ? "opacity-100" : "opacity-0"}`}
          />
          <div
            className={`absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] w-[min(360px,calc(100vw-1.5rem))] transform-gpu overflow-hidden rounded-[28px] border border-violet-200/14 bg-[image:var(--app-sidebar-bg)] p-4 shadow-[0_30px_110px_rgba(0,0,0,.34),0_0_46px_rgba(139,92,246,.12)] backdrop-blur-2xl transition duration-400 ease-out ${
              accountOpen ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
            }`}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{profile.name}</p>
                <p className="truncate text-xs text-[var(--app-muted)]">{t("premiumUser")}</p>
              </div>
              <button
                type="button"
                onClick={() => setAccountOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-300/12 bg-white/[0.045] text-[var(--app-muted)] transition duration-400 hover:text-[var(--app-text)]"
                aria-label={t("closeAccountMenu")}
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              {accountNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onClick={() => setAccountOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm transition duration-400 ${
                    pathname === item.href
                      ? "bg-violet-500/14 text-[var(--app-text)] shadow-[0_0_24px_rgba(168,85,247,.14)]"
                      : "text-[var(--app-muted)] hover:bg-white/[0.055] hover:text-[var(--app-text)]"
                  }`}
                >
                  <item.icon size={18} />
                  <span>{t(item.label)}</span>
                </Link>
              ))}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm text-red-300 transition duration-400 hover:bg-red-500/10 hover:text-red-200"
              >
                <LogOut size={18} />
                <span>{t("logout")}</span>
              </button>
            </div>
          </div>
        </div>

        <MobileBottomNav pathname={pathname} />
        <AiChat />

        <main className="min-h-screen w-full min-w-0 overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+8.5rem)] pt-[calc(env(safe-area-inset-top)+6rem)] sm:px-6 lg:py-8 lg:pl-[326px] lg:pr-8">
          <div className="mx-auto w-full max-w-[1440px] min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
