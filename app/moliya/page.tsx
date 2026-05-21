"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownCircle, CreditCard, Plus, Target, TrendingUp, TriangleAlert, Wallet } from "lucide-react";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AiAnalysisContent } from "../components/ai-analysis-content";
import { ChartFrame } from "../components/chart-frame";
import { DataState } from "../components/data-state";
import { Card, ConfirmDeleteButton, DateInput, EditButton, EmptyState, fieldClass, IconBadge, labelClass, Modal, PageHeader, PrimaryButton, ProgressBar, ShowMoreButton, StatCard } from "../components/ui";
import { useAiAnalysis } from "../hooks/use-ai-analysis";
import { useAppData } from "../hooks/use-app-data";
import { ensureFinanceCarryOver, type FinanceTransaction } from "../../lib/app-data";
import { formatMoney } from "../../lib/format";
import { isSameDate, todayISO } from "../utils/date";
import { createItemId, transactionKey } from "../utils/items";

const chartColors = ["#ef4444", "#c084fc", "#22c55e", "#f59e0b", "#a78bfa", "#38bdf8"];
const expenseCategoryKeys = ["food", "fastFood", "transport", "book", "clothes", "home", "health", "education", "entertainment", "other"] as const;

type TransactionModal = {
  type: "income" | "expense";
  editKey?: string;
} | null;

function safeAmount(amount: number) {
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
}

