"use client";

import { memo } from "react";
import { useState } from "react";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { PencilLine, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const toneStyles = {
  violet: {
    wrap: "from-violet-500/18 via-fuchsia-500/10 to-purple-400/5 text-violet-100 ring-violet-300/20 shadow-violet-500/10",
    glow: "bg-violet-400/24",
  },
  green: {
    wrap: "from-emerald-400/16 via-fuchsia-400/8 to-violet-500/5 text-emerald-100 ring-emerald-300/20 shadow-emerald-500/10",
    glow: "bg-emerald-400/22",
  },
  red: {
    wrap: "from-rose-400/18 via-fuchsia-500/8 to-violet-500/5 text-rose-100 ring-rose-300/20 shadow-rose-500/10",
    glow: "bg-rose-400/22",
  },
  blue: {
    wrap: "from-cyan-400/16 via-blue-400/10 to-violet-500/5 text-cyan-100 ring-cyan-300/20 shadow-cyan-500/10",
    glow: "bg-cyan-400/22",
  },
  amber: {
    wrap: "from-amber-300/18 via-orange-400/8 to-violet-500/5 text-amber-100 ring-amber-300/20 shadow-amber-500/10",
    glow: "bg-amber-300/22",
  },
};

const premiumEase = [0.16, 1, 0.3, 1] as const;

type CardVariant = "income" | "expense" | "balance" | "ai" | "warning" | "plan" | "mistake" | "reflection";

const cardVariants: Record<CardVariant, { rgb: string; rgb2: string }> = {
  income: { rgb: "16,185,129", rgb2: "34,211,238" },
  expense: { rgb: "244,63,94", rgb2: "220,38,38" },
  balance: { rgb: "171,85,247", rgb2: "99,102,241" },
  ai: { rgb: "168,85,247", rgb2: "59,130,246" },
  warning: { rgb: "245,158,11", rgb2: "249,115,22" },
  plan: { rgb: "34,211,238", rgb2: "59,130,246" },
  mistake: { rgb: "225,29,72", rgb2: "153,27,27" },
  reflection: { rgb: "139,92,246", rgb2: "99,102,241" },
};

const toneToVariant = {
  violet: "balance",
  green: "income",
  red: "expense",
  blue: "plan",
  amber: "warning",
} as const satisfies Record<keyof typeof toneStyles, CardVariant>;

export const IconBadge = memo(function IconBadge({
  icon: Icon,
  tone = "violet",
  size = "md",
}: {
  icon: LucideIcon;
  tone?: keyof typeof toneStyles;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: { box: "h-10 w-10 rounded-2xl", icon: 18 },
    md: { box: "h-12 w-12 rounded-[20px]", icon: 21 },
    lg: { box: "h-14 w-14 rounded-[24px]", icon: 24 },
  };
  const selected = toneStyles[tone];
  const selectedSize = sizes[size];

  return (
    <span
      className={`icon-surface relative inline-flex shrink-0 transform-gpu items-center justify-center overflow-hidden bg-gradient-to-br ring-1 shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_18px_38px_rgba(0,0,0,.22)] transition duration-400 will-change-transform ${selectedSize.box} ${selected.wrap}`}
    >
      <span className={`absolute -right-3 -top-3 h-9 w-9 rounded-full blur-xl ${selected.glow}`} />
      <span className="absolute inset-px rounded-[inherit] bg-[linear-gradient(145deg,rgba(255,255,255,.14),transparent_42%)]" />
      <Icon size={selectedSize.icon} strokeWidth={2.2} className="relative z-10" />
    </span>
  );
});

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative mb-6 min-w-0 overflow-hidden rounded-[24px] border border-violet-300/12 bg-[image:var(--app-header-bg)] p-5 text-[var(--app-text)] shadow-[0_26px_80px_rgba(0,0,0,.18),inset_0_1px_0_rgba(255,255,255,.10)] backdrop-blur-xl sm:mb-8 sm:rounded-[28px] sm:p-6 sm:flex sm:items-end sm:justify-between">
      <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-400/10 blur-3xl" />
      <span className="pointer-events-none absolute left-8 top-0 h-px w-1/2 bg-gradient-to-r from-violet-200/0 via-violet-200/30 to-violet-200/0" />
      <div className="relative z-10 min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-violet-300/80">{eyebrow}</p>
        <h1 className="break-words bg-gradient-to-r from-[var(--app-text)] via-violet-500 to-fuchsia-500 bg-clip-text text-[clamp(2rem,8vw,3rem)] font-bold leading-[1.05] tracking-tight text-transparent sm:text-5xl">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="relative z-10 mt-5 w-full sm:mt-0 sm:w-auto [&>a]:w-full [&>button]:w-full sm:[&>a]:w-auto sm:[&>button]:w-auto">{action}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
  alive = false,
  variant = "balance",
}: {
  children: React.ReactNode;
  className?: string;
  alive?: boolean;
  variant?: CardVariant;
}) {
  const reduceMotion = useReducedMotion();
  const selected = cardVariants[variant];
  const cardStyle = {
    "--card-accent-rgb": selected.rgb,
    "--card-accent-2-rgb": selected.rgb2,
  } as CSSProperties;

  return (
    <motion.section
      style={cardStyle}
      initial={false}
      whileHover={reduceMotion ? undefined : { y: -5, scale: 1.016 }}
      whileTap={reduceMotion ? undefined : { scale: 0.992, opacity: 0.96 }}
      transition={{ duration: 0.4, ease: premiumEase }}
      className={`semantic-card group/card relative min-w-0 touch-manipulation transform-gpu overflow-hidden rounded-[24px] border p-5 text-[var(--app-text)] backdrop-blur-2xl transition-[border-color,box-shadow,transform,background-color,opacity] duration-400 ease-out will-change-transform sm:rounded-[26px] sm:p-6 ${className}`}
    >
      <span className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-[rgba(var(--card-accent-rgb),0.18)] opacity-55 blur-3xl transition-opacity duration-400 ease-out group-hover/card:opacity-100" />
      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-400 ease-out group-hover/card:opacity-100">
        <span className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(var(--card-accent-rgb),0.55),transparent)]" />
      </span>
      <span className="pointer-events-none absolute inset-px rounded-[25px] bg-[image:var(--app-panel-overlay)] opacity-90" />
      <span className="pointer-events-none absolute left-6 right-6 top-0 h-px bg-gradient-to-r from-violet-200/0 via-violet-100/34 to-violet-200/0" />
      {alive ? (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-[rgba(var(--card-accent-rgb),0.12)] blur-3xl"
          animate={reduceMotion ? undefined : { opacity: [0.18, 0.36, 0.18] }}
          transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
      <div className="relative z-10">{children}</div>
    </motion.section>
  );
}

