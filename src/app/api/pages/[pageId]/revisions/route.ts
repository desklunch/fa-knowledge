import { NextResponse } from "next/server";

import { getPageRevisions } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const actingUserId = await getImpersonatedUserId();

  if (!actingUserId) {
    return NextResponse.json({ error: "No active user selected." }, { status: 401 });
  }

  try {
    const { pageId } = await params;
    const revisions = await getPageRevisions({
      actingUserId,
      pageId,
    });

    return NextResponse.json({ revisions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load revisions.";
    const status = message.includes("permission") ? 403 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
