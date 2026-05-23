export type FinanceTransaction = {
  id?: string;
  title: string;
  category: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  note: string;
  isCarryOver?: boolean;
  carryOverFromDate?: string;
};

export type TaskItem = {
  id?: string;
  title: string;
  time: string;
  category: string;
  priority: string;
  status: "Kutilmoqda" | "Bajarildi" | "Bajarilmadi";
  date: string;
  status_note?: string;
  completed_note?: string;
  status_result?: "pending" | "completed" | "missed";
  linked_goal_id?: string;
  goal_progress_increment?: number;
  planned_goal_increment?: number;
  actual_goal_increment?: number;
  linked_goal_title?: string;
  goal_progress_applied?: boolean;
};

export type MonthlyGoalActivity = {
  date: string;
  planned_amount?: number;
  actual_amount?: number;
  amount?: number;
  unit?: string;
  status?: "pending" | "completed" | "missed";
  source?: "plans" | "manual" | string;
  source_task_id?: string;
  source_task_title?: string;
  note?: string;
  created_at?: string;
};

export type MonthlyGoalLastActivity = {
  date: string;
  status: "pending" | "completed" | "missed";
  planned_amount: number;
  actual_amount: number;
  unit: string;
  source_task_id?: string;
  source_task_title?: string;
};

export type MonthlyGoalItem = {
  id?: string;
  title: string;
  description?: string;
  category: string;
  type: "manual" | "plans_category";
  goal_type?: "habit" | "target" | "deadline";
  target_value: number;
  current_value: number;
  unit: string;
  deadline_date?: string;
  daily_target?: number;
  progress_percent?: number;
  month: number;
  year: number;
  completed: boolean;
  linked_task_ids?: string[];
  last_activity?: MonthlyGoalLastActivity | string;
  activity_log?: MonthlyGoalActivity[];
  created_at: string;
  updated_at: string;
};

export type HabitItem = {
  id?: string;
  title: string;
  value: number;
  category?: string;
  color?: string;
  date?: string;
};

export type ErrorItem = {
  id?: string;
  title: string;
  reason: string;
  time: string;
  repeat: string;
  category: string;
  severity: string;
  date: string;
  source?: "plans" | string;
  source_task_id?: string;
  resolved?: boolean;
};

export type ConclusionItem = {
  id?: string;
  title: string;
  content: string;
  date: string;
};

export type DailySummaryItem = {
  id?: string;
  summary: string;
  advice: string;
  score: number;
  date: string;
};

export type ProfileData = {
  name: string;
  shortName: string;
  email: string;
  bio: string;
  level: number;
  xp: number;
  xpTarget: number;
  streak: number;
  productivity: number;
  focus: string;
  achievements: number;
};

export type SettingsData = {
  theme: string;
  reminders: boolean;
  smartReminder: boolean;
  aiProtection: boolean;
};

export type JournalData = {
  summary: string;
  mood: number;
  errors: ErrorItem[];
  conclusions: ConclusionItem[];
  daily_summaries: DailySummaryItem[];
};

export type StreaksData = {
  current: number;
  best: number;
};

export type FinanceData = {
  transactions: FinanceTransaction[];
};

export type AppData = {
  habits: HabitItem[];
  tasks: TaskItem[];
  monthly_goals: MonthlyGoalItem[];
  streaks: StreaksData;
  journal: JournalData;
  settings: SettingsData;
  language: string;
  profile_data: ProfileData;
  finance: FinanceData;
};

export const defaultAppData: AppData = {
  habits: [],
  tasks: [],
  monthly_goals: [],
  streaks: {
    current: 0,
    best: 0,
  },
  journal: {
    summary: "",
    mood: 0,
    errors: [],
    conclusions: [],
    daily_summaries: [],
  },
  settings: {
    theme: "Qorongu",
    reminders: true,
    smartReminder: true,
    aiProtection: false,
  },
  language: "uz",
  profile_data: {
    name: "Private User",
    shortName: "Private",
    email: "",
    bio: "",
    level: 0,
    xp: 0,
    xpTarget: 0,
    streak: 0,
    productivity: 0,
    focus: "0h",
    achievements: 0,
  },
  finance: {
    transactions: [],
  },
};

