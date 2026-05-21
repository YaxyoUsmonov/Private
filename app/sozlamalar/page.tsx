"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Bell, Brain, ChevronRight, Database, Download, Globe, Lock, Monitor, Moon, Shield, Smartphone, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DataState } from "../components/data-state";
import { Card, IconBadge, Modal, PageHeader, PrimaryButton } from "../components/ui";
import { useAppData } from "../hooks/use-app-data";
import { localeLabels, normalizeLocale, type Locale } from "../../i18n/locales";

function Toggle({ checked = true, onClick }: { checked?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-7 w-12 items-center rounded-full border px-1 transition duration-500 ${checked ? "justify-end border-violet-300/20 bg-violet-500/80 shadow-[0_0_22px_rgba(139,92,246,.18)]" : "justify-start border-white/10 bg-white/10"}`}
    >
      <motion.span layout className="h-5 w-5 rounded-full bg-white shadow-[0_6px_16px_rgba(0,0,0,.24)]" transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} />
    </button>
  );
}

function SettingsRow({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-white/10 bg-[var(--app-field-bg)] p-4 shadow-[0_10px_26px_rgba(0,0,0,.10)] transition duration-500 hover:border-violet-300/20 hover:bg-white/[0.05] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <IconBadge icon={Icon} tone="violet" />
        <div className="min-w-0">
          <h3 className="break-words font-semibold">{title}</h3>
          <p className="mt-1 break-words text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex w-full shrink-0 justify-end sm:w-auto">{action}</div>
    </div>
  );
}

export default function SozlamalarPage() {
  const t = useTranslations("settings");
  const c = useTranslations("common");
  const { data, loading, error, updateSection } = useAppData();
  const { theme, reminders, smartReminder, aiProtection } = data.settings;
  const [dialog, setDialog] = useState<{ title: string; description: string } | null>(null);

  function updateSettings(nextSettings: Partial<typeof data.settings>) {
    updateSection("settings", {
      ...data.settings,
      ...nextSettings,
    });
  }

  function updateLanguage(locale: Locale) {
    updateSection("language", locale);
  }

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <DataState loading={loading} error={error} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card alive variant="reflection">
          <h2 className="mb-5 text-xl font-bold">{t("theme")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Yorug", text: t("light"), icon: Sun },
              { label: "Qorongu", text: t("dark"), icon: Moon },
              { label: "Tizim", text: t("system"), icon: Monitor },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => updateSettings({ theme: item.label })}
                  className={`flex min-h-24 transform-gpu flex-col items-center justify-center gap-3 rounded-lg border px-3 py-4 shadow-[0_10px_24px_rgba(0,0,0,.10)] transition duration-500 hover:-translate-y-px sm:h-28 ${
                    theme === item.label ? "border-violet-300/40 bg-violet-500/10 text-violet-300 shadow-[0_14px_34px_rgba(109,40,217,.12)]" : "border-white/10 bg-[var(--app-field-bg)] text-slate-400 hover:bg-white/5"
                  }`}
                >
                  <Icon size={23} strokeWidth={2.2} />
                  <span className="break-words text-center font-semibold">{item.text}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card alive variant="ai">
          <h2 className="mb-5 text-xl font-bold">{t("notifications")}</h2>
          <div className="space-y-4">
            <SettingsRow icon={Bell} title={t("reminders")} description={t("remindersDescription")} action={<Toggle checked={reminders} onClick={() => updateSettings({ reminders: !reminders })} />} />
            <SettingsRow icon={Smartphone} title={t("smartReminder")} description={t("smartReminderDescription")} action={<Toggle checked={smartReminder} onClick={() => updateSettings({ smartReminder: !smartReminder })} />} />
          </div>
        </Card>

        <Card variant="balance">
          <h2 className="mb-5 text-xl font-bold">{t("dataManagement")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDialog({ title: t("export"), description: t("exportDescription") })}
              className="group min-h-12 min-w-0 rounded-3xl border border-violet-300/14 bg-[linear-gradient(135deg,rgba(255,255,255,.06),rgba(168,85,247,.035))] p-5 text-left shadow-[0_18px_38px_rgba(0,0,0,.18),inset_0_1px_0_rgba(255,255,255,.08)] transition duration-[420ms] ease-out hover:-translate-y-0.5 hover:border-violet-300/24 hover:bg-violet-500/[0.055]"
            >
              <IconBadge icon={Download} tone="violet" />
              <h3 className="mt-4 break-words text-lg font-semibold">{t("export")}</h3>
              <p className="mt-2 break-words text-sm text-slate-500">{t("exportDescription")}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm text-violet-300">
                {c("download")} <ChevronRight size={16} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDialog({ title: t("backup"), description: t("backupDescription") })}
              className="group min-h-12 min-w-0 rounded-3xl border border-violet-300/14 bg-[linear-gradient(135deg,rgba(255,255,255,.06),rgba(168,85,247,.035))] p-5 text-left shadow-[0_18px_38px_rgba(0,0,0,.18),inset_0_1px_0_rgba(255,255,255,.08)] transition duration-[420ms] ease-out hover:-translate-y-0.5 hover:border-violet-300/24 hover:bg-violet-500/[0.055]"
            >
              <IconBadge icon={Database} tone="violet" />
              <h3 className="mt-4 break-words text-lg font-semibold">{t("backup")}</h3>
              <p className="mt-2 break-words text-sm text-slate-500">{t("backupDescription")}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm text-violet-300">
                {c("copy")} <ChevronRight size={16} />
              </span>
            </button>
          </div>
        </Card>

        <Card variant="reflection">
          <h2 className="mb-5 text-xl font-bold">{t("account")}</h2>
          <div className="space-y-4">
            <SettingsRow
              icon={Globe}
              title={t("language")}
              description={t("languageDescription")}
              action={
                <select
                  value={normalizeLocale(data.language)}
                  onChange={(event) => updateLanguage(event.target.value as Locale)}
                  className="w-full rounded-2xl border border-violet-300/14 bg-violet-500/10 px-3.5 py-2 text-sm font-medium text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] outline-none transition duration-[420ms] hover:border-violet-300/24 hover:bg-violet-500/15 sm:w-auto"
                >
                  {Object.entries(localeLabels).map(([locale, label]) => (
                    <option key={locale} value={locale}>{label}</option>
                  ))}
                </select>
              }
            />
            <SettingsRow
              icon={Shield}
              title={t("security")}
              description={t("securityDescription")}
              action={<button type="button" onClick={() => setDialog({ title: t("security"), description: t("securityDescription") })}><ChevronRight size={18} className="text-slate-500" /></button>}
            />
            <SettingsRow
              icon={Lock}
              title={t("password")}
              description={t("passwordDescription")}
              action={<button type="button" onClick={() => setDialog({ title: t("password"), description: t("passwordDescription") })}><ChevronRight size={18} className="text-slate-500" /></button>}
            />
            <SettingsRow
              icon={Brain}
              title={t("aiProtection")}
              description={t("aiProtectionDescription")}
              action={<Toggle checked={aiProtection} onClick={() => updateSettings({ aiProtection: !aiProtection })} />}
            />
          </div>
        </Card>
      </div>

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={dialog?.title ?? ""}
        description={dialog?.description}
      >
        <PrimaryButton onClick={() => setDialog(null)}>{c("close")}</PrimaryButton>
      </Modal>
    </>
  );
}
