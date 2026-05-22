"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Brain, Calendar, CircleAlert, Flame, Moon, Plus, Smartphone } from "lucide-react";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AiAnalysisContent } from "../components/ai-analysis-content";
import { ChartFrame } from "../components/chart-frame";
import { DataState } from "../components/data-state";
import { Card, ConfirmDeleteButton, DateInput, EditButton, EmptyState, fieldClass, IconBadge, labelClass, Modal, PageHeader, PrimaryButton, ProgressBar, ShowMoreButton, StatCard } from "../components/ui";
import { useAiAnalysis } from "../hooks/use-ai-analysis";
import { useAppData } from "../hooks/use-app-data";
import type { ErrorItem as StoredErrorItem } from "../../lib/app-data";
import { isSameDate, shortDateLabel, todayISO } from "../utils/date";
import { createItemId, errorKey } from "../utils/items";

const chartColors = ["#a78bfa", "#c084fc", "#f59e0b", "#22c55e", "#ef4444", "#38bdf8"];

const errorMeta = {
  Uyqu: { icon: Moon, tone: "violet" as const },
  Telefon: { icon: Smartphone, tone: "blue" as const },
  Reja: { icon: CircleAlert, tone: "amber" as const },
  "Reja bajarmaslik": { icon: CircleAlert, tone: "red" as const },
  Moliya: { icon: AlertTriangle, tone: "red" as const },
};

