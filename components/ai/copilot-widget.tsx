"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { History, Plus, Search, Trash2, X } from "lucide-react";
import ChatIcon from "@/components/icons/chatbot/ChatIcon";
import { cn } from "@/utils/cn";
import {
  askHrCopilot,
  clearCopilotHistoryAction,
  deleteCopilotConversationAction,
  listCopilotConversations,
  listCopilotHistory,
} from "@/lib/actions/ai";
import type { CopilotConversationSummary, CopilotHistoryItem } from "@/lib/shared/types";

function dayBucket(iso: string, now = new Date()) {
  const date = new Date(iso);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday.getTime() - 86_400_000);
  if (date >= startToday) return "Today";
  if (date >= startYesterday) return "Yesterday";
  return "Earlier";
}

function groupConversations(rows: CopilotConversationSummary[]) {
  const order = ["Today", "Yesterday", "Earlier"] as const;
  const map = new Map<string, CopilotConversationSummary[]>();
  for (const label of order) map.set(label, []);
  for (const row of rows) {
    const key = dayBucket(row.updatedAt);
    map.get(key)!.push(row);
  }
  return order
    .map((label) => ({ label, rows: map.get(label)! }))
    .filter((group) => group.rows.length > 0);
}

export function CopilotWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
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
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (!historyOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [historyOpen]);

  const filteredConversations = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        (row.preview ?? "").toLowerCase().includes(q),
    );
  }, [conversations, historyQuery]);

  const grouped = useMemo(() => groupConversations(filteredConversations), [filteredConversations]);

  function openAssistant() {
    setHistoryOpen(false);
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

  function toggleHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) {
      setHistoryQuery("");
      startTransition(async () => {
        const threads = await listCopilotConversations();
        if (threads.ok) setConversations(threads.data);
      });
    }
  }

  function loadConversation(id: string) {
    setFreshChat(false);
    setConversationId(id);
    setHistoryOpen(false);
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
    setHistoryOpen(false);
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
        className="fixed bottom-6 right-6 z-40 size-14 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white shadow-2xs active:scale-98 flex items-center justify-center cursor-pointer"
      >
        <ChatIcon className="size-7 text-white" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close HR assistant"
            onClick={() => {
              setHistoryOpen(false);
              setOpen(false);
            }}
            className="fixed inset-0 z-[100] cursor-default bg-overlay backdrop-blur-[2px] animate-in fade-in duration-200"
          />
          <div className="fixed inset-0 z-[110] flex items-end justify-end p-4 sm:p-6 pointer-events-none">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="copilot-title"
              className="pointer-events-auto relative w-full max-w-md h-[min(560px,calc(100vh-4rem))] bg-surface border border-border rounded-2xl shadow-lg flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
                <h2 id="copilot-title" className="text-base font-semibold text-zinc-950">
                  HR assistant
                </h2>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="relative" ref={historyRef}>
                    <button
                      type="button"
                      onClick={toggleHistory}
                      className={cn(
                        "cursor-pointer p-1.5 rounded-lg border text-zinc-500 hover:text-zinc-800 hover:bg-surface-hover transition-colors",
                        historyOpen ? "border-zinc-900 text-zinc-950 bg-zinc-50" : "border-border",
                      )}
                      aria-label="Chat history"
                      aria-expanded={historyOpen}
                    >
                      <History className="size-4" />
                    </button>

                    {historyOpen ? (
                      <div
                        role="menu"
                        aria-label="Previous chats"
                        className="absolute right-0 top-[calc(100%+6px)] z-20 w-[200px] origin-top-right rounded-lg border border-border bg-surface shadow-md animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
                      >
                        <div className="p-1.5">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-zinc-400" />
                            <input
                              value={historyQuery}
                              onChange={(event) => setHistoryQuery(event.target.value)}
                              placeholder="Search…"
                              className="h-7 w-full rounded-md border-0 bg-zinc-50 pl-7 pr-2 text-[11px] font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-border-strong"
                              autoFocus
                            />
                          </div>
                        </div>

                        <div className="max-h-[220px] overflow-y-auto px-1 pb-1">
                          {pending && conversations.length === 0 ? (
                            <p className="px-1.5 py-3 text-center text-[11px] font-medium text-zinc-400">
                              Loading…
                            </p>
                          ) : grouped.length === 0 ? (
                            <p className="px-1.5 py-3 text-center text-[11px] font-medium text-zinc-400">
                              {historyQuery.trim() ? "No matches." : "No chats yet."}
                            </p>
                          ) : (
                            grouped.map((group) => (
                              <div key={group.label} className="mb-0.5">
                                <p className="px-1.5 pt-1 pb-0.5 text-[10px] font-semibold text-zinc-400">
                                  {group.label}
                                </p>
                                <div className="flex flex-col">
                                  {group.rows.map((row) => {
                                    const active = row.id === conversationId;
                                    return (
                                      <div
                                        key={row.id}
                                        className={cn(
                                          "group flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors",
                                          active ? "bg-zinc-100" : "hover:bg-zinc-50",
                                        )}
                                      >
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => loadConversation(row.id)}
                                          className="min-w-0 flex-1 cursor-pointer text-left"
                                        >
                                          <span
                                            className={cn(
                                              "block truncate text-[12px] font-medium leading-tight",
                                              active ? "text-zinc-950" : "text-zinc-700",
                                            )}
                                          >
                                            {row.title}
                                          </span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => deleteThread(row.id)}
                                          aria-label="Delete chat"
                                          className="cursor-pointer shrink-0 rounded p-0.5 text-zinc-300 opacity-0 transition-opacity hover:bg-surface hover:text-red-600 group-hover:opacity-100"
                                        >
                                          <Trash2 className="size-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {conversations.length > 0 ? (
                          <div className="border-t border-border px-1 py-1">
                            <button
                              type="button"
                              onClick={clearAll}
                              disabled={pending}
                              className="cursor-pointer w-full rounded-md px-1.5 py-1 text-left text-[11px] font-semibold text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50"
                            >
                              Clear all
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={startNewChat}
                    className="cursor-pointer p-1.5 rounded-lg border border-border text-zinc-500 hover:text-zinc-800 hover:bg-surface-hover transition-colors"
                    aria-label="New chat"
                  >
                    <Plus className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryOpen(false);
                      setOpen(false);
                    }}
                    className="cursor-pointer p-1.5 rounded-lg border border-border text-zinc-400 hover:text-zinc-800 hover:bg-surface-hover transition-colors"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div ref={scroller} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {loadingHistory && messages.length === 0 ? (
                  <p className="text-sm font-medium text-zinc-400 text-center py-10">Loading…</p>
                ) : messages.length === 0 ? (
                  <div className="text-sm font-medium text-zinc-400 text-center py-8 px-6 flex flex-col gap-2">
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
                  placeholder="Say hi, ask a question, or give an instruction…"
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
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
