import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AppData, FinanceTransaction, mergeAppData } from "../../../../lib/app-data";
import type { AiAnalysisPeriod, AiAnalysisResult, AiAnalysisScope } from "../../../utils/ai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openaiModel = process.env.OPENAI_MODEL || "gpt-5.4-mini";

type AnalyzeRequest = {
  period?: AiAnalysisPeriod;
  anchorDate?: string;
  scope?: AiAnalysisScope;
};

type PeriodRange = {
  start: string;
  end: string;
};

type ReplyLanguage = "uz" | "en" | "ru";

export const runtime = "nodejs";

const languageNames: Record<ReplyLanguage, string> = {
  uz: "Uzbek",
  en: "English",
  ru: "Russian",
};

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
}

function createUserClient(token: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase env vars are missing");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: Date, days: number) {
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

function getPeriodRange(period: AiAnalysisPeriod, anchorDate: string): PeriodRange {
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

function getPreviousPeriodRange(period: AiAnalysisPeriod, current: PeriodRange): PeriodRange {
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

function inRange(date: string | null | undefined, range: PeriodRange) {
  const normalized = normalizeDate(date);
  return normalized >= range.start && normalized <= range.end;
}

function amount(value: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function normalizeReplyLanguage(value: unknown): ReplyLanguage {
  return value === "en" || value === "ru" || value === "uz" ? value : "uz";
}

function financeSummary(transactions: FinanceTransaction[], range: PeriodRange) {
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

function taskSummary(data: AppData, range: PeriodRange) {
  const tasks = data.tasks.filter((item) => inRange(item.date, range));
  const completed = tasks.filter((item) => item.status === "Bajarildi").length;
  const categories = tasks.reduce<Record<string, number>>((acc, item) => {
    const key = item.category || "Boshqa";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total: tasks.length,
    completed,
    pending: tasks.length - completed,
    completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    categories,
  };
}

function mistakeSummary(data: AppData, range: PeriodRange) {
  const errors = data.journal.errors.filter((item) => inRange(item.date, range));
  const categories = errors.reduce<Record<string, number>>((acc, item) => {
    const key = item.category || "Boshqa";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total: errors.length,
    categories,
    topMistakes: errors.slice(0, 8).map((item) => ({
      title: item.title,
      category: item.category,
      severity: item.severity,
    })),
  };
}

function reflectionSummary(data: AppData, range: PeriodRange) {
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

function buildAnalysisContext(data: AppData, period: AiAnalysisPeriod, anchorDate: string, scope: AiAnalysisScope) {
  const current = getPeriodRange(period, anchorDate);
  const previous = getPreviousPeriodRange(period, current);

  return {
    scope,
    period,
    language: normalizeReplyLanguage(data.language),
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
      language: normalizeReplyLanguage(data.language),
      theme: data.settings.theme,
    },
  };
}

function fallbackAnalysis(period: AiAnalysisPeriod): AiAnalysisResult {
  return {
    summary: "",
    comparison: "",
    strengths: [],
    weaknesses: [],
    recommendations: [],
    score: null,
    period,
  };
}

function normalizeAnalysis(value: Partial<AiAnalysisResult>, period: AiAnalysisPeriod): AiAnalysisResult {
  return {
    summary: typeof value.summary === "string" ? value.summary : "",
    comparison: typeof value.comparison === "string" ? value.comparison : "",
    strengths: Array.isArray(value.strengths) ? value.strengths.filter((item): item is string => typeof item === "string") : [],
    weaknesses: Array.isArray(value.weaknesses) ? value.weaknesses.filter((item): item is string => typeof item === "string") : [],
    recommendations: Array.isArray(value.recommendations) ? value.recommendations.filter((item): item is string => typeof item === "string") : [],
    score: typeof value.score === "number" && Number.isFinite(value.score) ? Math.max(0, Math.min(100, Math.round(value.score))) : null,
    period: value.period === "week" || value.period === "month" || value.period === "year" ? value.period : period,
  };
}

async function getAuthenticatedData(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = createUserClient(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data, error } = await supabase.from("app_data").select("*").eq("user_id", user.id).maybeSingle();

  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  }

  return {
    appData: mergeAppData(data ? {
      habits: data.habits,
      tasks: data.tasks,
      streaks: data.streaks,
      journal: data.journal,
      settings: data.settings,
      language: data.language,
      profile_data: data.profile_data,
      finance: data.finance,
    } : null),
  };
}

function extractOutputText(response: unknown) {
  const outputText = (response as { output_text?: unknown }).output_text;

  if (typeof outputText === "string") {
    return outputText;
  }

  const output = (response as { output?: Array<{ content?: Array<{ text?: unknown }> }> }).output;
  return output?.flatMap((item) => item.content ?? []).map((item) => item.text).find((item): item is string => typeof item === "string") ?? "";
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedData(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as AnalyzeRequest;
  const period = body.period === "month" || body.period === "year" ? body.period : "week";
  const scope = body.scope ?? "dashboard";
  const anchorDate = body.anchorDate?.slice(0, 10) || toISODate(new Date());
  const context = buildAnalysisContext(auth.appData, period, anchorDate, scope);
  const replyLanguage = normalizeReplyLanguage(context.language);

  if (!process.env.OPENAI_API_KEY) {
    const placeholder = replyLanguage === "en"
      ? "AI API is not connected. Analysis will appear here after the API is connected."
      : replyLanguage === "ru"
        ? "AI API не подключен. После подключения API анализ появится здесь."
        : "AI API ulanmagan. API ulangandan keyin tahlillar shu yerda chiqadi.";

    return NextResponse.json({
      enabled: false,
      analysis: null,
      placeholder,
    });
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      comparison: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      weaknesses: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
      score: { type: ["number", "null"] },
      period: { type: "string", enum: ["week", "month", "year"] },
    },
    required: ["summary", "comparison", "strengths", "weaknesses", "recommendations", "score", "period"],
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openaiModel,
        input: [
          {
            role: "system",
            content: [
              "You analyze a private self-improvement dashboard.",
              "Return only the requested structured JSON.",
              "Do not invent data. If data is insufficient, say analysis is limited.",
              "Analyze only period-based data: current week/month/year vs previous week/month/year.",
              "Always reply in the same language as the user's latest message unless explicitly asked otherwise.",
              "This analysis request has no free-form latest user message, so use the app language/context language for every JSON text field.",
              "If a future analysis request includes a latest user message, that latest message language has priority over app language.",
              `Target analysis language: ${languageNames[replyLanguage]}.`,
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify(context),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "private_ai_analysis",
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ enabled: true, error: "AI tahlilini olishda xatolik yuz berdi." }, { status: 502 });
    }

    const result = await response.json();
    const text = extractOutputText(result);
    const parsed = text ? JSON.parse(text) as Partial<AiAnalysisResult> : fallbackAnalysis(period);

    return NextResponse.json({
      enabled: true,
      analysis: normalizeAnalysis(parsed, period),
    });
  } catch {
    return NextResponse.json({ enabled: true, error: "AI tahlilini olishda xatolik yuz berdi." }, { status: 500 });
  }
}
