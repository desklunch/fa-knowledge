import { NextResponse } from "next/server";
import { z } from "zod";

import { createPage } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";

const createPageSchema = z.object({
  workspaceId: z.string().uuid(),
  parentPageId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  contentMarkdown: z.string().min(1),
  explicitReadLevel: z.number().int().min(1).max(3).nullable().optional(),
  explicitWriteLevel: z.number().int().min(1).max(3).nullable().optional(),
});

export async function POST(request: Request) {
  const actingUserId = await getImpersonatedUserId();

  if (!actingUserId) {
    return NextResponse.json({ error: "No active user selected." }, { status: 401 });
  }

  const body = await request.json();
  const parsedBody = createPageSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid page payload." }, { status: 400 });
  }

  try {
    const result = await createPage({
      actingUserId,
      workspaceId: parsedBody.data.workspaceId,
      parentPageId: parsedBody.data.parentPageId ?? null,
      title: parsedBody.data.title,
      contentMarkdown: parsedBody.data.contentMarkdown,
      explicitReadLevel: parsedBody.data.explicitReadLevel ?? null,
      explicitWriteLevel: parsedBody.data.explicitWriteLevel ?? null,
    });

    return NextResponse.json({
      page: result.page,
      revision: result.revision,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create page.";
    const status = message.includes("permission") ? 403 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
