import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramChat = {
  id: number;
  type?: string;
};

type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
};

type TelegramWebhookUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

type TelegramSendMessageResponse = {
  ok: boolean;
  description?: string;
  result?: unknown;
};

type TelegramApiResponse = {
  ok: boolean;
  description?: string;
  result?: unknown;
};

type OpenAIResponseOutput = {
  content?: Array<{
    text?: unknown;
  }>;
};

type TelegramKeyboardButton = string | {
  text: string;
  web_app?: {
    url: string;
  };
};

type TelegramReplyKeyboardMarkup = {
  keyboard: TelegramKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
};

type TelegramSendMessageOptions = {
  replyMarkup?: TelegramReplyKeyboardMarkup;
  parseMode?: "HTML";
};

type CommandHandler = (message: TelegramMessage) => Promise<void>;

type AiUsageRecord = {
  count: number;
  lastResetDate: string;
};

const pendingFeedbackChats = new Set<number>();
const aiUsageByUser = new Map<number, AiUsageRecord>();
const dailyAiMessageLimit = 20;
const telegramOpenaiModel = "gpt-4o-mini";
const webAppUrl = "https://private-git-main-yaxyousmonovs-projects.vercel.app";
const botDescription = [
  "✨ Private — shaxsiy rivojlanish uchun zamonaviy platforma.",
  "",
  "💰 Moliyani boshqaring",
  "📋 Rejalarni kuzating",
  "🧠 AI tavsiyalar oling",
  "📈 Statistikalarni ko‘ring",
  "🎯 O‘z ustingizda ishlang",
  "",
  "Rasmiy Private AI yordamchi bot.",
].join("\n");
const startReply = [
  "👋 Salom, Private ilovasining rasmiy Private AI yordamchi botiga xush kelibsiz.",
  "",
  "✨ Private — moliya, rejalar, odatlar va shaxsiy rivojlanishni bitta joyda boshqarish uchun yaratilgan zamonaviy platforma.",
  "",
  `🚀 <a href="${webAppUrl}">Web App</a>`,
  "",
  "📌 Savollaringiz bo‘lsa bemalol yozishingiz mumkin.",
].join("\n");
const aiNotConfiguredReply = "AI hozircha sozlanmagan.";
const aiErrorReply = "AI javob berishda xatolik yuz berdi.";
const aiLimitReachedReply = "Bugungi AI limit tugadi. Ertaga yana urinib ko‘ring 😊";
const outsidePrivateReply = "Men faqat Private ilovasi haqida yordam bera olaman 😊";
const feedbackPromptReply = "Taklif yoki shikoyatingizni yozing.";
const feedbackAcceptedReply = "Taklif/shikoyatingiz qabul qilindi ✅";
const basicKeyboard: TelegramReplyKeyboardMarkup = {
  keyboard: [
    ["Taklif/Shikoyatlar"],
    ["Chiqish"],
  ],
  resize_keyboard: true,
};
const mainKeyboard: TelegramReplyKeyboardMarkup = {
  keyboard: [
    ["Taklif/Shikoyatlar"],
    [{ text: "Web App", web_app: { url: webAppUrl } }],
    ["Chiqish"],
  ],
  resize_keyboard: true,
};

const sectionReplies: Record<string, string> = {
  Dashboard: "Dashboard bo‘limidasiz.",
  Moliya: "Moliya bo‘limidasiz.",
  Rejalar: "Rejalar bo‘limidasiz.",
  Xulosalar: "Xulosalar bo‘limidasiz.",
  Chiqish: "Botdan chiqdingiz.",
};

function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

function getResendApiKey() {
  return process.env.RESEND_API_KEY;
}

function getOpenAIApiKey() {
  return process.env.OPENAI_API_KEY;
}

function getAdminTelegramId() {
  const id = Number(process.env.ADMIN_TELEGRAM_ID);
  return Number.isFinite(id) ? id : null;
}

