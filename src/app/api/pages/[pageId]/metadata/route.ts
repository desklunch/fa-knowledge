import { NextResponse } from "next/server";
import { z } from "zod";

import { updatePageMetadata } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";

const updateMetadataSchema = z.object({
  explicitReadLevel: z.number().int().min(1).max(3).nullable().optional(),
  explicitWriteLevel: z.number().int().min(1).max(3).nullable().optional(),
  descendantStrategy: z.enum(["cascade", "preserve"]).optional(),
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
  const parsedBody = updateMetadataSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid metadata payload." }, { status: 400 });
  }

  try {
    const { pageId } = await params;
    const result = await updatePageMetadata({
      actingUserId,
      pageId,
      explicitReadLevel: parsedBody.data.explicitReadLevel ?? null,
      explicitWriteLevel: parsedBody.data.explicitWriteLevel ?? null,
      descendantStrategy: parsedBody.data.descendantStrategy,
    });

    return NextResponse.json({
      page: result.page,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update page metadata.";
    const status = message.includes("permission") ? 403 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
