import { NextResponse } from "next/server";
import { z } from "zod";

import { sendAgentMessage } from "@/lib/agent";
import { getImpersonatedUserId } from "@/lib/impersonation";

const attachmentSchema = z.object({
  entityType: z.enum(["page"]),
  entityId: z.string().uuid(),
  href: z.string().min(1),
  label: z.string().min(1),
});

const sendAgentMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export async function POST(request: Request) {
  const actingUserId = await getImpersonatedUserId();

  if (!actingUserId) {
    return NextResponse.json({ error: "No active user selected." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = sendAgentMessageSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid agent message payload." }, { status: 400 });
  }

  try {
    const result = await sendAgentMessage({
      actingUserId,
      content: parsedBody.data.content,
      attachments: parsedBody.data.attachments,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send agent message.";
    const status = message.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