export default function MoliyaPage() {
  const t = useTranslations("finance");
  const c = useTranslations("common");
  const cat = useTranslations("categories");
  const { data, loading, error, hasLoaded, updateSection } = useAppData();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [modal, setModal] = useState<TransactionModal>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expandedLists, setExpandedLists] = useState({ transactions: false, categories: false });
  const financeAi = useAiAnalysis({ anchorDate: selectedDate, period: "week", scope: "finance" });
  const transactions = useMemo(
    () => data.finance.transactions.filter((item) => isSameDate(item.date, selectedDate)),
    [data.finance.transactions, selectedDate],
  );
  const editingTransaction = useMemo(
    () => modal?.editKey ? data.finance.transactions.find((item) => transactionKey(item) === modal.editKey) : null,
    [data.finance.transactions, modal],
  );

  const totals = useMemo(() => {
    const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + safeAmount(item.amount), 0);
    const expense = transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + safeAmount(item.amount), 0);

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [transactions]);
  const transactionTrendData = useMemo(
    () => transactions.map((item, index) => ({ day: item.category || `${index + 1}`, value: safeAmount(item.amount) })),
    [transactions],
  );
  const expenseCategoryData = useMemo(() => {
    const grouped = transactions.filter((item) => item.type === "expense").reduce<Record<string, number>>((acc, item) => {
      const key = item.category || c("other");
      acc[key] = (acc[key] ?? 0) + safeAmount(item.amount);
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value], index) => ({
      name,
      value,
      color: chartColors[index % chartColors.length],
    }));
  }, [c, transactions]);

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

  const closeModal = useCallback(() => setModal(null), []);

  const handleSaveTransaction = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const category = modal.type === "expense" ? String(form.get("category") || c("other")) : "";
    const note = String(form.get("note") || "");
    const date = String(form.get("date") || selectedDate || todayISO());
    const nextTransaction: FinanceTransaction = {
      id: editingTransaction?.id ?? createItemId(),
      title: modal.type === "income" ? c("income") : category,
      category,
      amount,
      type: modal.type,
      note,
      date,
    };

    updateSection("finance", {
      ...data.finance,
      transactions: modal.editKey
        ? data.finance.transactions.map((item) => transactionKey(item) === modal.editKey ? nextTransaction : item)
        : [nextTransaction, ...data.finance.transactions],
    });
    closeModal();
    event.currentTarget.reset();
  }, [c, closeModal, data.finance, editingTransaction?.id, modal, selectedDate, updateSection]);

  const handleDeleteTransaction = useCallback((key: string) => {
    setDeleteError(null);

    try {
      updateSection("finance", {
        ...data.finance,
        transactions: data.finance.transactions.filter((item) => transactionKey(item) !== key),
      });
    } catch {
      setDeleteError(c("deleteErrorTransaction"));
    }
  }, [c, data.finance, updateSection]);
  const visibleTransactions = expandedLists.transactions ? transactions : transactions.slice(0, 4);
  const visibleCategories = expandedLists.categories ? expenseCategoryData : expenseCategoryData.slice(0, 4);
  const expenseCategories = expenseCategoryKeys.map((key) => cat(key));
  const modalTitle = modal?.editKey ? t("editTransaction") : modal?.type === "income" ? t("newIncome") : t("newExpense");

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <DateInput value={selectedDate} onChange={setSelectedDate} />
            <PrimaryButton icon={Plus} onClick={() => setModal({ type: "income" })}>{t("newIncome")}</PrimaryButton>
            <PrimaryButton icon={Plus} onClick={() => setModal({ type: "expense" })}>{t("newExpense")}</PrimaryButton>
          </div>
        }
      />
      <DataState loading={loading} error={error} />
      {deleteError ? <div className="mb-4 rounded-2xl border border-red-300/16 bg-red-500/10 px-4 py-3 text-sm text-red-200">{deleteError}</div> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title={t("income")} value={formatMoney(totals.income)} detail={t("selectedDateDetail")} icon={Wallet} tone="green" />
        <StatCard title={t("expense")} value={formatMoney(totals.expense)} detail={t("selectedDateDetail")} icon={ArrowDownCircle} tone="red" />
        <StatCard title={t("balance")} value={formatMoney(totals.balance)} detail={t("selectedDateDetail")} icon={CreditCard} tone="violet" variant="balance" />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card variant="expense">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="min-w-0 break-words text-xl font-bold">{t("spendingTrend")}</h2>
              <span className="rounded-2xl border border-violet-300/15 bg-violet-500/10 px-3.5 py-2 text-xs font-medium text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">{c("thisMonth")}</span>
            </div>
            {transactionTrendData.length ? (
              <ChartFrame className="h-[240px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%" debounce={80}>
                  <LineChart data={transactionTrendData}>
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
            <Card variant="balance">
              <h2 className="mb-5 text-xl font-bold">{t("recentTransactions")}</h2>
              <div className="space-y-4">
                {visibleTransactions.map((item, index) => (
                  <div key={`${transactionKey(item)}-${index}`} className="relative flex min-w-0 flex-col gap-3 border-b border-white/5 pb-3 pl-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                    <span className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${item.type === "income" ? "bg-emerald-300/75" : "bg-violet-300/75"} shadow-[0_0_14px_rgba(196,181,253,.25)]`} />
                    <div className="min-w-0">
                      <p className="break-words font-medium">{item.type === "income" ? c("income") : item.category || c("other")}</p>
                      <p className="break-words text-sm text-slate-500">{item.note || (item.type === "income" ? c("income") : item.category)} · {item.date}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:justify-end">
                      <p className={`break-words font-semibold sm:text-right ${item.type === "income" ? "text-emerald-300" : "text-red-300"}`}>
                        {item.type === "income" ? "+" : "-"}{formatMoney(safeAmount(item.amount))}
                      </p>
                      <EditButton onClick={() => setModal({ type: item.type, editKey: transactionKey(item) })} />
                      <ConfirmDeleteButton onConfirm={() => handleDeleteTransaction(transactionKey(item))} />
                    </div>
                  </div>
                ))}
                {!visibleTransactions.length ? <EmptyState /> : null}
              </div>
              {transactions.length > 4 ? <ShowMoreButton expanded={expandedLists.transactions} onClick={() => setExpandedLists((current) => ({ ...current, transactions: !current.transactions }))} /> : null}
            </Card>

            <Card variant="expense">
              <h2 className="mb-5 text-xl font-bold">{t("expenseCategories")}</h2>
              {expenseCategoryData.length ? <div className="flex min-w-0 flex-col items-start gap-5 sm:flex-row sm:items-center">
                <ChartFrame className="h-[150px] w-full max-w-[170px] sm:h-[170px] sm:w-[170px]">
                  <ResponsiveContainer width="100%" height="100%" debounce={80}>
                    <PieChart>
                      <Pie data={expenseCategoryData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3} isAnimationActive animationDuration={420}>
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
              {expenseCategoryData.length > 4 ? <ShowMoreButton expanded={expandedLists.categories} onClick={() => setExpandedLists((current) => ({ ...current, categories: !current.categories }))} /> : null}
            </Card>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <Card alive variant="plan">
            <div className="mb-5 flex min-w-0 items-center gap-3">
              <IconBadge icon={Target} tone="violet" size="lg" />
              <div className="min-w-0">
                <p className="text-sm text-slate-500">{t("savingGoal")}</p>
                <h2 className="break-words text-3xl font-bold">{formatMoney(Math.max(totals.balance, 0))}</h2>
              </div>
            </div>
            <ProgressBar value={0} />
            <p className="mt-3 text-sm text-slate-400">0%</p>
          </Card>

          <Card alive variant="warning">
            <p className="mb-3 flex items-center gap-2 font-semibold text-amber-300">
              <IconBadge icon={TriangleAlert} tone="amber" size="sm" /> {t("aiWarning")}
            </p>
            <AiAnalysisContent {...financeAi} />
          </Card>

          <Card variant="ai">
            <p className="mb-3 flex items-center gap-2 font-semibold text-violet-300">
              <IconBadge icon={TrendingUp} tone="violet" size="sm" /> {t("aiAdvice")}
            </p>
            <AiAnalysisContent {...financeAi} />
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(modal)}
        onClose={closeModal}
        title={modalTitle}
        description={modal?.type === "income" ? t("incomeDescription") : t("expenseDescription")}
      >
        <form key={`${modal?.type}-${modal?.editKey ?? "new"}`} onSubmit={handleSaveTransaction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("amountLabel")}</label>
              <input name="amount" type="number" min="1" className={fieldClass} placeholder="85000" defaultValue={editingTransaction?.amount ?? ""} required />
            </div>
            <div>
              <label className={labelClass}>{t("dateLabel")}</label>
              <input name="date" type="date" className={fieldClass} defaultValue={editingTransaction?.date ?? selectedDate} />
            </div>
            {modal?.type === "expense" ? (
              <div className="sm:col-span-2">
                <label className={labelClass}>{t("categoryLabel")}</label>
                <select name="category" className={fieldClass} defaultValue={editingTransaction?.category || cat("food")}>
                  {expenseCategories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <label className={labelClass}>{t("noteLabel")}</label>
              <input name="note" className={fieldClass} placeholder={t("shortNote")} defaultValue={editingTransaction?.note ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryButton icon={Plus} type="submit">{modal?.editKey ? c("save") : modal?.type === "income" ? t("saveIncome") : t("saveExpense")}</PrimaryButton>
            <button type="button" onClick={closeModal} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-violet-300/14 bg-white/[0.035] px-5 py-3 text-sm font-semibold text-slate-300 transition duration-400 hover:border-violet-300/24 hover:bg-white/[0.06]">
              {c("cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