function getAdminEmail() {
  return process.env.ADMIN_EMAIL;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

function isTelegramMessage(value: unknown): value is TelegramMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<TelegramMessage>;
  return Boolean(message.chat && typeof message.chat.id === "number" && typeof message.message_id === "number");
}

function isTelegramUpdate(value: unknown): value is TelegramWebhookUpdate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const update = value as Partial<TelegramWebhookUpdate>;
  return typeof update.update_id === "number";
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getTelegramUserId(message: TelegramMessage) {
  return message.from?.id ?? message.chat.id;
}

function isAdminTelegramUser(userId: number) {
  return getAdminTelegramId() === userId;
}

function checkAndIncrementAiUsage(userId: number) {
  if (isAdminTelegramUser(userId)) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY };
  }

  const today = getTodayKey();
  const current = aiUsageByUser.get(userId);
  const record = current?.lastResetDate === today ? current : { count: 0, lastResetDate: today };

  if (record.count >= dailyAiMessageLimit) {
    aiUsageByUser.set(userId, record);
    return { allowed: false, remaining: 0 };
  }

  const nextRecord = {
    count: record.count + 1,
    lastResetDate: today,
  };
  aiUsageByUser.set(userId, nextRecord);

  return {
    allowed: true,
    remaining: dailyAiMessageLimit - nextRecord.count,
  };
}

function extractOpenAIText(response: unknown) {
  const outputText = (response as { output_text?: unknown }).output_text;

  if (typeof outputText === "string") {
    return outputText;
  }

  const output = (response as { output?: OpenAIResponseOutput[] }).output;
  return output?.flatMap((item) => item.content ?? []).map((item) => item.text).find((item): item is string => typeof item === "string") ?? "";
}

async function callTelegramApi(method: string, body: Record<string, unknown>) {
  const token = getTelegramBotToken();

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as TelegramApiResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? `Telegram ${method} failed with status ${response.status}`);
  }

  return payload;
}

export async function sendTelegramMessage(chatId: number, text: string, options: TelegramSendMessageOptions = {}) {
  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
    ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
  }) as Promise<TelegramSendMessageResponse>;
}

async function sendBotMessage(chatId: number, text: string, options: Omit<TelegramSendMessageOptions, "replyMarkup"> = {}) {
  try {
    return await sendTelegramMessage(chatId, text, {
      ...options,
      replyMarkup: mainKeyboard,
    });
  } catch (error) {
    console.error("[telegram/webhook] Failed to send message with Web App keyboard, retrying with basic keyboard", error);
    return sendTelegramMessage(chatId, text, {
      ...options,
      replyMarkup: basicKeyboard,
    });
  }
}

async function setTelegramBotDescription() {
  try {
    await callTelegramApi("setMyDescription", {
      description: botDescription,
    });
  } catch (error) {
    console.error("[telegram/webhook] Failed to set bot description", error);
  }
}

async function askPrivateAi(text: string) {
  const openaiApiKey = getOpenAIApiKey();

  if (!openaiApiKey) {
    return aiNotConfiguredReply;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: telegramOpenaiModel,
        input: [
          {
            role: "system",
            content: [
              "You are Private AI, the official assistant for the Private self-improvement app.",
              "Private is a modern platform for personal finance, plans, habits, mistakes/reflections, statistics, and self-growth.",
              "Answer only questions about the Private app, its features, usage, finance/plans/habits/reflection workflows, Web App, feedback, and account/help topics.",
              `If the user asks about any unrelated topic, reply exactly: ${outsidePrivateReply}`,
              "Keep answers short, practical, friendly, and in Uzbek Latin unless the user clearly writes in another language.",
              "Do not invent user data or claim access to their private app data from Telegram.",
            ].join(" "),
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[telegram/ai] OpenAI request failed", {
        status: response.status,
        error: errorText,
      });
      return aiErrorReply;
    }

    const result = await response.json();
    return extractOpenAIText(result).trim() || aiErrorReply;
  } catch (error) {
    console.error("[telegram/ai] OpenAI request crashed", error);
    return aiErrorReply;
  }
}