export function PrimaryButton({
  children,
  disabled = false,
  icon: Icon,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  icon?: LucideIcon;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.018 }}
      whileTap={reduceMotion ? undefined : { scale: 0.992 }}
      transition={{ duration: 0.32, ease: premiumEase }}
      className="inline-flex min-h-12 w-full touch-manipulation transform-gpu items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#8b5cf6,#d946ef)] px-5 py-3 text-sm font-semibold !text-white shadow-[0_18px_44px_rgba(139,92,246,.28),inset_0_1px_0_rgba(255,255,255,.22)] transition-[background-color,box-shadow,transform,opacity] duration-500 hover:shadow-[0_22px_56px_rgba(139,92,246,.36),inset_0_1px_0_rgba(255,255,255,.28)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {Icon ? <Icon size={18} strokeWidth={2.4} /> : null}
      {children}
    </motion.button>
  );
}

export function ShowMoreButton({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("common");

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 inline-flex min-h-11 touch-manipulation transform-gpu items-center justify-center rounded-full border border-violet-300/16 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-200 shadow-[0_12px_28px_rgba(109,40,217,.10),inset_0_1px_0_rgba(255,255,255,.08)] transition duration-400 ease-out hover:-translate-y-0.5 hover:border-violet-300/28 hover:bg-violet-500/15 hover:shadow-[0_0_26px_rgba(168,85,247,.14)] active:scale-95 active:opacity-90"
    >
      {expanded ? t("showLess") : t("showAll")}
    </button>
  );
}

export function EmptyState({ children }: { children?: React.ReactNode }) {
  const t = useTranslations("common");

  return (
    <div className="rounded-2xl border border-violet-300/12 bg-white/[0.025] px-4 py-6 text-center text-sm text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
      {children ?? t("empty")}
    </div>
  );
}

export function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-12 w-full rounded-2xl border border-violet-300/14 bg-[var(--app-field-bg)] px-4 py-3 text-sm font-semibold text-[var(--app-text)] shadow-[inset_0_1px_0_rgba(255,255,255,.08)] outline-none transition duration-300 focus:border-violet-200/40 focus:ring-2 focus:ring-violet-500/20 sm:w-auto"
    />
  );
}

