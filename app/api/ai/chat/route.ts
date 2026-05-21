import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mergeAppData } from "../../../../lib/app-data";
import { buildUserDataContext, toISODate, type AiPeriod } from "../../../../lib/ai-context";
import type { AiChatMessage } from "../../../utils/ai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openaiModel = process.env.OPENAI_MODEL || "gpt-5.4-mini";

type ChatRequest = {
  message?: string;
  history?: AiChatMessage[];
  anchorDate?: string;
  period?: AiPeriod;
  currentPage?: string;
};

type StoredChatMessage = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
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

function extractOutputText(response: unknown) {
  const outputText = (response as { output_text?: unknown }).output_text;

  if (typeof outputText === "string") {
    return outputText;
  }

  const output = (response as { output?: Array<{ content?: Array<{ text?: unknown }> }> }).output;
  return output?.flatMap((item) => item.content ?? []).map((item) => item.text).find((item): item is string => typeof item === "string") ?? "";
}

function normalizeReplyLanguage(value: unknown): ReplyLanguage {
  return value === "en" || value === "ru" || value === "uz" ? value : "uz";
}

function detectStrictLatestMessageLanguage(message: string, fallback: unknown): ReplyLanguage {
  const text = message.toLowerCase();
  const cyrillicMatches = text.match(/[\u0400-\u04ff]/g)?.length ?? 0;
  const uzbekSignals = [
    "o'",
    "g'",
    "o`",
    "g`",
    "o\u2018",
    "g\u2018",
    "o\u02bb",
    "g\u02bb",
    "sh",
    "ch",
    "ng",
    "qanday",
    "nima",
    "menga",
    "mening",
    "bo'lsa",
    "bo\u2018lsa",
    "bo\u02bblsa",
    "kerak",
    "qil",
    "haqida",
    "xulosa",
    "reja",
    "xato",
    "chiqim",
    "kirim",
  ];
  const englishSignals = [
    "what",
    "why",
    "how",
    "give",
    "show",
    "tell",
    "about",
    "my",
    "income",
    "expense",
    "plan",
    "mistake",
    "summary",
    "progress",
  ];
  const russianSignals = [
    "\u0447\u0442\u043e",
    "\u043a\u0430\u043a",
    "\u043f\u043e\u0447\u0435\u043c\u0443",
    "\u043c\u043d\u0435",
    "\u043c\u043e\u0439",
    "\u043c\u043e\u0438",
    "\u0434\u043e\u0445\u043e\u0434",
    "\u0440\u0430\u0441\u0445\u043e\u0434",
    "\u043f\u043b\u0430\u043d",
    "\u043e\u0448\u0438\u0431\u043a\u0430",
    "\u0432\u044b\u0432\u043e\u0434",
    "\u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441",
  ];

  if (cyrillicMatches >= 3) {
    return "ru";
  }

  const uzScore = uzbekSignals.reduce((score, item) => score + (text.includes(item) ? 1 : 0), 0);
  const enScore = englishSignals.reduce((score, item) => score + (text.includes(item) ? 1 : 0), 0);
  const ruScore = russianSignals.reduce((score, item) => score + (text.includes(item) ? 1 : 0), 0);
  const maxScore = Math.max(uzScore, enScore, ruScore);

  if (maxScore > 0) {
    if (ruScore === maxScore) return "ru";
    if (enScore === maxScore) return "en";
    return "uz";
  }

  return normalizeReplyLanguage(fallback);
}

function replyLanguageInstruction(language: ReplyLanguage) {
  if (language === "en") {
    return "The response language MUST be: English. Ignore previous conversation languages and app language. Respond only in English.";
  }

  if (language === "ru") {
    return "The response language MUST be: Russian. Ignore previous conversation languages and app language. Respond only in Russian.";
  }

  return "The response language MUST be: Uzbek Latin. Ignore previous conversation languages and app language. Respond only in Uzbek Latin.";
}

function strictAiUnavailableReply(language: ReplyLanguage) {
  if (language === "en") {
    return "AI API is not connected. Once the API is connected, chat will work here.";
  }

  if (language === "ru") {
    return "\u0418\u0418 API \u043d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d. \u041f\u043e\u0441\u043b\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f API \u0447\u0430\u0442 \u0431\u0443\u0434\u0435\u0442 \u0440\u0430\u0431\u043e\u0442\u0430\u0442\u044c \u0437\u0434\u0435\u0441\u044c.";
  }

  return "AI API ulanmagan. API ulangandan keyin chat shu yerda ishlaydi.";
}

function strictInsufficientDataReply(language: ReplyLanguage) {
  if (language === "en") {
    return "There is not enough data for this yet.";
  }

  if (language === "ru") {
    return "\u041f\u043e\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u0434\u0430\u043d\u043d\u044b\u0445 \u0434\u043b\u044f \u044d\u0442\u043e\u0433\u043e.";
  }

  return "Bu haqida yetarli ma'lumot yo'q.";
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
    supabase,
    userId: user.id,
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

function mapStoredMessage(message: StoredChatMessage): AiChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
    metadata: message.metadata ?? undefined,
  };
}