async function sendFeedbackEmail(message: TelegramMessage, feedbackText: string) {
  const resendApiKey = getResendApiKey();
  const adminEmail = getAdminEmail();

  if (!resendApiKey) {
    console.error("[telegram/feedback] RESEND_API_KEY is not configured", {
      chatId: message.chat.id,
      feedbackText,
    });
    return;
  }

  if (!adminEmail) {
    console.error("[telegram/feedback] ADMIN_EMAIL is not configured", {
      chatId: message.chat.id,
      feedbackText,
    });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Private Bot <onboarding@resend.dev>",
      to: [adminEmail],
      subject: "Private bot: yangi taklif/shikoyat",
      text: [
        "Telegram bot orqali yangi taklif/shikoyat keldi.",
        "",
        `Chat ID: ${message.chat.id}`,
        `Message ID: ${message.message_id}`,
        "",
        feedbackText,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[telegram/feedback] Failed to send feedback email", {
      status: response.status,
      error: errorText,
    });
  }
}

const commandHandlers: Record<string, CommandHandler> = {
  "/start": async (message) => {
    console.log("[telegram/start] user id", getTelegramUserId(message));
    pendingFeedbackChats.delete(message.chat.id);
    await setTelegramBotDescription();
    await sendBotMessage(message.chat.id, startReply, {
      parseMode: "HTML",
    });
  },
};

async function handleTextMessage(message: TelegramMessage) {
  const text = message.text?.trim();

  if (!text) {
    return;
  }

  if (pendingFeedbackChats.has(message.chat.id)) {
    pendingFeedbackChats.delete(message.chat.id);
    await sendFeedbackEmail(message, text);
    await sendBotMessage(message.chat.id, feedbackAcceptedReply);
    return;
  }

  const command = text.split(/\s+/)[0].toLowerCase();
  const handler = commandHandlers[command];

  if (handler) {
    await handler(message);
    return;
  }

  if (text === "Taklif/Shikoyatlar") {
    pendingFeedbackChats.add(message.chat.id);
    await sendBotMessage(message.chat.id, feedbackPromptReply);
    return;
  }

  const sectionReply = sectionReplies[text];

  if (sectionReply) {
    await sendBotMessage(message.chat.id, sectionReply);
    return;
  }

  const userId = getTelegramUserId(message);
  const usage = checkAndIncrementAiUsage(userId);

  if (!usage.allowed) {
    await sendBotMessage(message.chat.id, aiLimitReachedReply);
    return;
  }

  const aiReply = await askPrivateAi(text);
  await sendBotMessage(message.chat.id, aiReply);
}

export async function POST(request: NextRequest) {
  if (!getTelegramBotToken()) {
    console.error("[telegram/webhook] TELEGRAM_BOT_TOKEN is not configured");
    return jsonResponse({ ok: false, error: "Telegram bot token is not configured" }, 500);
  }

  let update: unknown;

  try {
    update = await request.json();
  } catch (error) {
    console.error("[telegram/webhook] Invalid JSON payload", error);
    return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400);
  }

  if (!isTelegramUpdate(update)) {
    console.error("[telegram/webhook] Invalid Telegram update", update);
    return jsonResponse({ ok: false, error: "Invalid Telegram update" }, 400);
  }

  try {
    const message = update.message;

    if (isTelegramMessage(message)) {
      await handleTextMessage(message);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("[telegram/webhook] Failed to process update", error);
    return jsonResponse({ ok: false, error: "Failed to process Telegram update" }, 500);
  }
}

export async function GET() {
  return jsonResponse({
    ok: true,
    service: "telegram-webhook",
    configured: Boolean(getTelegramBotToken()),
  });
}
