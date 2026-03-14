import { NextResponse } from "next/server";

import { restorePageRevision } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ pageId: string; revisionId: string }> },
) {
  const actingUserId = await getImpersonatedUserId();

  if (!actingUserId) {
    return NextResponse.json({ error: "No active user selected." }, { status: 401 });
  }

  try {
    const { pageId, revisionId } = await params;
    const result = await restorePageRevision({
      actingUserId,
      pageId,
      revisionId,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to restore page revision.";
    const status = message.includes("permission") ? 403 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
