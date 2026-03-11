import { NextResponse } from "next/server";
import { z } from "zod";

import { deletePage, savePage } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";

const savePageSchema = z.object({
  title: z.string().min(1),
  contentMarkdown: z.string().min(1),
  editorDocJson: z.unknown().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const actingUserId = await getImpersonatedUserId();

  if (!actingUserId) {
    return NextResponse.json({ error: "No active user selected." }, { status: 401 });
  }

  const body = await request.json();
  const parsedBody = savePageSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid page payload." }, { status: 400 });
  }

  try {
    const { pageId } = await params;
    const result = await savePage({
      actingUserId,
      pageId,
      ...parsedBody.data,
    });

    return NextResponse.json({
      page: result.page,
      revision: result.revision,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save page.";
    const status = message.includes("permission") ? 403 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const actingUserId = await getImpersonatedUserId();

  if (!actingUserId) {
    return NextResponse.json({ error: "No active user selected." }, { status: 401 });
  }

  try {
    const { pageId } = await params;
    const result = await deletePage({
      actingUserId,
      pageId,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete page.";
    const status = message.includes("permission") ? 403 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
