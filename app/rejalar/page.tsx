"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Book, Briefcase, CalendarCheck, Check, Clock3, Dumbbell, Plus, Target, X } from "lucide-react";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AiAnalysisContent } from "../components/ai-analysis-content";
import { ChartFrame } from "../components/chart-frame";
import { DataState } from "../components/data-state";
import { Card, ConfirmDeleteButton, DateInput, EditButton, EmptyState, fieldClass, IconBadge, labelClass, Modal, PageHeader, PrimaryButton, ProgressBar, ShowMoreButton, StatCard } from "../components/ui";
import { useAppData } from "../hooks/use-app-data";
import { useAiAnalysis } from "../hooks/use-ai-analysis";
import type { TaskItem } from "../../lib/app-data";
import { isSameDate, shortDateLabel, todayISO } from "../utils/date";
import { createItemId, taskKey } from "../utils/items";

const chartColors = ["#c084fc", "#22c55e", "#f59e0b", "#a78bfa", "#64748b", "#38bdf8"];
const MIN_STATUS_NOTE_WORDS = 10;

function countStatusNoteWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

const taskMeta = {
  "Ta’lim": { icon: Book, tone: "blue" as const },
  Sport: { icon: Dumbbell, tone: "green" as const },
  Moliya: { icon: Briefcase, tone: "violet" as const },
  Shaxsiy: { icon: Target, tone: "amber" as const },
  "Ish faoliyati": { icon: Briefcase, tone: "blue" as const },
  Karyera: { icon: Target, tone: "violet" as const },
};

function normalizeTaskCategory(value: string) {
  return value === "Oqish" ? "Ta’lim" : value;
}

function taskTimeOrder(value: string | null | undefined) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const [hours, minutes] = value.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.POSITIVE_INFINITY;
  }

  return hours * 60 + minutes;
}

