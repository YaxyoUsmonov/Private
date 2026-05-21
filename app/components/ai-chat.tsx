"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, Sparkles, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "../../lib/supabase";
import type { AiChatMessage } from "../utils/ai";
import { todayISO } from "../utils/date";

type ChatResponse = {
  enabled?: boolean;
  reply?: string;
  messages?: {
    user?: AiChatMessage | null;
    assistant?: AiChatMessage | null;
  };
  error?: string;
};

type ChatHistoryResponse = {
  messages?: AiChatMessage[];
  error?: string;
};

function createMessage(role: AiChatMessage["role"], content: string): AiChatMessage {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function AiChat() {
  const t = useTranslations("ai");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const cancelClearRef = useRef<HTMLButtonElement | null>(null);
  const historyLoadedRef = useRef(false);
  const visibleMessages = useMemo(() => messages.slice(-40), [messages]);

  useEffect(() => {
    if (!open || historyLoadedRef.current) {
      return;
    }

    let active = true;
    historyLoadedRef.current = true;

    async function loadHistory() {
      setHistoryLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        historyLoadedRef.current = false;
        setHistoryLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/ai/chat", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });
        const payload = (await response.json()) as ChatHistoryResponse;

        if (!active) {
          return;
        }

        if (!response.ok) {
          historyLoadedRef.current = false;
          setError(payload.error ?? t("historyLoadError"));
          return;
        }

        setMessages(payload.messages ?? []);
      } catch {
        if (active) {
          historyLoadedRef.current = false;
          setError(t("historyLoadError"));
        }
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, [open, t]);

  useEffect(() => {
    if (open) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, open]);

  useEffect(() => {
    if (!confirmClearOpen) {
      return;
    }

    cancelClearRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !clearing) {
        setConfirmClearOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearing, confirmClearOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();

    if (!content || loading) {
      return;
    }

    setInput("");
    setError(null);
    setLoading(true);

    const userMessage = createMessage("user", content);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setError(t("sessionMissing"));
        return;
      }

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          history: messages.slice(-8),
          anchorDate: todayISO(),
          currentPage: pathname,
          period: "week",
        }),
      });
      const payload = (await response.json()) as ChatResponse;

      if (!response.ok) {
        setError(payload.error ?? t("responseError"));
        return;
      }

      if (payload.enabled === false) {
        setDisabled(true);
      }

      setMessages((current) => {
        const withoutOptimisticUser = current.filter((item) => item.id !== userMessage.id);
        return [
          ...withoutOptimisticUser,
          payload.messages?.user ?? userMessage,
          payload.messages?.assistant ?? createMessage("assistant", payload.reply ?? t("emptyDisabled")),
        ];
      });
    } catch {
      setError(t("responseError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmClearChat() {
    setError(null);
    setClearing(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError(t("sessionMissing"));
      setClearing(false);
      return;
    }

    try {
      const response = await fetch("/api/ai/chat", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const payload = (await response.json()) as ChatHistoryResponse;
        setError(payload.error ?? t("clearError"));
        return;
      }

      setMessages([]);
      setConfirmClearOpen(false);
    } catch {
      setError(t("clearError"));
    } finally {
      setClearing(false);
    }
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ y: -2, scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.4rem)] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-200/18 bg-[linear-gradient(145deg,rgba(255,255,255,.18),rgba(168,85,247,.20),rgba(76,29,149,.16))] text-white shadow-[0_18px_50px_rgba(124,58,237,.30),inset_0_1px_0_rgba(255,255,255,.22)] backdrop-blur-2xl transition duration-400 lg:bottom-6"
        aria-label={t("chatAria")}
      >
        <Bot size={22} />
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-end bg-black/35 backdrop-blur-sm lg:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.aside
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-[30px] border border-violet-200/14 bg-[image:var(--app-card-bg)] shadow-[0_-20px_70px_rgba(15,23,42,.42),inset_0_1px_0_rgba(255,255,255,.10)] backdrop-blur-2xl lg:h-[min(760px,calc(100dvh-2rem))] lg:max-w-[430px] lg:rounded-[30px]"
            >
              <div className="flex items-center justify-between border-b border-violet-200/12 px-5 py-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-violet-300">
                    <Sparkles size={16} /> Private AI
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-[var(--app-text)]">{t("chatTitle")}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClearOpen(true)}
                    disabled={!messages.length || historyLoading}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-300/14 bg-white/[0.04] text-slate-300 transition duration-400 hover:bg-white/[0.08] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={t("clear")}
                  >
                    <Trash2 size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-300/14 bg-white/[0.04] text-slate-300 transition duration-400 hover:bg-white/[0.08] active:scale-95"
                    aria-label={t("close")}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5">
                {historyLoading ? (
                  <div className="rounded-2xl border border-violet-300/14 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
                    {t("historyLoading")}
                  </div>
                ) : null}

                {!historyLoading && !visibleMessages.length ? (
                  <div className="rounded-2xl border border-violet-300/14 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
                    {disabled
                      ? t("emptyDisabled")
                      : t("emptyPrompt")}
                  </div>
                ) : null}

                {visibleMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-[0_12px_28px_rgba(0,0,0,.14)] ${
                      message.role === "user"
                        ? "ml-auto border border-violet-300/18 bg-violet-500/18 text-violet-50"
                        : "mr-auto border border-white/10 bg-white/[0.045] text-slate-300"
                    }`}
                  >
                    {message.content}
                  </div>
                ))}

                {loading ? (
                  <div className="mr-auto max-w-[80%] rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-slate-400">
                    {t("typing")}
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                ) : null}
              </div>

              <form onSubmit={handleSubmit} className="border-t border-violet-200/12 p-3">
                <div className="flex items-end gap-2 rounded-3xl border border-violet-300/14 bg-white/[0.04] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    rows={1}
                    placeholder={disabled ? t("apiDisconnected") : t("placeholder")}
                    className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm text-[var(--app-text)] outline-none placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#8b5cf6,#d946ef)] text-white shadow-[0_12px_30px_rgba(139,92,246,.25)] transition duration-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={t("send")}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {confirmClearOpen ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-[max(16px,env(safe-area-inset-top))_16px_max(16px,env(safe-area-inset-bottom))] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onPointerDown={() => {
              if (!clearing) {
                setConfirmClearOpen(false);
              }
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-ai-chat-title"
              aria-describedby="clear-ai-chat-description"
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onPointerDown={(event) => event.stopPropagation()}
              className="w-[min(420px,calc(100vw-32px))] rounded-[28px] border border-violet-200/14 bg-[image:var(--app-card-bg)] p-5 shadow-[0_24px_80px_rgba(15,23,42,.55),inset_0_1px_0_rgba(255,255,255,.10)] backdrop-blur-2xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-300/18 bg-rose-500/12 text-rose-200 shadow-[0_14px_34px_rgba(244,63,94,.18)]">
                <Trash2 size={20} />
              </div>
              <h3 id="clear-ai-chat-title" className="mt-4 text-xl font-bold text-[var(--app-text)]">
                {t("clearTitle")}
              </h3>
              <p id="clear-ai-chat-description" className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                {t("clearDescription")}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  ref={cancelClearRef}
                  type="button"
                  onClick={() => setConfirmClearOpen(false)}
                  disabled={clearing}
                  className="min-h-11 rounded-2xl border border-violet-300/16 bg-white/[0.05] px-4 text-sm font-semibold text-[var(--app-text)] transition duration-400 hover:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-violet-300/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearChat}
                  disabled={clearing}
                  className="min-h-11 rounded-2xl border border-rose-300/22 bg-rose-500/16 px-4 text-sm font-semibold text-rose-100 shadow-[0_16px_38px_rgba(244,63,94,.18)] transition duration-400 hover:bg-rose-500/22 hover:shadow-[0_20px_46px_rgba(244,63,94,.24)] focus:outline-none focus:ring-2 focus:ring-rose-300/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {clearing ? t("deleting") : t("delete")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
