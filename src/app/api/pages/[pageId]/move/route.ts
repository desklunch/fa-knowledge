import { NextResponse } from "next/server";
import { z } from "zod";

import { movePage } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";

const movePageSchema = z.object({
  destinationParentPageId: z.string().uuid().nullable().optional(),
  destinationIndex: z.number().int().min(0).nullable().optional(),
  destinationWorkspaceId: z.string().uuid().nullable().optional(),
  weakeningStrategy: z.enum(["inherit", "preserve"]).optional(),
  destinationExplicitReadLevel: z.number().int().min(1).max(3).nullable().optional(),
  destinationExplicitWriteLevel: z.number().int().min(1).max(3).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const actingUserId = await getImpersonatedUserId();

  if (!actingUserId) {
    return NextResponse.json({ error: "No active user selected." }, { status: 401 });
  }

  const body = await request.json();
  const parsedBody = movePageSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid move payload." }, { status: 400 });
  }

  try {
    const { pageId } = await params;
    const result = await movePage({
      actingUserId,
      pageId,
      destinationParentPageId: parsedBody.data.destinationParentPageId ?? null,
      destinationIndex: parsedBody.data.destinationIndex ?? null,
      destinationWorkspaceId: parsedBody.data.destinationWorkspaceId ?? null,
      weakeningStrategy: parsedBody.data.weakeningStrategy,
      destinationExplicitReadLevel: parsedBody.data.destinationExplicitReadLevel ?? null,
      destinationExplicitWriteLevel: parsedBody.data.destinationExplicitWriteLevel ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to move page.";
    const status = message.includes("permission") ? 403 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