export function ConfirmDeleteButton({
  onConfirm,
  disabled = false,
  label,
}: {
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  label?: string;
}) {
  const t = useTranslations("common");
  const [deleting, setDeleting] = useState(false);
  const buttonLabel = label ?? t("delete");

  async function handleDelete() {
    if (disabled || deleting) {
      return;
    }

    if (!window.confirm(t("confirmDelete"))) {
      return;
    }

    setDeleting(true);

    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={disabled || deleting}
      aria-label={buttonLabel}
      title={buttonLabel}
      className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border border-red-300/12 bg-red-500/8 text-red-300 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] transition duration-400 hover:border-red-300/24 hover:bg-red-500/14 hover:text-red-200 active:scale-95 active:opacity-90 disabled:cursor-wait disabled:opacity-55"
    >
      <Trash2 size={18} strokeWidth={2.2} />
    </button>
  );
}

export function EditButton({
  onClick,
  disabled = false,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const t = useTranslations("common");
  const buttonLabel = label ?? t("edit");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={buttonLabel}
      title={buttonLabel}
      className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border border-violet-300/14 bg-violet-500/10 text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] transition duration-400 hover:border-violet-300/26 hover:bg-violet-500/16 hover:text-violet-100 active:scale-95 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <PencilLine size={18} strokeWidth={2.2} />
    </button>
  );
}

export function Modal({
  title,
  description,
  open,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const c = useTranslations("common");

  if (!open) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-[max(16px,env(safe-area-inset-top))_16px_max(16px,env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.982 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: premiumEase }}
        className="relative max-h-[calc(100dvh-48px)] w-[min(36rem,calc(100vw-32px))] overflow-y-auto overflow-x-hidden rounded-[28px] border border-violet-200/18 bg-[image:var(--app-modal-bg)] p-5 text-[var(--app-text)] shadow-[0_34px_120px_rgba(0,0,0,.28),0_0_54px_rgba(109,40,217,.14),inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-2xl sm:p-7"
      >
        <span className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-300/10 blur-3xl" />
        <div className="relative z-10 mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-bold sm:text-2xl">{title}</h2>
            {description ? <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 shrink-0 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 active:scale-95 active:opacity-90"
          >
            {c("close")}
          </button>
        </div>
        <div className="relative z-10">{children}</div>
      </motion.div>
    </motion.div>
  );
}

export const fieldClass =
  "min-h-12 w-full min-w-0 rounded-2xl border border-[var(--app-field-border)] bg-[var(--app-field-bg)] px-4 py-3 text-base text-[var(--app-text)] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition duration-300 placeholder:text-slate-500 focus:border-violet-200/40 focus:bg-[var(--app-field-bg)] focus:ring-2 focus:ring-violet-500/20 sm:text-sm";

export const labelClass = "mb-2 block break-words text-sm font-medium text-slate-300";

export const StatCard = memo(function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "violet",
  variant,
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "violet" | "green" | "red" | "blue" | "amber";
  variant?: CardVariant;
}) {
  const cardVariant = variant ?? toneToVariant[tone];

  return (
    <Card className="min-h-[150px] sm:min-h-[190px]" variant={cardVariant}>
      <div className="mb-5 flex min-w-0 items-center justify-between gap-3 sm:mb-7">
        <IconBadge icon={Icon} tone={tone} />
        <div className="min-w-0">
          <span className="semantic-label block break-words text-xs font-semibold uppercase tracking-[0.14em] sm:tracking-[0.16em]">{title}</span>
        </div>
      </div>
      <p className="semantic-stat-value break-words text-[clamp(1.65rem,7vw,2.125rem)] font-bold leading-tight tracking-tight transition-[text-shadow,color,opacity] duration-700 ease-out">{value}</p>
      <p className="semantic-detail mt-2 break-words text-sm font-medium">{detail}</p>
    </Card>
  );
});

export const ProgressBar = memo(function ProgressBar({
  value,
  color = "bg-violet-400",
}: {
  value: number;
  color?: string;
}) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full border border-white/5 bg-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,.22)]">
      <motion.div
        initial={false}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.85, ease: premiumEase }}
        className={`h-full rounded-full shadow-[0_0_22px_rgba(168,85,247,.38)] ${color}`}
      />
    </div>
  );
});