function parseRepeat(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function XatolarimPage() {
  const t = useTranslations("mistakes");
  const c = useTranslations("common");
  const cat = useTranslations("categories");
  const priorityT = useTranslations("priority");
  const modals = useTranslations("modals");
  const { data, loading, error, updateSection } = useAppData();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const errors = useMemo(
    () => data.journal.errors.filter((item) => isSameDate(item.date, selectedDate)),
    [data.journal.errors, selectedDate],
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingErrorKey, setEditingErrorKey] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState({ errors: false, categories: false, risky: false });
  const mistakesAi = useAiAnalysis({ anchorDate: selectedDate, period: "week", scope: "mistakes" });
  const totalRepeats = errors.reduce((sum, item) => sum + parseRepeat(item.repeat), 0);
  const mostRepeated = useMemo(() => [...errors].sort((a, b) => parseRepeat(b.repeat) - parseRepeat(a.repeat))[0], [errors]);
  const categories = useMemo(() => {
    const grouped = errors.reduce<Record<string, number>>((acc, item) => {
      const key = item.category || c("other");
      acc[key] = (acc[key] ?? 0) + parseRepeat(item.repeat);
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value], index) => ({
      name,
      value: Number.isFinite(value) ? value : 0,
      color: chartColors[index % chartColors.length],
    }));
  }, [c, errors]);
  const dynamicTrend = categories.map((item) => ({ day: item.name, value: item.value }));
  const maxCategoryValue = Math.max(...categories.map((item) => item.value), 1);
  const riskyHabits = categories.map((item, index) => [
    item.name,
    Math.round((item.value / maxCategoryValue) * 100),
    index % 3 === 0 ? "bg-red-400" : index % 3 === 1 ? "bg-fuchsia-400" : "bg-amber-400",
  ] as const);
  const visibleErrors = expandedLists.errors ? errors : errors.slice(0, 4);
  const visibleCategories = expandedLists.categories ? categories : categories.slice(0, 4);
  const visibleRiskyHabits = expandedLists.risky ? riskyHabits : riskyHabits.slice(0, 4);
  const editingError = useMemo(
    () => editingErrorKey ? data.journal.errors.find((item) => errorKey(item) === editingErrorKey) : null,
    [data.journal.errors, editingErrorKey],
  );
  const categoryOptions = [
    { value: "Uyqu", label: cat("sleep") },
    { value: "Telefon", label: cat("phone") },
    { value: "Reja", label: cat("plan") },
    { value: "Reja bajarmaslik", label: cat("planMissed") },
    { value: "Moliya", label: cat("finance") },
  ];
  const severityOptions = [
    { value: "Past", label: priorityT("low") },
    { value: "O'rta", label: priorityT("medium") },
    { value: "Yuqori", label: priorityT("high") },
  ];
  const categoryLabel = (value: string) => categoryOptions.find((item) => item.value === value)?.label ?? value;

  const openNewError = useCallback(() => {
    setEditingErrorKey(null);
    setModalOpen(true);
  }, []);

  const openEditError = useCallback((key: string) => {
    setEditingErrorKey(key);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingErrorKey(null);
  }, []);

  function handleSaveError(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = String(form.get("category") || "Reja");

    const nextError: StoredErrorItem = {
      id: editingError?.id ?? createItemId(),
      title: String(form.get("title")),
      reason: String(form.get("reason")),
      time: String(form.get("time") || "Bugun"),
      repeat: `${Number(form.get("repeat") || 1)} marta`,
      category,
      severity: String(form.get("severity") || "O'rta"),
      date: String(form.get("date") || selectedDate || todayISO()),
    };

    updateSection("journal", {
      ...data.journal,
      errors: editingErrorKey
        ? data.journal.errors.map((item) => errorKey(item) === editingErrorKey ? nextError : item)
        : [nextError, ...data.journal.errors],
    });
    closeModal();
    event.currentTarget.reset();
  }
  function handleDeleteError(key: string) {
    setDeleteError(null);

    try {
      updateSection("journal", {
        ...data.journal,
        errors: data.journal.errors.filter((item) => errorKey(item) !== key),
      });
    } catch {
      setDeleteError(c("deleteErrorMistake"));
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
            <PrimaryButton icon={Plus} onClick={openNewError}>{t("new")}</PrimaryButton>
          </div>
        }
      />
      <DataState loading={loading} error={error} />
      {deleteError ? <div className="mb-4 rounded-2xl border border-red-300/16 bg-red-500/10 px-4 py-3 text-sm text-red-200">{deleteError}</div> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t("total")} value={`${totalRepeats}`} detail={t("title")} icon={AlertTriangle} tone="red" />
        <StatCard title={t("repeated")} value={mostRepeated?.title ?? "-"} detail={t("repeated")} icon={Flame} tone="red" variant="mistake" />
        <StatCard title={t("selectedDay")} value={`${errors.length}`} detail={shortDateLabel(selectedDate)} icon={Calendar} tone="amber" />
        <StatCard title={t("improvement")} value="0%" detail={t("improvementDetail")} icon={Brain} tone="green" />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card variant="mistake">
            <h2 className="mb-5 text-xl font-bold">{t("trend")}</h2>
            {dynamicTrend.length ? (
              <ChartFrame className="h-[230px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%" debounce={80}>
                  <LineChart data={dynamicTrend}>
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
            ) : <EmptyState />}
          </Card>

          <Card alive variant="mistake">
            <h2 className="mb-5 text-xl font-bold">{t("recent")}</h2>
            <div className="space-y-4">
              {visibleErrors.map((item) => {
                const meta = errorMeta[item.category as keyof typeof errorMeta] ?? errorMeta.Reja;
                const Icon = meta.icon;
                return (
                  <div key={errorKey(item)} className="relative flex min-w-0 flex-col gap-4 border-b border-white/5 pb-4 pl-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                    <span className="absolute left-0 top-3 h-2 w-2 rounded-full bg-rose-300/70 shadow-[0_0_14px_rgba(251,113,133,.24)]" />
                    <div className="flex min-w-0 items-center gap-4">
                      <IconBadge icon={Icon} tone={meta.tone} />
                      <div className="min-w-0">
                        <p className="break-words font-medium">{item.title}</p>
                        <p className="text-sm text-slate-500">{item.reason} · {categoryLabel(item.category)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                      <div className="text-sm sm:text-right">
                        <p>{item.time}</p>
                        <p className="text-red-300">{item.repeat}</p>
                      </div>
                      <EditButton onClick={() => openEditError(errorKey(item))} />
                      <ConfirmDeleteButton onConfirm={() => handleDeleteError(errorKey(item))} />
                    </div>
                  </div>
                );
              })}
              {!visibleErrors.length ? <EmptyState /> : null}
            </div>
            {errors.length > 4 ? <ShowMoreButton expanded={expandedLists.errors} onClick={() => setExpandedLists((current) => ({ ...current, errors: !current.errors }))} /> : null}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card alive variant="ai">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <IconBadge icon={Brain} tone="violet" size="sm" /> {t("aiAnalysis")}
            </h2>
            <AiAnalysisContent {...mistakesAi} />
          </Card>

          <Card variant="mistake">
            <h2 className="mb-5 text-lg font-bold">{t("categories")}</h2>
            {categories.length ? <div className="flex min-w-0 flex-col items-start gap-5 sm:flex-row sm:items-center">
              <ChartFrame className="h-[145px] w-full max-w-[160px] sm:h-[160px] sm:w-[160px]">
                <ResponsiveContainer width="100%" height="100%" debounce={80}>
                  <PieChart>
                    <Pie data={categories} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={3} isAnimationActive animationDuration={420}>
                      {visibleCategories.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartFrame>
              <div className="min-w-0 space-y-3">
                {visibleCategories.map((item) => (
                  <div key={item.name} className="flex min-w-0 items-center gap-3 text-sm text-slate-300">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="break-words">{item.name}</span>
                  </div>
                ))}
              </div>
            </div> : <EmptyState />}
            {categories.length > 4 ? <ShowMoreButton expanded={expandedLists.categories} onClick={() => setExpandedLists((current) => ({ ...current, categories: !current.categories }))} /> : null}
          </Card>

          <Card variant="mistake">
            <h2 className="mb-5 text-lg font-bold">{t("dangerousHabits")}</h2>
            <div className="space-y-4">
              {visibleRiskyHabits.map(([title, value, color]) => (
                <div key={title as string}>
                  <div className="mb-2 flex min-w-0 justify-between gap-3 text-sm">
                    <span className="break-words">{title}</span>
                    <span className="text-slate-500">{value}%</span>
                  </div>
                  <ProgressBar value={value as number} color={color as string} />
                </div>
              ))}
              {!visibleRiskyHabits.length ? <EmptyState /> : null}
            </div>
            {riskyHabits.length > 4 ? <ShowMoreButton expanded={expandedLists.risky} onClick={() => setExpandedLists((current) => ({ ...current, risky: !current.risky }))} /> : null}
          </Card>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingError ? t("editTitle") : t("new")}
        description={t("modalDescription")}
      >
        <form key={editingErrorKey ?? "new-error"} onSubmit={handleSaveError} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("mistakeName")}</label>
              <input name="title" className={fieldClass} placeholder={t("exampleMistake")} defaultValue={editingError?.title ?? ""} required />
            </div>
            <div>
              <label className={labelClass}>{t("categories")}</label>
              <select name="category" className={fieldClass} defaultValue={editingError?.category ?? "Uyqu"}>
                {categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("when")}</label>
              <input name="time" className={fieldClass} placeholder="23:40" defaultValue={editingError?.time ?? ""} />
            </div>
            <div>
              <label className={labelClass}>{c("date")}</label>
              <input name="date" type="date" className={fieldClass} defaultValue={editingError?.date ?? selectedDate} />
            </div>
            <div>
              <label className={labelClass}>{t("severity")}</label>
              <select name="severity" className={fieldClass} defaultValue={editingError?.severity ?? "O'rta"}>
                {severityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("repeatCount")}</label>
              <input name="repeat" type="number" min="1" defaultValue={editingError ? parseRepeat(editingError.repeat) || 1 : 1} className={fieldClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t("reason")}</label>
              <input name="reason" className={fieldClass} placeholder={t("reasonPlaceholder")} defaultValue={editingError?.reason ?? ""} required />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryButton icon={Plus} type="submit">{editingError ? c("save") : modals("saveMistake")}</PrimaryButton>
            <button type="button" onClick={closeModal} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-violet-300/14 bg-white/[0.035] px-5 py-3 text-sm font-semibold text-slate-300 transition duration-400 hover:border-violet-300/24 hover:bg-white/[0.06]">
              {c("cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
