"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Paperclip, Send, X } from "lucide-react";

import type { AgentThreadView, EntityReference } from "@/lib/agent";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AgentRailProps = {
  initialThread: AgentThreadView;
  selectedPageAttachment: EntityReference | null;
};

type ThreadResponse =
  | {
      thread: AgentThreadView;
    }
  | {
      error: string;
    };

export function AgentRail({
  initialThread,
  selectedPageAttachment,
}: AgentRailProps) {
  const router = useRouter();
  const [thread, setThread] = useState(initialThread);
  const [message, setMessage] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<EntityReference[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = scrollContainerRef.current;

    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [thread.messages.length]);

  const canAttachCurrentPage =
    selectedPageAttachment &&
    !pendingAttachments.some((attachment) => attachment.entityId === selectedPageAttachment.entityId);

  const sortedMessages = useMemo(
    () =>
      [...thread.messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [thread.messages],
  );

  const handleAttachCurrentPage = () => {
    if (!selectedPageAttachment) {
      return;
    }

    setPendingAttachments((current) => [...current, selectedPageAttachment]);
  };

  const handleRemoveAttachment = (entityId: string) => {
    setPendingAttachments((current) =>
      current.filter((attachment) => attachment.entityId !== entityId),
    );
  };

  const handleSend = async () => {
    if (!message.trim() || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/agent/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: message,
          attachments: pendingAttachments,
        }),
      });
      const payload = (await response.json()) as ThreadResponse;

      if (!response.ok || !("thread" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Failed to send message.");
      }

      setThread(payload.thread);
      setMessage("");
      setPendingAttachments([]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const handleAction = async (actionId: string) => {
    try {
      setError(null);
      const response = await fetch("/api/agent/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ actionId }),
      });
      const payload = (await response.json()) as ThreadResponse;

      if (!response.ok || !("thread" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Failed to execute action.");
      }

      setThread(payload.thread);
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to execute action.");
    }
  };

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col border-l border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-4 py-3 h-14">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-white">
            <Bot className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-950">Agent</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2"
          ref={scrollContainerRef}
        >
          {sortedMessages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-600">
              Ask a question about SHVR knowledge or attach the current page to ground your request.
            </div>
          ) : null}

          {sortedMessages.map((entry) => (
            <article
              className={cn(
                "space-y-2 rounded-md px-3 py-3",
                entry.role === "assistant"
                  ? "bg-stone-100 text-stone-900"
                  : "bg-[#f4efe2] text-stone-900",
              )}
              key={entry.id}
            >
              {entry.attachments.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {entry.attachments.map((attachment) => (
                    <AttachmentChip attachment={attachment} key={`${entry.id}-${attachment.entityId}`} />
                  ))}
                </div>
              ) : null}

              <div className="whitespace-pre-wrap text-sm leading-5">{entry.content}</div>

              {entry.citations.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {entry.citations.map((citation) => (
                    <Link
                      className="rounded-lg border border-stone-300 px-2 py-1 text-[11px] font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                      href={citation.href}
                      key={`${entry.id}-${citation.pageId}`}
                    >
                      Source: {citation.pageTitle}
                    </Link>
                  ))}
                </div>
              ) : null}

              {entry.patchProposal ? (
                <div className="rounded-xl border border-stone-300 bg-white/80 p-3 text-xs text-stone-700">
                  <p className="font-semibold text-stone-900">Patch proposal</p>
                  <p className="mt-1">Target page ID: {entry.patchProposal.targetPageId}</p>
                  <p className="mt-1">{entry.patchProposal.rationale}</p>
                </div>
              ) : null}

              {entry.actions.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {entry.actions.map((action) => (
                    <Button
                      disabled={action.status !== "pending"}
                      key={action.id}
                      onClick={() => void handleAction(action.id)}
                      size="sm"
                      type="button"
                      variant={action.actionType === "apply_page_patch" ? "default" : "outline"}
                    >
                      {action.status === "pending" ? action.label : action.outcomeMessage ?? action.label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <div className="border-t border-stone-200 space-y-2 bg-stone-50 px-2 py-2">
        {pendingAttachments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {pendingAttachments.map((attachment) => (
                  <button
                    className="inline-flex items-center gap-2 rounded-sm border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                    key={attachment.entityId}
                    onClick={() => handleRemoveAttachment(attachment.entityId)}
                    type="button"
                  >
                    <span>{attachment.label}</span>
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            ) : (
              null
            )}

            <label className="block">
              <span className="sr-only">Message the SHVR Research Agent</span>
              <textarea
                className="min-h-10 max-h-36 field-sizing-content w-full resize-none rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-500"
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
                    return;
                  }

                  event.preventDefault();

                  if (!isSending && message.trim()) {
                    void handleSend();
                  }
                }}
                placeholder="Enter a message..."
                value={message}

              />
            </label>

            {error ? <p className="text-xs text-red-700">{error}</p> : null}

            <div className="flex justify-between">

              <Button
                disabled={!canAttachCurrentPage}
                onClick={handleAttachCurrentPage}
                size="sm"
                type="button"
                variant="outline"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Attach Current Page
              </Button>
              <Button disabled={isSending || !message.trim()} onClick={() => void handleSend()} type="button" size="sm">
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
        </div>
      </div>
    </aside>
  );
}

function AttachmentChip({ attachment }: { attachment: EntityReference }) {
  return (
    <Link
      className="inline-flex items-center rounded-md border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
      href={attachment.href}
    >
      {attachment.label}
    </Link>
  );
}
