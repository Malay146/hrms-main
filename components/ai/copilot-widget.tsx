"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { History, Plus, Trash2, X } from "lucide-react";
import AiIcon from "@/components/icons/sidebar/ai";
import { cn } from "@/utils/cn";
import {
  askHrCopilot,
  clearCopilotHistoryAction,
  deleteCopilotConversationAction,
  listCopilotConversations,
  listCopilotHistory,
} from "@/lib/actions/ai";
import type { CopilotConversationSummary, CopilotHistoryItem } from "@/lib/shared/types";

function formatStamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CopilotWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<CopilotHistoryItem[]>([]);
  const [conversations, setConversations] = useState<CopilotConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [freshChat, setFreshChat] = useState(false);
  const [pending, startTransition] = useTransition();
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, open, view]);

  function openAssistant() {
    setView("chat");
    setOpen(true);
    setLoadingHistory(true);
    startTransition(async () => {
      const [threadList, history] = await Promise.all([
        listCopilotConversations(),
        listCopilotHistory(freshChat ? null : conversationId),
      ]);
      setLoadingHistory(false);
      if (!threadList.ok) {
        setError(threadList.error);
        return;
      }
      setConversations(threadList.data);
      if (!history.ok) {
        setError(history.error);
        return;
      }
      if (freshChat) {
        setMessages([]);
        setAwaitingConfirm(false);
        return;
      }
      setConversationId(history.data.conversationId);
      setMessages(history.data.messages);
      setAwaitingConfirm(Boolean(history.data.pendingSummary));
    });
  }

  function loadConversation(id: string) {
    setFreshChat(false);
    setConversationId(id);
    setView("chat");
    setLoadingHistory(true);
    startTransition(async () => {
      const result = await listCopilotHistory(id);
      setLoadingHistory(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConversationId(result.data.conversationId);
      setMessages(result.data.messages);
      setAwaitingConfirm(Boolean(result.data.pendingSummary));
    });
  }

  function startNewChat() {
    setFreshChat(true);
    setConversationId(null);
    setMessages([]);
    setQuestion("");
    setError(null);
    setAwaitingConfirm(false);
    setView("chat");
  }

  function submitText(text: string) {
    if (!text || sending) return;
    const optimistic: CopilotHistoryItem = {
      id: `local-${Date.now()}`,
      role: "user",
      body: text,
      source: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setQuestion("");
    setError(null);
    setSending(true);
    setAwaitingConfirm(false);
    startTransition(async () => {
      const result = await askHrCopilot(text, conversationId);
      setSending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFreshChat(false);
      setConversationId(result.data.conversationId);
      setAwaitingConfirm(Boolean(result.data.needsConfirmation));
      setMessages((prev) => [
        ...prev,
        {
          id: `local-a-${Date.now()}`,
          role: "assistant",
          body: result.data.answer,
          source: result.data.source,
          createdAt: new Date().toISOString(),
        },
      ]);
      if (result.data.acted) router.refresh();
      const threads = await listCopilotConversations();
      if (threads.ok) setConversations(threads.data);
    });
  }

  function send(event: React.FormEvent) {
    event.preventDefault();
    submitText(question.trim());
  }

  function deleteThread(id: string) {
    startTransition(async () => {
      const result = await deleteCopilotConversationAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConversations((prev) => prev.filter((row) => row.id !== id));
      if (conversationId === id) startNewChat();
    });
  }

  function clearAll() {
    startTransition(async () => {
      const result = await clearCopilotHistoryAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConversations([]);
      startNewChat();
    });
  }

  if (!pathname.startsWith("/admin")) return null;

  return (
    <>
      <button
        type="button"
        onClick={openAssistant}
        aria-label="Open HR assistant"
        className="fixed bottom-6 right-6 z-40 size-12 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white shadow-2xs active:scale-98 flex items-center justify-center cursor-pointer"
      >
        <AiIcon className="size-5" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close HR assistant"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[100] cursor-default bg-overlay backdrop-blur-[2px] animate-in fade-in duration-200"
          />
          <div className="fixed inset-0 z-[110] flex items-end justify-end p-4 sm:p-6 pointer-events-none">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="copilot-title"
              className="pointer-events-auto w-full max-w-md h-[min(560px,calc(100vh-4rem))] bg-surface border border-border rounded-2xl shadow-lg flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
                <div className="min-w-0">
                  <h2 id="copilot-title" className="text-base font-semibold text-zinc-950">
                    HR assistant
                  </h2>
                  <p className="text-xs font-medium text-zinc-500 mt-0.5">
                    Ask about the team. Changes wait for your confirmation.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setView(view === "history" ? "chat" : "history")}
                    className={cn(
                      "cursor-pointer p-1.5 rounded-lg border text-zinc-500 hover:text-zinc-800 hover:bg-surface-hover",
                      view === "history" ? "border-zinc-900 text-zinc-950" : "border-border",
                    )}
                    aria-label="Chat history"
                  >
                    <History className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={startNewChat}
                    className="cursor-pointer p-1.5 rounded-lg border border-border text-zinc-500 hover:text-zinc-800 hover:bg-surface-hover"
                    aria-label="New chat"
                  >
                    <Plus className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="cursor-pointer p-1.5 rounded-lg border border-border text-zinc-400 hover:text-zinc-800 hover:bg-surface-hover"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {view === "history" ? (
                <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-zinc-500">Previous chats</p>
                    {conversations.length > 0 ? (
                      <button
                        type="button"
                        onClick={clearAll}
                        disabled={pending}
                        className="cursor-pointer text-xs font-semibold text-zinc-500 hover:text-zinc-950"
                      >
                        Clear all
                      </button>
                    ) : null}
                  </div>
                  {conversations.length === 0 ? (
                    <p className="text-sm font-medium text-zinc-400 text-center py-10">No saved chats yet.</p>
                  ) : (
                    conversations.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-start gap-2 rounded-xl border border-border bg-zinc-50 px-3 py-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => loadConversation(row.id)}
                          className="min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <p className="text-sm font-semibold text-zinc-950 truncate">{row.title}</p>
                          <p className="text-[11px] font-medium text-zinc-500 truncate mt-0.5">
                            {row.preview || "Empty chat"}
                          </p>
                          <p className="text-[11px] font-medium text-zinc-400 mt-1">{formatStamp(row.updatedAt)}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteThread(row.id)}
                          aria-label="Delete chat"
                          className="cursor-pointer p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-surface"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <>
                  <div ref={scroller} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                    {loadingHistory && messages.length === 0 ? (
                      <p className="text-sm font-medium text-zinc-400 text-center py-10">Loading…</p>
                    ) : messages.length === 0 ? (
                      <div className="text-sm font-medium text-zinc-400 text-center py-8 flex flex-col gap-2">
                        <p>Hi — I’m your HR assistant. Ask about leave, attendance, or the team.</p>
                        <p>Try “Hi there” or “Who is on leave today?”</p>
                      </div>
                    ) : (
                      messages.map((row) => (
                        <div
                          key={row.id}
                          className={cn(
                            "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm",
                            row.role === "user"
                              ? "self-end bg-zinc-900 text-white"
                              : "self-start bg-zinc-50 border border-border text-zinc-900",
                          )}
                        >
                          <p className="font-medium leading-relaxed whitespace-pre-wrap">{row.body}</p>
                          {row.role === "assistant" &&
                          row.source &&
                          row.source !== "HR assistant" &&
                          row.source !== "Needs your confirmation" ? (
                            <p className="mt-1.5 text-[11px] font-medium text-zinc-500">Used: {row.source}</p>
                          ) : null}
                        </div>
                      ))
                    )}
                    {awaitingConfirm && !sending ? (
                      <div className="self-start flex gap-2">
                        <button
                          type="button"
                          onClick={() => submitText("Confirm")}
                          className="cursor-pointer h-9 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white shadow-2xs active:scale-98"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => submitText("Cancel")}
                          className="cursor-pointer h-9 px-3 rounded-lg border border-border bg-surface hover:bg-surface-hover text-xs font-semibold text-zinc-800"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                    {sending ? (
                      <p className="text-xs font-semibold text-zinc-400 self-start">Working…</p>
                    ) : null}
                  </div>

                  {error ? <p className="px-5 text-xs font-medium text-red-600">{error}</p> : null}

                  <form onSubmit={send} className="px-5 py-4 border-t border-border flex gap-2">
                    <input
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      placeholder="Ask a question…"
                      className="h-10 flex-1 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
                    />
                    <button
                      type="submit"
                      disabled={sending || !question.trim()}
                      className="cursor-pointer h-10 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 disabled:opacity-50"
                    >
                      Send
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
