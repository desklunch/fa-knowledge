"use client";

import Link from "next/link";

type RecentActivityItem = {
  actorName: string;
  createdAt: Date;
  eventType: "page_created" | "page_edited" | "page_renamed" | "page_moved" | "page_deleted";
  href: string | null;
  id: string;
  message: string;
  pageId: string | null;
};

type RecentViewProps = {
  recentActivity: RecentActivityItem[];
};

export function RecentView({ recentActivity }: RecentViewProps) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[1.5rem] border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Activity
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
            Recent
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
            A reverse-chronological feed of recent activity in the shared workspace.
          </p>
        </div>

        <section className="rounded-[1.5rem] border border-stone-200 bg-[#f7f5ef] p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-stone-900">Shared workspace activity</h3>
            <p className="mt-1 text-xs leading-6 text-stone-500">
              Page creation, edits, renames, moves, and deletions that are visible to you.
            </p>
          </div>

          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) =>
                activity.href ? (
                  <Link
                    className="block rounded-xl border border-stone-200 bg-white px-4 py-3 transition hover:border-stone-300 hover:bg-stone-50"
                    href={activity.href}
                    key={activity.id}
                  >
                    <p className="text-sm font-medium text-stone-900">{activity.message}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {formatRelativeTime(activity.createdAt)}
                    </p>
                  </Link>
                ) : (
                  <div
                    className="rounded-xl border border-stone-200 bg-white px-4 py-3"
                    key={activity.id}
                  >
                    <p className="text-sm font-medium text-stone-900">{activity.message}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {formatRelativeTime(activity.createdAt)}
                    </p>
                  </div>
                ),
              )
            ) : (
              <div className="rounded-xl border border-dashed border-stone-300 bg-white/70 px-4 py-6 text-sm text-stone-500">
                No shared workspace activity is available yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function formatRelativeTime(value: Date) {
  const target = new Date(value);
  const diffMs = Date.now() - target.getTime();

  if (diffMs < 60_000) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);

  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}