function sanitizeLegacyDemoData(data: AppData): AppData {
  const profile = data.profile_data;
  const transactions = Array.isArray(data.finance?.transactions) ? data.finance.transactions : [];
  const legacyTotalIncome = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + (Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0), 0);
  const legacyTotalExpense = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + (Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0), 0);
  const isLegacyDemoFinance =
    transactions.length > 0 &&
    transactions.every((item) => !item.id) &&
    legacyTotalIncome === 1500000 &&
    legacyTotalExpense === 760000;
  const isLegacyDemoProfile =
    profile.name === "Yaxyo Usmonov" &&
    profile.email === "yaxyousmonov@gmail.com" &&
    profile.xp === 4250 &&
    profile.xpTarget === 6000 &&
    profile.streak === 27 &&
    profile.productivity === 92 &&
    profile.focus === "18h" &&
    profile.achievements === 24;

  return {
    ...data,
    tasks: data.tasks.map((task) => ({
      ...task,
      date: task.date ?? "",
      goal_progress_increment: Math.max(0, Number(task.goal_progress_increment) || 0),
      planned_goal_increment: Math.max(0, Number(task.planned_goal_increment ?? task.goal_progress_increment) || 0),
      actual_goal_increment: Math.max(
        0,
        Number(task.actual_goal_increment ?? (task.status === "Bajarildi" && task.goal_progress_applied ? task.goal_progress_increment : 0)) || 0,
      ),
      goal_progress_applied: Boolean(task.goal_progress_applied),
    })),
    monthly_goals: (Array.isArray(data.monthly_goals) ? data.monthly_goals : []).map((goal) => {
      const targetValue = Math.max(1, Number(goal.target_value) || 1);
      const currentValue = Math.max(0, Number(goal.current_value) || 0);
      const progressPercent = Math.min(100, Math.round((currentValue / targetValue) * 100));

      return {
        ...goal,
        id: goal.id ?? "",
        description: goal.description ?? "",
        type: goal.type ?? "manual",
        goal_type: goal.goal_type ?? "target",
        target_value: targetValue,
        current_value: currentValue,
        unit: goal.unit ?? "marta",
        deadline_date: goal.deadline_date ?? "",
        daily_target: Math.max(0, Number(goal.daily_target) || 0),
        progress_percent: progressPercent,
        completed: Boolean(goal.completed || currentValue >= targetValue),
        linked_task_ids: Array.isArray(goal.linked_task_ids) ? goal.linked_task_ids : [],
        last_activity: goal.last_activity ?? "",
        activity_log: Array.isArray(goal.activity_log) ? goal.activity_log : [],
        created_at: goal.created_at ?? "",
        updated_at: goal.updated_at ?? "",
      };
    }),
    journal: {
      ...data.journal,
      errors: data.journal.errors.map((error) => ({
        ...error,
        severity: error.severity ?? "O'rta",
        date: error.date ?? "",
      })),
      conclusions: data.journal.conclusions ?? [],
      daily_summaries: data.journal.daily_summaries ?? [],
    },
    finance: {
      ...data.finance,
      transactions: isLegacyDemoFinance ? [] : transactions,
    },
    profile_data: isLegacyDemoProfile ? defaultAppData.profile_data : profile,
  };
}

export function mergeAppData(data: Partial<AppData> | null | undefined): AppData {
  return sanitizeLegacyDemoData({
    ...defaultAppData,
    ...data,
    streaks: { ...defaultAppData.streaks, ...data?.streaks },
    journal: { ...defaultAppData.journal, ...data?.journal },
    settings: { ...defaultAppData.settings, ...data?.settings },
    profile_data: { ...defaultAppData.profile_data, ...data?.profile_data },
    finance: { ...defaultAppData.finance, ...data?.finance },
    monthly_goals: data?.monthly_goals ?? defaultAppData.monthly_goals,
  });
}

function normalizeISODate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function addDaysISO(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function transactionAmount(amount: number) {
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
}

function carryOverId(fromDate: string, toDate: string) {
  return `carry-over:${fromDate}:${toDate}`;
}

function isCarryOverTransaction(item: FinanceTransaction, fromDate: string, toDate: string) {
  return (
    item.id === carryOverId(fromDate, toDate) ||
    (
      item.isCarryOver === true &&
      item.carryOverFromDate === fromDate &&
      normalizeISODate(item.date) === toDate
    )
  );
}

function balanceForDate(transactions: FinanceTransaction[], date: string) {
  return transactions
    .filter((item) => normalizeISODate(item.date) === date)
    .reduce((sum, item) => {
      const amount = transactionAmount(item.amount);
      return item.type === "income" ? sum + amount : sum - amount;
    }, 0);
}

export function ensureFinanceCarryOver(transactions: FinanceTransaction[], selectedDate: string) {
  const normalizedSelectedDate = normalizeISODate(selectedDate);

  if (!normalizedSelectedDate || !transactions.length) {
    return transactions;
  }

  let nextTransactions = transactions.map((item) => ({
    ...item,
    date: normalizeISODate(item.date),
  }));
  const datedTransactions = nextTransactions
    .map((item) => normalizeISODate(item.date))
    .filter(Boolean)
    .sort();
  const firstDate = datedTransactions[0];

  if (!firstDate || normalizedSelectedDate <= firstDate) {
    return transactions;
  }

  let hasChanged = false;
  let currentDate = addDaysISO(firstDate, 1);

  while (currentDate <= normalizedSelectedDate) {
    const fromDate = addDaysISO(currentDate, -1);
    const previousBalance = balanceForDate(nextTransactions, fromDate);
    const existingIndex = nextTransactions.findIndex((item) => isCarryOverTransaction(item, fromDate, currentDate));

    if (previousBalance > 0) {
      const carryOverTransaction: FinanceTransaction = {
        id: carryOverId(fromDate, currentDate),
        title: "O'tgan kundan qolgan mablag'",
        category: "carry_over",
        amount: previousBalance,
        type: "income",
        date: currentDate,
        note: "O'tgan kundan qolgan mablag' qo'shildi",
        isCarryOver: true,
        carryOverFromDate: fromDate,
      };

      if (existingIndex >= 0) {
        const existing = nextTransactions[existingIndex];
        const isSameCarryOver =
          existing.id === carryOverTransaction.id &&
          existing.title === carryOverTransaction.title &&
          existing.category === carryOverTransaction.category &&
          existing.amount === carryOverTransaction.amount &&
          existing.type === carryOverTransaction.type &&
          existing.date === carryOverTransaction.date &&
          existing.note === carryOverTransaction.note &&
          existing.isCarryOver === true &&
          existing.carryOverFromDate === carryOverTransaction.carryOverFromDate;

        if (!isSameCarryOver) {
          nextTransactions = nextTransactions.map((item, index) => index === existingIndex ? carryOverTransaction : item);
          hasChanged = true;
        }
      } else {
        nextTransactions = [carryOverTransaction, ...nextTransactions];
        hasChanged = true;
      }
    } else if (existingIndex >= 0) {
      nextTransactions = nextTransactions.filter((_, index) => index !== existingIndex);
      hasChanged = true;
    }

    currentDate = addDaysISO(currentDate, 1);
  }

  return hasChanged ? nextTransactions : transactions;
}
