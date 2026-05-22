"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, BookOpen, CreditCard, Target, Wallet, AlertTriangle } from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { AiAnalysisContent } from "../components/ai-analysis-content";
import { ChartFrame } from "../components/chart-frame";
import { DataState } from "../components/data-state";
import { Card, ConfirmDeleteButton, DateInput, EditButton, EmptyState, fieldClass, labelClass, IconBadge, Modal, PageHeader, PrimaryButton, ProgressBar, ShowMoreButton, StatCard } from "../components/ui";
import { useAppData } from "../hooks/use-app-data";
import { useAiAnalysis } from "../hooks/use-ai-analysis";
import { ensureFinanceCarryOver } from "../../lib/app-data";
import { formatMoney } from "../../lib/format";
import { isSameDate, shortDateLabel, todayISO } from "../utils/date";
import { taskKey, transactionKey } from "../utils/items";

const chartColors = ["#ef4444", "#c084fc", "#22c55e", "#f59e0b", "#a78bfa", "#38bdf8"];
const expenseCategoryKeys = ["food", "fastFood", "transport", "book", "clothes", "home", "health", "education", "entertainment", "other"] as const;
type SpendingPeriod = "week" | "month";

function transactionAmount(amount: number) {
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
}

function parseISODate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

function currentExpenseRange(period: SpendingPeriod) {
  const today = parseISODate(todayISO());

  if (period === "month") {
    return {
      start: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: toISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }

  const start = startOfWeek(today);

  return {
    start: toISODate(start),
    end: toISODate(addDays(start, 6)),
  };
}

function isInRange(value: string | null | undefined, start: string, end: string) {
  const date = value?.slice(0, 10) ?? "";
  return date >= start && date <= end;
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const c = useTranslations("common");
  const cat = useTranslations("categories");
  const modals = useTranslations("modals");
  const { data, loading, error, hasLoaded, updateSection } = useAppData();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [editingTransactionKey, setEditingTransactionKey] = useState<string | null>(null);
  const [editingTaskKey, setEditingTaskKey] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [expandedLists, setExpandedLists] = useState({ expenses: false, habits: false, tasks: false, reminders: false });
  const [spendingPeriod, setSpendingPeriod] = useState<SpendingPeriod>("week");
  const dashboardAi = useAiAnalysis({ anchorDate: selectedDate, period: "week", scope: "dashboard" });
  const transactionsForDate = useMemo(
    () => data.finance.transactions.filter((item) => isSameDate(item.date, selectedDate)),
    [data.finance.transactions, selectedDate],
  );
  const expensesForDate = useMemo(
    () => transactionsForDate.filter((item) => item.type === "expense"),
    [transactionsForDate],
  );
  const tasks = useMemo(
    () => data.tasks.filter((task) => isSameDate(task.date, selectedDate)).map((task) => ({ key: taskKey(task), title: task.title, time: task.time, done: task.status === "Bajarildi" })),
    [data.tasks, selectedDate],
  );
  const errorsForDate = useMemo(
    () => data.journal.errors.filter((item) => isSameDate(item.date, selectedDate)),
    [data.journal.errors, selectedDate],
  );
  const dailySummary = useMemo(
    () => data.journal.daily_summaries.find((item) => isSameDate(item.date, selectedDate)),
    [data.journal.daily_summaries, selectedDate],
  );
  const editingTransaction = useMemo(
    () => editingTransactionKey ? data.finance.transactions.find((item) => transactionKey(item) === editingTransactionKey) : null,
    [data.finance.transactions, editingTransactionKey],
  );
  const editingTask = useMemo(
    () => editingTaskKey ? data.tasks.find((task) => taskKey(task) === editingTaskKey) : null,
    [data.tasks, editingTaskKey],
  );
  const { income, expense } = useMemo(() => {
    const totalIncome = data.finance.transactions
      .filter((item) => item.type === "income" && item.isCarryOver !== true)
      .reduce((sum, item) => sum + transactionAmount(item.amount), 0);
    const totalExpense = data.finance.transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + transactionAmount(item.amount), 0);

    return {
      income: totalIncome,
      expense: totalExpense,
    };
  }, [data.finance.transactions]);
  const dailyRealIncome = useMemo(
    () => transactionsForDate
      .filter((item) => item.type === "income" && item.isCarryOver !== true)
      .reduce((sum, item) => sum + transactionAmount(item.amount), 0),
    [transactionsForDate],
  );
  const dailyExpense = useMemo(
    () => expensesForDate.reduce((sum, item) => sum + transactionAmount(item.amount), 0),
    [expensesForDate],
  );
  const dailyScore = useMemo(() => {
    const completedPlans = tasks.filter((task) => task.done).length;
    const hasPlanData = tasks.length > 0;
    const hasFinanceData = dailyRealIncome > 0 || dailyExpense > 0;
    const hasMistakeData = errorsForDate.length > 0;

    if (!hasPlanData && !hasFinanceData && !hasMistakeData) {
      return 0;
    }

    const completedPlansRatio = hasPlanData ? completedPlans / tasks.length : 0.5;
    const expensesWithinIncome = hasFinanceData
      ? dailyExpense <= dailyRealIncome
        ? 1
        : dailyRealIncome > 0
          ? dailyRealIncome / dailyExpense
          : 0.35
      : 0.5;
    const mistakesPenalty = Math.max(0, 1 - errorsForDate.length * 0.15);

    return Math.round((completedPlansRatio * 0.45 + expensesWithinIncome * 0.35 + mistakesPenalty * 0.2) * 100);
  }, [dailyExpense, dailyRealIncome, errorsForDate.length, tasks]);
  const expenseRange = useMemo(() => currentExpenseRange(spendingPeriod), [spendingPeriod]);
  const periodExpenses = useMemo(
    () => data.finance.transactions.filter((item) => item.type === "expense" && isInRange(item.date, expenseRange.start, expenseRange.end)),
    [data.finance.transactions, expenseRange],
  );
  const periodExpenseTotal = useMemo(
    () => periodExpenses.reduce((sum, item) => sum + transactionAmount(item.amount), 0),
    [periodExpenses],
  );
  const expenseTrend = useMemo(() => {
    const grouped = periodExpenses.reduce<Record<string, number>>((acc, item) => {
      const key = item.date?.slice(0, 10) || expenseRange.start;
      acc[key] = (acc[key] ?? 0) + transactionAmount(item.amount);
      return acc;
    }, {});

    const points: { day: string; value: number }[] = [];
    let current = parseISODate(expenseRange.start);
    const end = parseISODate(expenseRange.end);

    while (current <= end) {
      const key = toISODate(current);
      points.push({ day: shortDateLabel(key), value: grouped[key] ?? 0 });
      current = addDays(current, 1);
    }

    return points;
  }, [expenseRange, periodExpenses]);
  const habits = useMemo(() => {
    const grouped = errorsForDate.reduce<Record<string, number>>((acc, item) => {
      const key = item.category || c("other");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value], index) => ({
      name,
      value,
      color: chartColors[index % chartColors.length],
    }));
  }, [c, errorsForDate]);
  const reminders = useMemo(() => {
    const items: string[] = [];
    const pendingTasks = tasks.filter((task) => !task.done);

    if (pendingTasks.length) {
      items.push(t("reminderPendingPlans", { count: pendingTasks.length }));
    }

    if (dailyExpense > 0) {
      items.push(t("reminderExpense", { date: shortDateLabel(selectedDate), amount: formatMoney(dailyExpense) }));
    }

    if (errorsForDate.length) {
      items.push(t("reminderMistakes", { count: errorsForDate.length }));
    }

    return items;
  }, [dailyExpense, errorsForDate.length, selectedDate, t, tasks]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    const nextTransactions = ensureFinanceCarryOver(data.finance.transactions, selectedDate);

    if (nextTransactions !== data.finance.transactions) {
      updateSection("finance", {
        ...data.finance,
        transactions: nextTransactions,
      });
    }
  }, [data.finance, hasLoaded, selectedDate, updateSection]);

  const toggleTask = useCallback((key: string) => {
    const nextTasks = data.tasks.map((task) =>
      taskKey(task) === key ? { ...task, status: task.status === "Bajarildi" ? "Kutilmoqda" as const : "Bajarildi" as const } : task,
    );
    updateSection("tasks", nextTasks);
  }, [data.tasks, updateSection]);
  const handleDeleteTransaction = useCallback((key: string) => {
    setDeleteError("");
    try {
      updateSection("finance", {
        ...data.finance,
        transactions: data.finance.transactions.filter((item) => transactionKey(item) !== key),
      });
    } catch {
      setDeleteError(c("deleteErrorTransaction"));
    }
  }, [c, data.finance, updateSection]);
  const handleDeleteTask = useCallback((key: string) => {
    setDeleteError("");
    try {
      updateSection("tasks", data.tasks.filter((task) => taskKey(task) !== key));
    } catch {
      setDeleteError(c("deleteErrorPlan"));
    }
  }, [c, data.tasks, updateSection]);
  const handleSaveTransaction = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTransactionKey || !editingTransaction) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") || 0);
    const category = String(form.get("category") || c("other"));
    updateSection("finance", {
      ...data.finance,
      transactions: data.finance.transactions.map((item) => transactionKey(item) === editingTransactionKey ? {
        ...item,
        title: category,
        category,
        amount: Number.isFinite(amount) ? amount : 0,
        note: String(form.get("note") || ""),
        date: String(form.get("date") || selectedDate || todayISO()),
      } : item),
    });
    setEditingTransactionKey(null);
  }, [c, data.finance, editingTransaction, editingTransactionKey, selectedDate, updateSection]);
  const handleSaveTask = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTaskKey || !editingTask) {
      return;
    }

    const form = new FormData(event.currentTarget);
    updateSection("tasks", data.tasks.map((task) => taskKey(task) === editingTaskKey ? {
      ...task,
      title: String(form.get("title") || task.title),
      time: String(form.get("time") || task.time),
      date: String(form.get("date") || selectedDate || todayISO()),
    } : task));
    setEditingTaskKey(null);
  }, [data.tasks, editingTask, editingTaskKey, selectedDate, updateSection]);
  const visibleExpenses = expandedLists.expenses ? expensesForDate : expensesForDate.slice(0, 4);
  const visibleHabits = expandedLists.habits ? habits : habits.slice(0, 4);
  const visibleTasks = expandedLists.tasks ? tasks : tasks.slice(0, 4);
  const visibleReminders = expandedLists.reminders ? reminders : reminders.slice(0, 4);
  const expenseCategories = expenseCategoryKeys.map((key) => cat(key));

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={data.profile_data.name}
        description={t("description")}
        action={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <DateInput value={selectedDate} onChange={setSelectedDate} />
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className="flex min-h-12 transform-gpu items-center justify-center gap-3 rounded-lg border border-violet-300/12 bg-white/[0.035] px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,.18)] transition duration-500 hover:border-violet-300/22 hover:bg-white/[0.065] hover:shadow-[0_16px_42px_rgba(109,40,217,.12)]"
            >
              <Bell size={18} className="text-slate-400" />
              <span className="text-sm text-slate-300">{t("remindersCount", { count: reminders.length })}</span>
            </button>
          </div>
        }
      />
      <DataState loading={loading} error={error} />
      {deleteError ? (
        <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {deleteError}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title={t("monthlyIncome")} value={formatMoney(income)} detail={t("incomeDetail")} icon={Wallet} tone="green" />
        <StatCard title={t("monthlyExpense")} value={formatMoney(expense)} detail={t("expenseDetail")} icon={CreditCard} tone="red" />
        <StatCard title={t("productivityTitle")} value={`${dailyScore}%`} detail={t("productivityDetail")} icon={Target} tone="blue" variant="plan" />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card variant="expense">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSpendingPeriod((current) => current === "week" ? "month" : "week")}
                className="min-w-0 break-words text-left text-xl font-bold transition duration-400 hover:text-violet-200"
              >
                {spendingPeriod === "week" ? t("weeklySpending") : t("monthlySpending")}
              </button>
              <button
                type="button"
                onClick={() => setSpendingPeriod((current) => current === "week" ? "month" : "week")}
                className="rounded-2xl border border-violet-300/15 bg-violet-500/10 px-3.5 py-2 text-xs font-medium text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition duration-400 hover:border-violet-300/25 hover:bg-violet-500/15"
              >
                {spendingPeriod === "week" ? c("thisWeek") : c("thisMonth")} · {formatMoney(periodExpenseTotal)}
              </button>
            </div>
            {periodExpenseTotal > 0 ? (
              <ChartFrame className="h-[240px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%" debounce={80}>
                  <LineChart data={expenseTrend}>
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

          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            <Card variant="expense">
              <h2 className="mb-5 text-xl font-bold">{t("recentExpenses")}</h2>
              <div className="space-y-4">
                {visibleExpenses.map((item) => (
                  <div key={transactionKey(item)} className="relative flex min-w-0 flex-col gap-2 border-b border-white/5 pb-3 pl-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                    <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-violet-300/70 shadow-[0_0_14px_rgba(196,181,253,.28)]" />
                    <div className="min-w-0">
                      <p className="break-words font-medium">{item.title}</p>
                      <p className="text-sm text-slate-500">{shortDateLabel(item.date)} · {item.category || "Xarajat"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                      <p className="break-words font-semibold text-red-300 sm:text-right">-{formatMoney(item.amount)}</p>
                      <EditButton onClick={() => setEditingTransactionKey(transactionKey(item))} />
                      <ConfirmDeleteButton onConfirm={() => handleDeleteTransaction(transactionKey(item))} />
                    </div>
                  </div>
                ))}
                {!visibleExpenses.length ? <EmptyState /> : null}
              </div>
              {expensesForDate.length > 4 ? <ShowMoreButton expanded={expandedLists.expenses} onClick={() => setExpandedLists((current) => ({ ...current, expenses: !current.expenses }))} /> : null}
            </Card>

            <Card variant="mistake">
              <h2 className="mb-5 text-xl font-bold">{t("mistakeStats")}</h2>
              {habits.length ? <div className="flex min-w-0 flex-col items-start gap-5 sm:flex-row sm:items-center">
                <ChartFrame className="h-[150px] w-full max-w-[170px] sm:h-[170px] sm:w-[170px]">
                  <ResponsiveContainer width="100%" height="100%" debounce={80}>
                    <PieChart>
                      <Pie data={habits} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3} isAnimationActive animationDuration={420}>
                        {visibleHabits.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </ChartFrame>
                <div className="min-w-0 space-y-3">
                  {visibleHabits.map((item) => (
                    <div key={item.name} className="flex min-w-0 items-center gap-3 text-sm text-slate-300">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="break-words">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div> : <EmptyState />}
              {habits.length > 4 ? <ShowMoreButton expanded={expandedLists.habits} onClick={() => setExpandedLists((current) => ({ ...current, habits: !current.habits }))} /> : null}
            </Card>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <Card alive variant="ai">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-violet-300">
              <IconBadge icon={AlertTriangle} tone="violet" size="sm" /> {t("aiAdvice")}
            </p>
            <AiAnalysisContent {...dashboardAi} />
            <div className="mt-5">
              <ProgressBar value={dashboardAi.analysis?.score ?? 0} />
              <p className="mt-2 text-right text-sm text-violet-300">{dashboardAi.analysis?.score ?? 0}%</p>
            </div>
          </Card>

          <Card alive variant="plan">
            <h2 className="mb-5 text-lg font-bold">{t("todayPlans")}</h2>
            <div className="space-y-4">
              {visibleTasks.map((task) => (
                <div
                  key={task.key}
                  className="flex min-h-12 w-full min-w-0 transform-gpu flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,.12),inset_0_1px_0_rgba(255,255,255,.04)] transition duration-[420ms] ease-out hover:-translate-y-0.5 hover:border-violet-300/20 hover:bg-violet-500/[0.055] sm:flex-row sm:items-center sm:justify-between"
                >
                  <button type="button" onClick={() => toggleTask(task.key)} className="min-w-0 flex-1 text-left">
                    <span className={`break-words ${task.done ? "text-slate-500 line-through" : "text-slate-200"}`}>{task.title}</span>
                  </button>
                  <span className="flex shrink-0 items-center gap-2 text-sm text-violet-300">
                    {task.time}
                    <EditButton onClick={() => setEditingTaskKey(task.key)} />
                    <ConfirmDeleteButton onConfirm={() => handleDeleteTask(task.key)} />
                  </span>
                </div>
              ))}
              {!visibleTasks.length ? <EmptyState /> : null}
            </div>
            {tasks.length > 4 ? <ShowMoreButton expanded={expandedLists.tasks} onClick={() => setExpandedLists((current) => ({ ...current, tasks: !current.tasks }))} /> : null}
          </Card>

          <Card alive variant="reflection">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-violet-300">
              <IconBadge icon={BookOpen} tone="blue" size="sm" /> {t("dailySummary")}
            </p>
            <p className="text-sm leading-6 text-slate-300">
              {dailySummary?.summary || t("dailySummaryText")}
            </p>
          </Card>
        </div>
      </div>

      <Modal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        title={t("remindersTitle")}
        description={t("remindersDescription")}
      >
        <div className="space-y-3">
          {visibleReminders.map((item) => (
            <div key={item} className="rounded-2xl border border-violet-300/14 bg-[linear-gradient(135deg,rgba(255,255,255,.065),rgba(168,85,247,.035))] p-4 text-sm text-slate-300 shadow-[0_16px_32px_rgba(0,0,0,.18),inset_0_1px_0_rgba(255,255,255,.08)]">
              {item}
            </div>
          ))}
          {!visibleReminders.length ? <EmptyState /> : null}
          {reminders.length > 4 ? <ShowMoreButton expanded={expandedLists.reminders} onClick={() => setExpandedLists((current) => ({ ...current, reminders: !current.reminders }))} /> : null}
          <PrimaryButton onClick={() => setNotificationsOpen(false)}>{c("close")}</PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={Boolean(editingTransaction)}
        onClose={() => setEditingTransactionKey(null)}
        title={modals("editExpenseTitle")}
        description={modals("editExpenseDescription")}
      >
        <form key={editingTransactionKey ?? "expense-edit"} onSubmit={handleSaveTransaction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{c("amount")}</label>
              <input name="amount" type="number" min="1" className={fieldClass} defaultValue={editingTransaction?.amount ?? ""} required />
            </div>
            <div>
              <label className={labelClass}>{c("date")}</label>
              <input name="date" type="date" className={fieldClass} defaultValue={editingTransaction?.date ?? selectedDate} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{c("category")}</label>
              <select name="category" className={fieldClass} defaultValue={editingTransaction?.category || c("other")}>
                {expenseCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{c("note")}</label>
              <input name="note" className={fieldClass} defaultValue={editingTransaction?.note ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryButton type="submit">{c("save")}</PrimaryButton>
            <button type="button" onClick={() => setEditingTransactionKey(null)} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-violet-300/14 bg-white/[0.035] px-5 py-3 text-sm font-semibold text-slate-300 transition duration-400 hover:border-violet-300/24 hover:bg-white/[0.06]">
              {c("cancel")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingTask)}
        onClose={() => setEditingTaskKey(null)}
        title={modals("editPlanTitle")}
        description={modals("editPlanDescription")}
      >
        <form key={editingTaskKey ?? "task-edit"} onSubmit={handleSaveTask} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>{c("title")}</label>
              <input name="title" className={fieldClass} defaultValue={editingTask?.title ?? ""} required />
            </div>
            <div>
              <label className={labelClass}>{c("time")}</label>
              <input name="time" type="time" className={fieldClass} defaultValue={editingTask?.time ?? "09:00"} />
            </div>
            <div>
              <label className={labelClass}>{c("date")}</label>
              <input name="date" type="date" className={fieldClass} defaultValue={editingTask?.date ?? selectedDate} />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryButton type="submit">{c("save")}</PrimaryButton>
            <button type="button" onClick={() => setEditingTaskKey(null)} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-violet-300/14 bg-white/[0.035] px-5 py-3 text-sm font-semibold text-slate-300 transition duration-400 hover:border-violet-300/24 hover:bg-white/[0.06]">
              {c("cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
