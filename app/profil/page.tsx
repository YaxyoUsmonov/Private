"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, Brain, ChevronRight, Flame, Pencil, Trophy } from "lucide-react";
import { DataState } from "../components/data-state";
import { Card, fieldClass, IconBadge, labelClass, Modal, PageHeader, PrimaryButton, ProgressBar, StatCard } from "../components/ui";
import { useAppData } from "../hooks/use-app-data";
import { formatNumber } from "../../lib/format";

export default function ProfilPage() {
  const t = useTranslations("profile");
  const c = useTranslations("common");
  const { data, loading, error, updateData } = useAppData();
  const profile = data.profile_data;
  const [modalOpen, setModalOpen] = useState(false);
  const xpProgress = profile.xpTarget > 0 ? Math.min(100, Math.round((profile.xp / profile.xpTarget) * 100)) : 0;

  function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name"));

    const nextProfile = {
      name,
      shortName: name.split(" ")[0] || name,
      email: String(form.get("email")),
      bio: String(form.get("bio")),
      level: Number(form.get("level") || profile.level),
      xp: Number(form.get("xp") || profile.xp),
      xpTarget: Number(form.get("xpTarget") || profile.xpTarget),
      streak: Number(form.get("streak") || profile.streak),
      productivity: Number(form.get("productivity") || profile.productivity),
      focus: String(form.get("focus") || profile.focus),
      achievements: Number(form.get("achievements") || profile.achievements),
    };
    updateData((current) => ({
      ...current,
      profile_data: nextProfile,
      streaks: { ...current.streaks, current: nextProfile.streak },
    }));
    setModalOpen(false);
  }

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={profile.name}
        description={t("description")}
        action={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex min-h-12 transform-gpu items-center justify-center gap-2 rounded-lg border border-violet-300/14 bg-white/[0.045] px-4 py-3 text-sm font-semibold shadow-[0_12px_30px_rgba(0,0,0,.16)] transition duration-500 hover:border-violet-300/24 hover:bg-white/[0.075]"
          >
            <Pencil size={18} /> {t("edit")}
          </button>
        }
      />
      <DataState loading={loading} error={error} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[360px_1fr]">
        <Card alive variant="reflection">
          <div className="flex flex-col items-center text-center">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-violet-300/30 bg-[radial-gradient(circle_at_35%_20%,rgba(217,70,239,.32),rgba(124,58,237,.20)_45%,rgba(5,8,22,.92))] text-5xl font-bold shadow-[0_0_42px_rgba(168,85,247,.24),inset_0_1px_0_rgba(255,255,255,.16)] sm:h-36 sm:w-36 sm:text-6xl">
              <span className="absolute inset-3 rounded-full border border-white/10" />
              {profile.shortName[0] || profile.name[0] || "P"}
            </div>
            <h2 className="mt-6 break-words text-2xl font-bold sm:text-3xl">{profile.shortName}</h2>
            <p className="mt-2 break-words text-sm text-violet-300">{profile.bio}</p>
          </div>

          <div className="mt-7 rounded-3xl border border-violet-300/14 bg-[linear-gradient(135deg,rgba(255,255,255,.06),rgba(168,85,247,.035))] p-5 shadow-[0_18px_36px_rgba(0,0,0,.18),inset_0_1px_0_rgba(255,255,255,.08)]">
            <div className="mb-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <IconBadge icon={Trophy} tone="amber" size="sm" /> {t("level", { level: profile.level })}
              </span>
              <span className="text-sm text-slate-500">XP</span>
            </div>
            <ProgressBar value={xpProgress} />
            <p className="mt-2 break-words text-right text-sm text-slate-500">{formatNumber(profile.xp)} / {formatNumber(profile.xpTarget)} XP</p>
          </div>

          <div className="mt-4 flex min-w-0 items-center gap-4 rounded-3xl border border-violet-300/14 bg-[linear-gradient(135deg,rgba(255,255,255,.055),rgba(124,58,237,.035))] p-5 shadow-[0_18px_36px_rgba(0,0,0,.18),inset_0_1px_0_rgba(255,255,255,.08)]">
            <IconBadge icon={Flame} tone="amber" size="lg" />
            <div className="min-w-0">
              <p className="break-words text-3xl font-bold">{profile.streak}</p>
              <p className="break-words text-sm text-slate-500">{t("streak")}</p>
            </div>
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title={t("productivity")} value={`${profile.productivity}%`} detail={t("productivityDetail")} icon={Activity} tone="blue" variant="plan" />
            <StatCard title={t("focus")} value={profile.focus} detail={t("focusDetail")} icon={Brain} tone="green" />
            <StatCard title={t("achievements")} value={`${profile.achievements}`} detail={t("achievementsDetail")} icon={Trophy} tone="amber" />
          </div>

          <Card alive variant="reflection">
            <h2 className="mb-5 text-xl font-bold">{t("about")}</h2>
            <div className="space-y-4">
              {[
                [t("fullName"), profile.name],
                [t("email"), profile.email],
                [t("joined"), t("privateAccount")],
              ].map(([label, value]) => (
                <div key={label} className="flex min-w-0 flex-col gap-1 border-b border-white/5 pb-4 last:border-0 sm:flex-row sm:justify-between">
                  <span className="break-words text-slate-500">{label}</span>
                  <span className="break-words font-semibold sm:text-right">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <section className="relative overflow-hidden rounded-lg border border-violet-300/14 bg-[linear-gradient(135deg,rgba(124,58,237,.36),rgba(168,85,247,.18)_48%,rgba(217,70,239,.18))] p-5 shadow-[0_24px_70px_rgba(88,28,135,.16),0_0_34px_rgba(168,85,247,.1)] sm:p-7">
            <span className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-violet-300/12 blur-2xl" />
            <h2 className="break-words text-2xl font-bold sm:text-3xl">{t("heroTitle")}</h2>
            <p className="mt-3 max-w-2xl break-words text-slate-300">{t("quote")}</p>
            <button className="relative mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white/92 px-4 py-3 font-semibold text-slate-950 shadow-[0_14px_32px_rgba(0,0,0,.22)] transition duration-500 hover:bg-white sm:w-auto">
              {c("continue")} <ChevronRight size={18} />
            </button>
          </section>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("edit")}
        description={t("description")}
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("name")}</label>
              <input name="name" className={fieldClass} defaultValue={profile.name} required />
            </div>
            <div>
              <label className={labelClass}>{t("email")}</label>
              <input name="email" type="email" className={fieldClass} defaultValue={profile.email} required />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t("bio")}</label>
              <input name="bio" className={fieldClass} defaultValue={profile.bio} />
            </div>
            <div>
              <label className={labelClass}>{t("levelInput")}</label>
              <input name="level" type="number" min="1" className={fieldClass} defaultValue={profile.level} />
            </div>
            <div>
              <label className={labelClass}>{t("streak")}</label>
              <input name="streak" type="number" min="0" className={fieldClass} defaultValue={profile.streak} />
            </div>
            <div>
              <label className={labelClass}>XP</label>
              <input name="xp" type="number" min="0" className={fieldClass} defaultValue={profile.xp} />
            </div>
            <div>
              <label className={labelClass}>{t("xpTarget")}</label>
              <input name="xpTarget" type="number" min="1" className={fieldClass} defaultValue={profile.xpTarget} />
            </div>
            <div>
              <label className={labelClass}>{t("productivityInput")}</label>
              <input name="productivity" type="number" min="0" max="100" className={fieldClass} defaultValue={profile.productivity} />
            </div>
            <div>
              <label className={labelClass}>{t("focusTime")}</label>
              <input name="focus" className={fieldClass} defaultValue={profile.focus} />
            </div>
            <div>
              <label className={labelClass}>{t("achievementsInput")}</label>
              <input name="achievements" type="number" min="0" className={fieldClass} defaultValue={profile.achievements} />
            </div>
          </div>
          <PrimaryButton icon={Pencil} type="submit">{t("saveProfile")}</PrimaryButton>
        </form>
      </Modal>
    </>
  );
}