async function loadRecentMessages(supabase: ReturnType<typeof createUserClient>, userId: string, limit = 80) {
  const { data, error } = await supabase
    .from("ai_chat_messages")
    .select("id,user_id,role,content,metadata,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as StoredChatMessage[]).reverse().map(mapStoredMessage);
}

async function saveMessage(
  supabase: ReturnType<typeof createUserClient>,
  userId: string,
  role: "user" | "assistant",
  content: string,
  metadata: Record<string, unknown> = {},
) {
  const { data, error } = await supabase
    .from("ai_chat_messages")
    .insert({ user_id: userId, role, content, metadata })
    .select("id,user_id,role,content,metadata,created_at")
    .single();

  if (error) {
    throw error;
  }

  return mapStoredMessage(data as StoredChatMessage);
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedData(request);
  if ("error" in auth) return auth.error;

  try {
    const messages = await loadRecentMessages(auth.supabase, auth.userId);
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: "AI chat tarixini yuklashda xatolik yuz berdi." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedData(request);
  if ("error" in auth) return auth.error;

  const { error } = await auth.supabase.from("ai_chat_messages").delete().eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: "AI chat tarixini tozalashda xatolik yuz berdi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedData(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as ChatRequest;
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const replyLanguage = detectStrictLatestMessageLanguage(message, auth.appData.language);
  const unavailableReply = strictAiUnavailableReply(replyLanguage);

  if (!process.env.OPENAI_API_KEY) {
    let storedUserMessage: AiChatMessage | null = null;
    let storedAssistantMessage: AiChatMessage | null = null;

    try {
      storedUserMessage = await saveMessage(auth.supabase, auth.userId, "user", message, {
        anchorDate: body.anchorDate?.slice(0, 10) || toISODate(new Date()),
        currentPage: body.currentPage ?? null,
        language: replyLanguage,
        period: body.period ?? "week",
      });
      storedAssistantMessage = await saveMessage(auth.supabase, auth.userId, "assistant", unavailableReply, {
        disabled: true,
        language: replyLanguage,
      });
    } catch {
      storedUserMessage = null;
      storedAssistantMessage = null;
    }

    return NextResponse.json({
      enabled: false,
      reply: unavailableReply,
      messages: {
        user: storedUserMessage,
        assistant: storedAssistantMessage,
      },
    });
  }

  const period = body.period === "month" || body.period === "year" ? body.period : "week";
  const anchorDate = body.anchorDate?.slice(0, 10) || toISODate(new Date());
  const context = {
    ...buildUserDataContext(auth.appData, period, anchorDate, "universal-private-assistant"),
    currentPage: body.currentPage ?? null,
  };
  let storedHistory: AiChatMessage[] = [];

  try {
    storedHistory = await loadRecentMessages(auth.supabase, auth.userId, 24);
  } catch {
    storedHistory = [];
  }

  const history = [...storedHistory, ...(body.history ?? [])].slice(-12).map((item) => ({
    role: item.role,
    content: item.content.slice(0, 1000),
  }));

  let storedUserMessage: AiChatMessage | null = null;

  try {
    storedUserMessage = await saveMessage(auth.supabase, auth.userId, "user", message, {
      anchorDate,
      currentPage: body.currentPage ?? null,
      language: replyLanguage,
      period,
    });
  } catch {
    storedUserMessage = null;
  }

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
              "You are the universal PRIVATE app assistant.",
              "You are not page-specific. currentPage is only a weak navigation signal, never a restriction.",
              "Infer the user's intent from the question and choose the relevant app data: finance, tasks/plans, mistakes, reflections, or all progress data.",
              "If the question is about finance, use finance context. If it is about plans, use tasks/plans. If it is about mistakes, use mistakes. If it is about overall progress, combine all available context.",
              "Answer using only the provided app data context and chat history.",
              "If data is insufficient, say that clearly and ask for the missing data.",
              "Keep answers short, specific, and useful.",
              "Never invent transactions, tasks, mistakes, reflections, or scores.",
              "LANGUAGE IS A TOP-PRIORITY RULE.",
              "Chat history language MUST NOT influence the response language.",
              "App settings language MUST NOT influence the response language when the latest user message language is detected.",
              "Always reply in the same language as the user's latest message unless the user explicitly asks for another language in that latest message.",
              "If the latest message switches language, switch your reply language immediately.",
              replyLanguageInstruction(replyLanguage),
              `Detected latest user message language: ${languageNames[replyLanguage]}.`,
              `App language fallback signal only: ${context.language}.`,
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              responseLanguage: replyLanguage,
              responseLanguageInstruction: replyLanguageInstruction(replyLanguage),
              context,
              history,
              latestUserMessage: message,
              question: message,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ enabled: true, error: "AI chat javobini olishda xatolik yuz berdi." }, { status: 502 });
    }

    const result = await response.json();
    const reply = extractOutputText(result).trim();
    const finalReply = reply || strictInsufficientDataReply(replyLanguage);

    let storedAssistantMessage: AiChatMessage | null = null;

    try {
      storedAssistantMessage = await saveMessage(auth.supabase, auth.userId, "assistant", finalReply, {
        anchorDate,
        language: replyLanguage,
        model: openaiModel,
        period,
      });
    } catch {
      storedAssistantMessage = null;
    }

    return NextResponse.json({
      enabled: true,
      reply: finalReply,
      messages: {
        user: storedUserMessage,
        assistant: storedAssistantMessage,
      },
    });
  } catch {
    return NextResponse.json({ enabled: true, error: "AI chat javobini olishda xatolik yuz berdi." }, { status: 500 });
  }
}
