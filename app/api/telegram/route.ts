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

type TelegramReplyKeyboardMarkup = {
  keyboard: string[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
};

type CommandHandler = (message: TelegramMessage) => Promise<void>;

const pendingFeedbackChats = new Set<number>();
const startReply = "Private botga xush kelibsiz ✅\nDashboardga kirdingiz.";
const defaultTextReply = "Xabaringiz qabul qilindi.";
const feedbackPromptReply = "Taklif yoki shikoyatingizni yozing.";
const feedbackAcceptedReply = "Taklif/shikoyatingiz qabul qilindi ✅";
const mainKeyboard: TelegramReplyKeyboardMarkup = {
  keyboard: [
    ["Dashboard", "Moliya"],
    ["Rejalar", "Xulosalar"],
    ["Taklif/Shikoyatlar"],
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

export async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: TelegramReplyKeyboardMarkup) {
  const token = getTelegramBotToken();

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });

  const payload = (await response.json()) as TelegramSendMessageResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? `Telegram sendMessage failed with status ${response.status}`);
  }

  return payload;
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
    await sendTelegramMessage(message.chat.id, startReply, mainKeyboard);
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
    await sendTelegramMessage(message.chat.id, feedbackAcceptedReply, mainKeyboard);
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
    await sendTelegramMessage(message.chat.id, feedbackPromptReply, mainKeyboard);
    return;
  }

  const sectionReply = sectionReplies[text];

  if (sectionReply) {
    await sendTelegramMessage(message.chat.id, sectionReply, mainKeyboard);
    return;
  }

  await sendTelegramMessage(message.chat.id, defaultTextReply, mainKeyboard);
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
