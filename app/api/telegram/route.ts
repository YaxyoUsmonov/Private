import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramChat = {
  id: number;
  type?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
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

const pendingFeedbackChats = new Set<number>();
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
const defaultTextReply = "Private ilovasi haqida savolingiz qabul qilindi.";
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

const privateTopicKeywords = [
  "private",
  "dashboard",
  "moliya",
  "reja",
  "rejalar",
  "xulosa",
  "xulosalar",
  "taklif",
  "shikoyat",
  "ai",
  "web app",
  "login",
  "auth",
  "hisob",
  "balans",
  "kirim",
  "chiqim",
  "statistika",
  "odat",
  "odati",
  "xato",
  "xatolar",
  "profil",
  "sozlama",
  "settings",
  "bot",
  "ilova",
  "platforma",
  "yordam",
  "savol",
];

function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

function getResendApiKey() {
  return process.env.RESEND_API_KEY;
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

function isPrivateTopic(text: string) {
  const normalizedText = text.toLowerCase();
  return privateTopicKeywords.some((keyword) => normalizedText.includes(keyword));
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

  if (!isPrivateTopic(text)) {
    await sendBotMessage(message.chat.id, outsidePrivateReply);
    return;
  }

  await sendBotMessage(message.chat.id, defaultTextReply);
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
