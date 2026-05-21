import { AppData, FinanceTransaction } from "./app-data";

export type AiPeriod = "week" | "month" | "year";

export type PeriodRange = {
  start: string;
  end: string;
};

export function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

export function getPeriodRange(period: AiPeriod, anchorDate: string): PeriodRange {
  const anchor = parseLocalDate(anchorDate);

  if (period === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { start: toISODate(start), end: toISODate(end) };
  }

  if (period === "year") {
    return {
      start: `${anchor.getFullYear()}-01-01`,
      end: `${anchor.getFullYear()}-12-31`,
    };
  }

  const start = startOfWeek(anchor);
  return { start: toISODate(start), end: toISODate(addDays(start, 6)) };
}

export function getPreviousPeriodRange(period: AiPeriod, current: PeriodRange): PeriodRange {
  const start = parseLocalDate(current.start);

  if (period === "month") {
    const previous = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    return {
      start: toISODate(previous),
      end: toISODate(new Date(previous.getFullYear(), previous.getMonth() + 1, 0)),
    };
  }

  if (period === "year") {
    return {
      start: `${start.getFullYear() - 1}-01-01`,
      end: `${start.getFullYear() - 1}-12-31`,
    };
  }

  const previousStart = addDays(start, -7);
  return { start: toISODate(previousStart), end: toISODate(addDays(previousStart, 6)) };
}

export function inRange(date: string | null | undefined, range: PeriodRange) {
  const normalized = normalizeDate(date);
  return normalized >= range.start && normalized <= range.end;
}

function amount(value: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

export function financeSummary(transactions: FinanceTransaction[], range: PeriodRange) {
  const scoped = transactions.filter((item) => inRange(item.date, range));
  const realIncome = scoped
    .filter((item) => item.type === "income" && item.isCarryOver !== true)
    .reduce((sum, item) => sum + amount(item.amount), 0);
  const carryOver = scoped
    .filter((item) => item.type === "income" && item.isCarryOver === true)
    .reduce((sum, item) => sum + amount(item.amount), 0);
  const expense = scoped
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + amount(item.amount), 0);
  const categories = scoped
    .filter((item) => item.type === "expense")
    .reduce<Record<string, number>>((acc, item) => {
      const key = item.category || "Boshqa";
      acc[key] = (acc[key] ?? 0) + amount(item.amount);
      return acc;
    }, {});

  return {
    transactionCount: scoped.length,
    realIncome,
    carryOver,
    expense,
    netWithoutCarryOver: realIncome - expense,
    topExpenseCategories: Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, total]) => ({ category, total })),
  };
}

export function taskSummary(data: AppData, range: PeriodRange) {
  const tasks = data.tasks.filter((item) => inRange(item.date, range));
  const completed = tasks.filter((item) => item.status === "Bajarildi").length;

  return {
    total: tasks.length,
    completed,
    pending: tasks.length - completed,
    completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    categories: tasks.reduce<Record<string, number>>((acc, item) => {
      const key = item.category || "Boshqa";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

export function mistakeSummary(data: AppData, range: PeriodRange) {
  const errors = data.journal.errors.filter((item) => inRange(item.date, range));

  return {
    total: errors.length,
    categories: errors.reduce<Record<string, number>>((acc, item) => {
      const key = item.category || "Boshqa";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    topMistakes: errors.slice(0, 8).map((item) => ({
      title: item.title,
      category: item.category,
      severity: item.severity,
    })),
  };
}

export function reflectionSummary(data: AppData, range: PeriodRange) {
  return {
    conclusions: data.journal.conclusions
      .filter((item) => inRange(item.date, range))
      .slice(0, 6)
      .map((item) => ({ title: item.title, content: item.content.slice(0, 240) })),
    summaries: data.journal.daily_summaries
      .filter((item) => inRange(item.date, range))
      .slice(0, 6)
      .map((item) => ({ summary: item.summary.slice(0, 240), score: item.score })),
  };
}

export function buildUserDataContext(data: AppData, period: AiPeriod, anchorDate: string, scope = "chat") {
  const current = getPeriodRange(period, anchorDate);
  const previous = getPreviousPeriodRange(period, current);

  return {
    scope,
    period,
    language: data.language || "uz",
    currentRange: current,
    previousRange: previous,
    current: {
      finance: financeSummary(data.finance.transactions, current),
      tasks: taskSummary(data, current),
      mistakes: mistakeSummary(data, current),
      reflections: reflectionSummary(data, current),
    },
    previous: {
      finance: financeSummary(data.finance.transactions, previous),
      tasks: taskSummary(data, previous),
      mistakes: mistakeSummary(data, previous),
      reflections: reflectionSummary(data, previous),
    },
    settings: {
      language: data.language || "uz",
      theme: data.settings.theme,
    },
  };
}
