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

type CommandHandler = (message: TelegramMessage) => Promise<void>;

const startReply = "Assalomu alaykum! Private bot ishga tushdi.";
const defaultTextReply = "Xabaringiz qabul qilindi.";

function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN;
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

export async function sendTelegramMessage(chatId: number, text: string) {
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
    }),
  });

  const payload = (await response.json()) as TelegramSendMessageResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description ?? `Telegram sendMessage failed with status ${response.status}`);
  }

  return payload;
}

const commandHandlers: Record<string, CommandHandler> = {
  "/start": async (message) => {
    await sendTelegramMessage(message.chat.id, startReply);
  },
};

async function handleTextMessage(message: TelegramMessage) {
  const text = message.text?.trim();

  if (!text) {
    return;
  }

  const command = text.split(/\s+/)[0].toLowerCase();
  const handler = commandHandlers[command];

  if (handler) {
    await handler(message);
    return;
  }

  await sendTelegramMessage(message.chat.id, defaultTextReply);
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
