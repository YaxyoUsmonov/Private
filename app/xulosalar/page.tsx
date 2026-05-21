"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Brain, Download, Dumbbell, Moon, Smartphone, Star, Trophy, Utensils } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AiAnalysisContent } from "../components/ai-analysis-content";
import { ChartFrame } from "../components/chart-frame";
import { DataState } from "../components/data-state";
import { Card, ConfirmDeleteButton, DateInput, EditButton, EmptyState, fieldClass, IconBadge, labelClass, Modal, PageHeader, PrimaryButton, ProgressBar, ShowMoreButton, StatCard } from "../components/ui";
import { useAiAnalysis } from "../hooks/use-ai-analysis";
import { useAppData } from "../hooks/use-app-data";
import type { HabitItem } from "../../lib/app-data";
import { isSameDate, shortDateLabel, todayISO } from "../utils/date";
import { formatMoney } from "../../lib/format";
import { createItemId, habitKey } from "../utils/items";

const habitIcons = [Smartphone, Moon, Utensils, AlertTriangle, Dumbbell, Brain];

export default function XulosalarPage() {
  const t = useTranslations("summary");
  const c = useTranslations("common");
  const aiT = useTranslations("ai");
  const modals = useTranslations("modals");
  const { data, loading, error, updateData } = useAppData();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [deleteError, setDeleteError] = useState("");
  const habits = data.habits.filter((item) => isSameDate(item.date, selectedDate));
  const tasksForDate = data.tasks.filter((item) => isSameDate(item.date, selectedDate));
  const errorsForDate = data.journal.errors.filter((item) => isSameDate(item.date, selectedDate));
  const transactionsForDate = data.finance.transactions.filter((item) => isSameDate(item.date, selectedDate));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabitKey, setEditingHabitKey] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState({ stats: false, habits: false, advice: false });
  const summaryAi = useAiAnalysis({ anchorDate: selectedDate, period: "week", scope: "summary" });
  const selectedConclusion = data.journal.conclusions.find((item) => isSameDate(item.date, selectedDate));
  const selectedSummary = data.journal.daily_summaries.find((item) => isSameDate(item.date, selectedDate));
  const summary = selectedConclusion?.content || selectedSummary?.summary || "";
  const mood = selectedSummary?.score ?? 0;
  const aiScore = summaryAi.analysis?.score ?? null;
  const completedPlans = tasksForDate.filter((task) => task.status === "Bajarildi").length;
  const expenseTotal = transactionsForDate.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const problemCategory = errorsForDate[0]?.category ?? "-";
  const miniStats = [
    [`${completedPlans}`, t("plansCompleted"), "text-violet-300"],
    [formatMoney(expenseTotal), t("expenses"), "text-red-300"],
    [`${errorsForDate.length}`, t("mistakes"), "text-orange-300"],
    [aiScore === null ? "-" : `${aiScore}`, t("aiGrade"), "text-violet-300"],
  ] as const;
  const adviceItems = summaryAi.analysis?.recommendations ?? [];
  const summaryScoreChartData = summaryAi.analysis?.score !== null && summaryAi.analysis?.score !== undefined ? [{ day: shortDateLabel(selectedDate), value: summaryAi.analysis.score }] : [];
  const visibleMiniStats = expandedLists.stats ? miniStats : miniStats.slice(0, 4);
  const visibleHabits = expandedLists.habits ? habits : habits.slice(0, 4);
  const visibleAdvice = expandedLists.advice ? adviceItems : adviceItems.slice(0, 4);
  const editingHabit = editingHabitKey ? data.habits.find((item) => habitKey(item) === editingHabitKey) : null;

  function closeModal() {
    setModalOpen(false);
    setEditingHabitKey(null);
  }

  function openReportModal() {
    setEditingHabitKey(null);
    setModalOpen(true);
  }

  function openEditHabit(key: string) {
    setEditingHabitKey(key);
    setModalOpen(true);
  }

  function handleSaveConclusion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const habitTitle = String(form.get("habit"));
    const habitValue = Number(form.get("repeat") || 1);

    const nextHabit: HabitItem = {
      id: editingHabit?.id ?? createItemId(),
      title: habitTitle,
      value: habitValue,
      color: "bg-violet-400",
      date: String(form.get("date") || selectedDate || todayISO()),
    };
    const date = String(form.get("date") || selectedDate || todayISO());
    const summaryText = String(form.get("summary"));
    const score = Number(form.get("mood") || 0);

    updateData((current) => ({
      ...current,
      habits: editingHabitKey
        ? current.habits.map((item) => habitKey(item) === editingHabitKey ? nextHabit : item)
        : [nextHabit, ...current.habits],
      journal: {
        ...current.journal,
        summary: summaryText,
        mood: score,
        conclusions: [
          { id: createItemId(), title: habitTitle || t("title"), content: summaryText, date },
          ...current.journal.conclusions.filter((item) => !isSameDate(item.date, date)),
        ],
        daily_summaries: [
          { id: createItemId(), summary: summaryText, advice: "", score, date },
          ...current.journal.daily_summaries.filter((item) => !isSameDate(item.date, date)),
        ],
      },
    }));
    closeModal();
    event.currentTarget.reset();
  }

  function handleDeleteSummary() {
    setDeleteError("");
    try {
      updateData((current) => ({
        ...current,
        journal: {
          ...current.journal,
          conclusions: current.journal.conclusions.filter((item) => !isSameDate(item.date, selectedDate)),
          daily_summaries: current.journal.daily_summaries.filter((item) => !isSameDate(item.date, selectedDate)),
        },
      }));
    } catch {
      setDeleteError(c("deleteErrorConclusion"));
    }
  }

  function handleDeleteHabit(key: string) {
    setDeleteError("");
    try {
      updateData((current) => ({
        ...current,
        habits: current.habits.filter((item) => habitKey(item) !== key),
      }));
    } catch {
      setDeleteError(c("deleteErrorHabit"));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <DateInput value={selectedDate} onChange={setSelectedDate} />
            <PrimaryButton icon={Download} onClick={summaryAi.analyze} disabled={summaryAi.loading}>{summaryAi.loading ? aiT("analyzing") : t("aiReport")}</PrimaryButton>
          </div>
        }
      />
      <DataState loading={loading} error={error} />
      {deleteError ? (
        <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {deleteError}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t("mood")} value={`${mood}%`} detail={t("moodDetail")} icon={Star} tone="green" />
        <StatCard title={t("achievement")} value={`${completedPlans}`} detail={t("completedPlansDetail")} icon={Trophy} tone="amber" />
        <StatCard title={t("problem")} value={problemCategory} detail={shortDateLabel(selectedDate)} icon={AlertTriangle} tone="red" />
        <StatCard title={t("aiScore")} value={aiScore === null ? "-" : `${aiScore}/100`} detail={summaryAi.analysis ? t("selectedPeriodDetail") : aiT("unavailableShort")} icon={Brain} tone="violet" variant="ai" />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card alive variant="ai">
            <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
              <h2 className="flex min-w-0 flex-wrap items-center gap-2 text-xl font-bold">
                <IconBadge icon={Brain} tone="violet" size="sm" /> {t("aiGeneral")}
              </h2>
              <span className="flex items-center gap-2">
                {selectedConclusion || selectedSummary ? <EditButton onClick={openReportModal} /> : null}
                {selectedConclusion || selectedSummary ? <ConfirmDeleteButton onConfirm={handleDeleteSummary} /> : null}
              </span>
            </div>
            <AiAnalysisContent {...summaryAi} />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {visibleMiniStats.map(([value, label, color]) => (
                <div key={label} className="min-w-0 rounded-lg border border-violet-300/10 bg-white/[0.035] p-4 shadow-[0_12px_28px_rgba(0,0,0,.14)]">
                  <p className={`break-words text-2xl font-bold ${color}`}>{value}</p>
                  <p className="mt-2 break-words text-sm text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            {miniStats.length > 4 ? <ShowMoreButton expanded={expandedLists.stats} onClick={() => setExpandedLists((current) => ({ ...current, stats: !current.stats }))} /> : null}
          </Card>

          <Card variant="reflection">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="min-w-0 break-words text-xl font-bold">{t("aiReport")}</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-2xl border border-violet-300/18 bg-violet-500/15 px-3.5 py-2 text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">{c("week")}</span>
                <span className="rounded-2xl border border-white/10 bg-white/[0.045] px-3.5 py-2 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">{c("month")}</span>
                <span className="rounded-2xl border border-white/10 bg-white/[0.045] px-3.5 py-2 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">{c("year")}</span>
              </div>
            </div>
            {summaryScoreChartData.length ? (
              <ChartFrame className="h-[230px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%" debounce={80}>
                  <LineChart data={summaryScoreChartData}>
                    <XAxis dataKey="day" stroke="#c4b5fd" />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,.12)" }} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#AB55F7"
                      strokeWidth={4}
                      dot={{ r: 4, fill: "#c084fc", stroke: "#ede9fe", strokeWidth: 2, className: "chart-dot-pulse" }}
                      activeDot={{ r: 6, fill: "#d946ef", stroke: "#f5d0fe", strokeWidth: 2, className: "chart-dot-pulse" }}
                      style={{ filter: "drop-shadow(0 0 10px rgba(171,85,247,.44))" }}
                      isAnimationActive
                      animationDuration={560}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartFrame>
            ) : (
              <div className="rounded-2xl border border-violet-300/14 bg-white/[0.035] p-5 text-sm leading-6 text-slate-300">
                {summaryAi.analysis ? aiT("analysisUnavailable") : t("noAnalysisLong")}
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card alive variant="reflection">
            <h2 className="mb-5 text-lg font-bold">{t("impactHabits")}</h2>
            <div className="space-y-5">
              {visibleHabits.map((item, index) => {
                const Icon = habitIcons[index % habitIcons.length];
                return (
                  <div key={habitKey(item)}>
                    <div className="mb-2 flex min-w-0 flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="flex min-w-0 items-center gap-2">
                        <IconBadge icon={Icon} tone="violet" size="sm" />
                        <span className="break-words">{item.title}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-slate-500">
                        {t("times", { count: item.value })}
                        <EditButton onClick={() => openEditHabit(habitKey(item))} />
                        <ConfirmDeleteButton onConfirm={() => handleDeleteHabit(habitKey(item))} />
                      </span>
                    </div>
                    <ProgressBar value={item.value * 7} color={item.color ?? "bg-violet-400"} />
                  </div>
                );
              })}
              {!visibleHabits.length ? <EmptyState /> : null}
            </div>
            {habits.length > 4 ? <ShowMoreButton expanded={expandedLists.habits} onClick={() => setExpandedLists((current) => ({ ...current, habits: !current.habits }))} /> : null}
          </Card>

          <Card variant="ai">
            <h2 className="mb-5 text-lg font-bold">{t("aiAdvice")}</h2>
            <div className="space-y-4 text-sm leading-6 text-slate-300">
              {visibleAdvice.map((item) => <p key={item} className="break-words">{item}</p>)}
              {!visibleAdvice.length ? <p>{t("noAnalysisLong")}</p> : null}
            </div>
            {adviceItems.length > 4 ? <ShowMoreButton expanded={expandedLists.advice} onClick={() => setExpandedLists((current) => ({ ...current, advice: !current.advice }))} /> : null}
          </Card>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingHabit ? t("editTitle") : t("modalTitle")}
        description={t("modalDescription")}
      >
        <form key={editingHabitKey ?? "summary"} onSubmit={handleSaveConclusion} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("moodPercent")}</label>
              <input name="mood" type="number" min="0" max="100" defaultValue={mood} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{c("date")}</label>
              <input name="date" type="date" defaultValue={editingHabit?.date ?? selectedDate} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>{t("habitName")}</label>
              <input name="habit" className={fieldClass} placeholder={t("exampleHabit")} defaultValue={editingHabit?.title ?? ""} required />
            </div>
            <div>
              <label className={labelClass}>{t("repeatCount")}</label>
              <input name="repeat" type="number" min="1" defaultValue={editingHabit?.value ?? 1} className={fieldClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t("generalSummary")}</label>
              <textarea name="summary" className={fieldClass} rows={5} defaultValue={summary} required />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryButton icon={Download} type="submit">{editingHabit ? c("save") : modals("updateReport")}</PrimaryButton>
            <button type="button" onClick={closeModal} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-violet-300/14 bg-white/[0.035] px-5 py-3 text-sm font-semibold text-slate-300 transition duration-400 hover:border-violet-300/24 hover:bg-white/[0.06]">
              {c("cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
