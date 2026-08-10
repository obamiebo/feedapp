"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, Loader2, MessageSquare, Send, X, XCircle } from "lucide-react";
import type { AgentProposedAction } from "@/lib/agent-actions";
import { cn } from "@/lib/cn";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  actions?: AgentProposedAction[];
};

type AgentChatWidgetProps = {
  compact?: boolean;
};

export function AgentChatWidget({ compact = false }: AgentChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Ask about feedback counts, case status, SLA risk, or what should happen next on a case."
    }
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [actionDecisions, setActionDecisions] = useState<Record<string, "confirming" | "dismissing" | "confirmed" | "dismissed" | "failed">>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const launcherClass = useMemo(
    () =>
      cn(
        "group fixed z-40 inline-flex items-center justify-center rounded-full bg-brand text-white shadow-[0_18px_42px_rgba(11,153,213,0.34)] transition-colors hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
        compact ? "bottom-4 right-4 size-12" : "bottom-6 right-6 size-14"
      ),
    [compact]
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setPending(true);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          message: text,
          conversationId
        })
      });
      const payload = (await response.json()) as {
        message?: string;
        conversationId?: string;
        proposedActions?: AgentProposedAction[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Agent chat failed");
      }

      setConversationId(payload.conversationId ?? conversationId);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: payload.message ?? "No response returned.",
          actions: payload.proposedActions ?? []
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "system",
          text: error instanceof Error ? error.message : "Agent chat failed"
        }
      ]);
    } finally {
      setPending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  async function decideAction(action: AgentProposedAction, decision: "confirm" | "dismiss") {
    const inFlight = decision === "confirm" ? "confirming" : "dismissing";
    setActionDecisions((current) => ({ ...current, [action.id]: inFlight }));

    try {
      const response = await fetch("/api/agent/actions", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ decision, action })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Agent action failed");
      }

      setActionDecisions((current) => ({
        ...current,
        [action.id]: decision === "confirm" ? "confirmed" : "dismissed"
      }));
      setMessages((current) => [
        ...current,
        {
          id: `action-${decision}-${Date.now()}`,
          role: "system",
          text:
            decision === "confirm"
              ? `Confirmed: ${actionLabel(action)}.`
              : `Dismissed: ${actionLabel(action)}.`
        }
      ]);
    } catch (error) {
      setActionDecisions((current) => ({ ...current, [action.id]: "failed" }));
      setMessages((current) => [
        ...current,
        {
          id: `action-error-${Date.now()}`,
          role: "system",
          text: error instanceof Error ? error.message : "Agent action failed"
        }
      ]);
    }
  }

  return (
    <>
      {open ? (
        <section className="fixed bottom-4 right-4 z-40 flex h-[min(680px,calc(100vh-2rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-[#9fb6d3] bg-panel shadow-[0_28px_70px_rgba(16,33,63,0.22)]">
          <header className="flex items-center gap-3 border-b border-[#c3d1e3] bg-panel-subtle px-4 py-3">
            <span className="inline-flex size-9 items-center justify-center rounded-md border border-info-bg bg-info-bg text-brand shadow-sm">
              <Bot size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">FeedApp assistant</h2>
              <p className="text-xs text-muted">Counts, cases, risk, next actions</p>
            </div>
            <button
              className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-panel-muted hover:text-ink"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-[#f6f9fd] p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[88%] rounded-lg px-3 py-2 text-sm leading-6 shadow-sm [overflow-wrap:anywhere]",
                  message.role === "user"
                    ? "ml-auto bg-brand text-white shadow-[0_10px_24px_rgba(36,79,137,0.22)]"
                    : message.role === "system"
                      ? "border border-warning-bg bg-warning-bg text-warning"
                      : "border border-[#c3d1e3] bg-panel text-ink"
                )}
              >
                {message.text}
                {message.actions && message.actions.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {message.actions.map((action) => {
                      const state = actionDecisions[action.id];
                      const busy = state === "confirming" || state === "dismissing";
                      const done = state === "confirmed" || state === "dismissed";

                      return (
                        <div key={action.id} className="rounded-md border border-[#b8c9df] bg-panel-subtle p-3 text-ink">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-xs font-semibold uppercase tracking-wide text-brand">
                              Proposed action
                            </strong>
                            {state ? (
                              <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-xs font-medium text-muted">
                                {state}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm font-medium">{actionLabel(action)}</p>
                          <p className="mt-1 text-xs leading-5 text-muted">{action.reason}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                              type="button"
                              disabled={busy || done}
                              onClick={() => decideAction(action, "confirm")}
                            >
                              {state === "confirming" ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                              Confirm
                            </button>
                            <button
                              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-panel-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                              type="button"
                              disabled={busy || done}
                              onClick={() => decideAction(action, "dismiss")}
                            >
                              {state === "dismissing" ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                              Dismiss
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
            {pending ? (
              <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#c3d1e3] bg-panel px-3 py-2 text-sm text-muted shadow-sm">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Thinking
              </div>
            ) : null}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-[#c3d1e3] bg-panel p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about feedback operations..."
              className="min-w-0 flex-1 rounded-md border border-[#b8c9df] bg-panel px-3 py-2 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
            />
            <button
              className="inline-flex size-10 items-center justify-center rounded-md bg-brand text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="Send message"
            >
              {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
            </button>
          </form>
        </section>
      ) : (
        <button className={launcherClass} type="button" onClick={() => setOpen(true)} aria-label="Open FeedApp assistant">
          <span className="feedapp-breathe pointer-events-none absolute inset-[-9px] rounded-full border border-accent/45 bg-accent/10 shadow-[0_0_32px_rgba(11,153,213,0.42)]" />
          <span className="pointer-events-none absolute inset-[-17px] rounded-full border border-accent/20" />
          <span className="relative inline-flex size-full items-center justify-center rounded-full border border-white/20">
            <MessageSquare size={compact ? 20 : 23} aria-hidden="true" />
          </span>
        </button>
      )}
    </>
  );
}

function actionLabel(action: AgentProposedAction) {
  if (action.label) return action.label;

  if (action.type === "transition_case") {
    return `Move ${action.caseId} to ${action.toStatus}`;
  }

  return action.assigneeId
    ? `Assign ${action.caseId} to ${action.assigneeName ?? action.assigneeId}`
    : `Unassign ${action.caseId}`;
}