export default function RejalarPage() {
  const t = useTranslations("plans");
  const c = useTranslations("common");
  const cat = useTranslations("categories");
  const priorityT = useTranslations("priority");
  const modals = useTranslations("modals");
  const { data, loading, error, updateSection } = useAppData();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const tasks = useMemo(
    () => data.tasks.filter((task) => isSameDate(task.date, selectedDate)),
    [data.tasks, selectedDate],
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTaskKey, setEditingTaskKey] = useState<string | null>(null);
  const [statusTaskKey, setStatusTaskKey] = useState<string | null>(null);
  const [statusChoice, setStatusChoice] = useState<"completed" | "missed" | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [statusWarning, setStatusWarning] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState({ tasks: false, categories: false });
  const plansAi = useAiAnalysis({ anchorDate: selectedDate, period: "week", scope: "plans" });
  const { completed, pending, progress } = useMemo(() => {
    const completedTasks = tasks.filter((task) => task.status === "Bajarildi").length;
    const pendingTasks = tasks.length - completedTasks;
    const progressValue = Math.round((completedTasks / Math.max(tasks.length, 1)) * 100);

    return {
      completed: completedTasks,
      pending: pendingTasks,
      progress: progressValue,
    };
  }, [tasks]);
  const dynamicProgressData = useMemo(() => (
    tasks.length ? [
      { day: t("completed"), value: completed },
      { day: t("pending"), value: pending },
    ] : []
  ), [completed, pending, tasks.length, t]);
  const categories = useMemo(() => {
    const grouped = tasks.reduce<Record<string, number>>((acc, task) => {
      const key = task.category ? normalizeTaskCategory(task.category) : c("other");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value], index) => ({
      name,
      value,
      color: chartColors[index % chartColors.length],
    }));
  }, [c, tasks]);

  const editingTask = useMemo(
    () => editingTaskKey ? data.tasks.find((task) => taskKey(task) === editingTaskKey) : null,
    [data.tasks, editingTaskKey],
  );
  const statusTask = useMemo(
    () => statusTaskKey ? data.tasks.find((task) => taskKey(task) === statusTaskKey) : null,
    [data.tasks, statusTaskKey],
  );

  const openNewTask = useCallback(() => {
    setEditingTaskKey(null);
    setModalOpen(true);
  }, []);

  const openEditTask = useCallback((key: string) => {
    setEditingTaskKey(key);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingTaskKey(null);
  }, []);

  const handleSaveTask = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = String(form.get("category") || "Ta’lim");
    const nextTask: TaskItem = {
      ...editingTask,
      id: editingTask?.id ?? createItemId(),
      title: String(form.get("title")),
      time: String(form.get("time") || "09:00"),
      category,
      priority: String(form.get("priority") || "Orta"),
      status: editingTask?.status ?? "Kutilmoqda",
      date: String(form.get("date") || selectedDate || todayISO()),
    };
    updateSection(
      "tasks",
      editingTaskKey
        ? data.tasks.map((task) => taskKey(task) === editingTaskKey ? nextTask : task)
        : [nextTask, ...data.tasks],
    );
    closeModal();
    event.currentTarget.reset();
  }, [closeModal, data.tasks, editingTask, editingTaskKey, selectedDate, updateSection]);

  const openStatusModal = useCallback((key: string) => {
    const task = data.tasks.find((item) => taskKey(item) === key);
    setStatusTaskKey(key);
    setStatusChoice(task?.status === "Bajarildi" ? "completed" : task?.status === "Bajarilmadi" ? "missed" : null);
    setStatusNote(task?.status_note ?? task?.completed_note ?? "");
    setStatusWarning(null);
  }, [data.tasks]);
  const closeStatusModal = useCallback(() => {
    setStatusTaskKey(null);
    setStatusChoice(null);
    setStatusNote("");
    setStatusWarning(null);
  }, []);
  const statusNoteIsValid = countStatusNoteWords(statusNote) >= MIN_STATUS_NOTE_WORDS;
  const handleStatusNoteChange = useCallback((value: string) => {
    setStatusNote(value);
    if (countStatusNoteWords(value) >= MIN_STATUS_NOTE_WORDS) {
      setStatusWarning(null);
    }
  }, []);
  const handleChooseStatus = useCallback((choice: "completed" | "missed") => {
    if (!statusNoteIsValid) {
      setStatusWarning(t("statusNoteWarning"));
      return;
    }

    setStatusChoice(choice);
    setStatusWarning(null);
  }, [statusNoteIsValid, t]);
  const handleSaveTaskStatus = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!statusTaskKey || !statusChoice || !statusNoteIsValid) {
      setStatusWarning(t("statusNoteWarning"));
      return;
    }

    const note = statusNote.trim();

    updateSection(
      "tasks",
      data.tasks.map((task) =>
        taskKey(task) === statusTaskKey ? {
          ...task,
          status: statusChoice === "completed" ? "Bajarildi" : "Bajarilmadi",
          status_result: statusChoice,
          status_note: note,
          completed_note: statusChoice === "completed" ? note : undefined,
        } : task,
      ),
    );
    closeStatusModal();
  }, [closeStatusModal, data.tasks, statusChoice, statusNote, statusNoteIsValid, statusTaskKey, t, updateSection]);
  const handleDeleteTask = useCallback((key: string) => {
    setDeleteError(null);

    try {
      updateSection("tasks", data.tasks.filter((task) => taskKey(task) !== key));
    } catch {
      setDeleteError(c("deleteErrorPlan"));
    }
  }, [c, data.tasks, updateSection]);
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => {
      const order = { Kutilmoqda: 0, Bajarilmadi: 1, Bajarildi: 2 } as const;
      const statusOrder = (order[a.status] ?? 0) - (order[b.status] ?? 0);

      if (statusOrder !== 0) {
        return statusOrder;
      }

      return taskTimeOrder(a.time) - taskTimeOrder(b.time);
    }),
    [tasks],
  );
  const categoryOptions = [
    { value: "Ta’lim", label: cat("education") },
    { value: "Moliya", label: cat("finance") },
    { value: "Shaxsiy", label: cat("personal") },
    { value: "Sport", label: cat("sport") },
    { value: "Ish faoliyati", label: cat("workActivity") },
    { value: "Karyera", label: cat("career") },
  ];
  const visibleTasks = expandedLists.tasks ? sortedTasks : sortedTasks.slice(0, 4);
  const visibleCategories = expandedLists.categories ? categories : categories.slice(0, 4);
  const priorityOptions = [
    { value: "Muhim", label: priorityT("high") },
    { value: "Orta", label: priorityT("medium") },
    { value: "Past", label: priorityT("low") },
  ];
  const categoryLabel = (value: string) => categoryOptions.find((item) => item.value === normalizeTaskCategory(value))?.label ?? normalizeTaskCategory(value);
  const priorityLabel = (value: string) => priorityOptions.find((item) => item.value === value)?.label ?? value;

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <DateInput value={selectedDate} onChange={setSelectedDate} />
            <PrimaryButton icon={Plus} onClick={openNewTask}>{t("new")}</PrimaryButton>
          </div>
        }
      />
      <DataState loading={loading} error={error} />
      {deleteError ? <div className="mb-4 rounded-2xl border border-red-300/16 bg-red-500/10 px-4 py-3 text-sm text-red-200">{deleteError}</div> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={t("progress")} value={`${progress}%`} detail={`${completed} / ${tasks.length}`} icon={Target} tone="blue" />
        <StatCard title={t("aiScore")} value={plansAi.analysis?.score === null || plansAi.analysis?.score === undefined ? "-" : `${plansAi.analysis.score}/100`} detail={plansAi.analysis ? shortDateLabel(selectedDate) : t("aiUnavailableDetail")} icon={CalendarCheck} tone="violet" variant="ai" />
        <StatCard title={t("completed")} value={`${completed}`} detail={t("completed")} icon={CalendarCheck} tone="green" />
        <StatCard title={t("pending")} value={`${pending}`} detail={t("pending")} icon={Clock3} tone="amber" />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card alive variant="plan">
            <h2 className="mb-5 text-xl font-bold">{t("tasks")}</h2>
            <LayoutGroup>
              <div className="space-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {visibleTasks.map((task) => {
                    const meta = taskMeta[normalizeTaskCategory(task.category) as keyof typeof taskMeta] ?? taskMeta.Shaxsiy;
                    const Icon = meta.icon;
                    const isDone = task.status === "Bajarildi";
                    const isMissed = task.status === "Bajarilmadi";

                    return (
                      <motion.div
                        layout="position"
                        initial={false}
                        animate={{ opacity: isDone ? 0.9 : 1, scale: 1, y: 0 }}
                        transition={{
                          layout: { duration: 0.22, ease: "easeOut" },
                          opacity: { duration: 0.2, ease: "easeOut" },
                          scale: { duration: 0.2, ease: "easeOut" },
                          y: { duration: 0.2, ease: "easeOut" },
                        }}
                        key={taskKey(task)}
                        className={`flex min-h-12 w-full min-w-0 transform-gpu flex-col gap-3 rounded-2xl border p-4 text-left shadow-[0_16px_34px_rgba(0,0,0,.16),inset_0_1px_0_rgba(255,255,255,.07)] transition duration-300 ease-out hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between ${
                          isDone
                            ? "border-emerald-300/34 bg-[linear-gradient(135deg,rgba(16,185,129,.24),rgba(34,211,238,.09),rgba(124,58,237,.035))] shadow-[0_18px_44px_rgba(16,185,129,.11),inset_0_1px_0_rgba(255,255,255,.10)] hover:border-emerald-300/42 hover:shadow-[0_20px_48px_rgba(16,185,129,.16),inset_0_1px_0_rgba(255,255,255,.11)]"
                            : isMissed
                              ? "border-rose-300/30 bg-[linear-gradient(135deg,rgba(239,68,68,.18),rgba(244,63,94,.12),rgba(124,58,237,.025))] shadow-[0_18px_42px_rgba(244,63,94,.11),inset_0_1px_0_rgba(255,255,255,.09)] hover:border-rose-300/42 hover:shadow-[0_20px_46px_rgba(244,63,94,.15),inset_0_1px_0_rgba(255,255,255,.10)]"
                              : "border-violet-300/12 bg-[linear-gradient(135deg,rgba(255,255,255,.055),rgba(124,58,237,.028))] hover:border-violet-300/20 hover:bg-violet-500/[0.052]"
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-4 text-left">
                          <button
                            type="button"
                            onClick={() => openStatusModal(taskKey(task))}
                            aria-pressed={isDone || isMissed}
                            aria-label={isDone ? t("statusDone") : isMissed ? t("statusMissed") : t("pending")}
                            className={`inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition duration-300 ease-out active:scale-95 ${
                              isDone
                                ? "border-emerald-200/44 bg-[linear-gradient(135deg,rgba(16,185,129,.42),rgba(34,211,238,.22))] text-emerald-50 shadow-[0_0_24px_rgba(16,185,129,.22),inset_0_1px_0_rgba(255,255,255,.18)]"
                                : isMissed
                                  ? "border-rose-200/44 bg-[linear-gradient(135deg,rgba(239,68,68,.38),rgba(244,63,94,.20))] text-rose-50 shadow-[0_0_22px_rgba(244,63,94,.20),inset_0_1px_0_rgba(255,255,255,.16)]"
                                  : "border-violet-300/16 bg-white/[0.035] text-transparent hover:border-emerald-300/24 hover:bg-emerald-400/8"
                            }`}
                          >
                            {isMissed ? (
                              <X size={19} strokeWidth={2.7} className="scale-100 opacity-100 transition duration-200 ease-out" />
                            ) : (
                              <Check size={19} strokeWidth={2.7} className={`transition duration-200 ease-out ${isDone ? "scale-100 opacity-100" : "scale-75 opacity-0"}`} />
                            )}
                          </button>
                          <IconBadge icon={Icon} tone={meta.tone} />
                          <div className="min-w-0">
                            <p className={`break-words font-medium transition duration-300 ease-out ${isDone ? "text-emerald-100/75 line-through decoration-emerald-200/50" : isMissed ? "text-rose-100/80" : "text-[var(--app-text)]"}`}>{task.title}</p>
                            <p className={`mt-1 flex flex-wrap items-center gap-2 text-sm transition duration-300 ease-out ${isDone ? "text-emerald-200/55" : isMissed ? "text-rose-200/60" : "text-slate-500"}`}>
                              <Clock3 size={14} /> {task.time}
                            </p>
                          </div>
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-lg border border-violet-300/10 bg-violet-500/10 px-3 py-2 text-violet-300">{categoryLabel(task.category)}</span>
                          <span className="rounded-lg border border-fuchsia-300/10 bg-fuchsia-500/10 px-3 py-2 text-fuchsia-200">{priorityLabel(task.priority)}</span>
                          <EditButton onClick={() => openEditTask(taskKey(task))} />
                          <ConfirmDeleteButton onConfirm={() => handleDeleteTask(taskKey(task))} />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {!visibleTasks.length ? <EmptyState /> : null}
              </div>
            </LayoutGroup>
            {tasks.length > 4 ? <ShowMoreButton expanded={expandedLists.tasks} onClick={() => setExpandedLists((current) => ({ ...current, tasks: !current.tasks }))} /> : null}
          </Card>

          <Card variant="plan">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="min-w-0 break-words text-xl font-bold">{t("weeklyProgress")}</h2>
              <span className="rounded-2xl border border-violet-300/15 bg-violet-500/10 px-3.5 py-2 text-xs font-medium text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">{c("thisWeek")}</span>
            </div>
            {dynamicProgressData.length ? (
              <ChartFrame className="h-[230px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%" debounce={80}>
                  <LineChart data={dynamicProgressData}>
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
        </div>

        <div className="min-w-0 space-y-6">
          <Card alive variant="ai">
            <h2 className="mb-5 text-lg font-bold">{t("goalProgress")}</h2>
            <ProgressBar value={progress} color="bg-violet-400" />
            <p className="mt-3 text-sm text-slate-400">{t("completedCount", { completed, total: tasks.length })}</p>
          </Card>

          <Card variant="plan">
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

          <Card variant="ai">
            <h2 className="mb-3 text-lg font-bold">{t("aiAdvice")}</h2>
            <AiAnalysisContent {...plansAi} />
          </Card>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingTask ? modals("editPlanTitle") : t("newPlan")}
        description={t("modalDescription")}
      >
        <form key={editingTaskKey ?? "new-task"} onSubmit={handleSaveTask} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>{t("taskName")}</label>
              <input name="title" className={fieldClass} placeholder={t("exampleTask")} defaultValue={editingTask?.title ?? ""} required />
            </div>
            <div>
              <label className={labelClass}>{t("time")}</label>
              <input name="time" type="time" className={fieldClass} defaultValue={editingTask?.time ?? "20:00"} />
            </div>
            <div>
              <label className={labelClass}>{c("date")}</label>
              <input name="date" type="date" className={fieldClass} defaultValue={editingTask?.date ?? selectedDate} />
            </div>
            <div>
              <label className={labelClass}>{t("category")}</label>
              <select name="category" className={fieldClass} defaultValue={normalizeTaskCategory(editingTask?.category ?? "Ta’lim")}>
                {categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("priority")}</label>
              <select name="priority" className={fieldClass} defaultValue={editingTask?.priority ?? "Muhim"}>
                {priorityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryButton icon={Plus} type="submit">{editingTask ? c("save") : t("save")}</PrimaryButton>
            <button type="button" onClick={closeModal} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-violet-300/14 bg-white/[0.035] px-5 py-3 text-sm font-semibold text-slate-300 transition duration-400 hover:border-violet-300/24 hover:bg-white/[0.06]">
              {c("cancel")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(statusTask)}
        onClose={closeStatusModal}
        title={t("statusModalTitle")}
        description={statusTask?.title ?? ""}
      >
        <form key={statusTaskKey ?? "task-status"} onSubmit={handleSaveTaskStatus} className="space-y-5">
          {statusWarning ? (
            <div className="rounded-2xl border border-rose-300/18 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
              {statusWarning}
            </div>
          ) : null}

          <div>
            <label className={labelClass}>{statusChoice === "completed" ? t("doneQuestion") : statusChoice === "missed" ? t("missedQuestion") : t("statusNoteQuestion")}</label>
            <textarea
              name="status_note"
              className={`${fieldClass} min-h-28 resize-none`}
              placeholder={statusChoice === "missed" ? t("missedPlaceholder") : statusChoice === "completed" ? t("donePlaceholder") : t("statusNotePlaceholder")}
              value={statusNote}
              onChange={(event) => handleStatusNoteChange(event.target.value)}
            />
            <p className={`mt-2 text-xs transition duration-300 ${statusNoteIsValid ? "text-emerald-300/80" : "text-slate-500"}`}>
              {t("statusWordCount", { count: countStatusNoteWords(statusNote), min: MIN_STATUS_NOTE_WORDS })}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleChooseStatus("completed")}
              className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition duration-300 ease-out active:scale-[0.98] ${
                statusChoice === "completed"
                  ? "border-emerald-300/36 bg-[linear-gradient(135deg,rgba(16,185,129,.22),rgba(34,211,238,.08))] text-emerald-100 shadow-[0_0_28px_rgba(16,185,129,.14),inset_0_1px_0_rgba(255,255,255,.12)]"
                  : "border-violet-300/14 bg-white/[0.035] text-slate-300 hover:border-emerald-300/24 hover:bg-emerald-400/8"
              }`}
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200/28 bg-emerald-400/12 text-emerald-100">
                <Check size={18} strokeWidth={2.6} />
              </span>
              {t("statusDone")}
            </button>
            <button
              type="button"
              onClick={() => handleChooseStatus("missed")}
              className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition duration-300 ease-out active:scale-[0.98] ${
                statusChoice === "missed"
                  ? "border-rose-300/38 bg-[linear-gradient(135deg,rgba(239,68,68,.22),rgba(244,63,94,.11))] text-rose-100 shadow-[0_0_28px_rgba(244,63,94,.14),inset_0_1px_0_rgba(255,255,255,.12)]"
                  : "border-violet-300/14 bg-white/[0.035] text-slate-300 hover:border-rose-300/24 hover:bg-rose-400/8"
              }`}
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-200/30 bg-rose-400/12 text-rose-100">
                <X size={18} strokeWidth={2.6} />
              </span>
              {t("statusMissed")}
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryButton disabled={!statusChoice || !statusNoteIsValid} type="submit">{c("save")}</PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
