import { NextResponse } from "next/server";
import { z } from "zod";

import { executeAgentAction } from "@/lib/agent";
import { getImpersonatedUserId } from "@/lib/impersonation";

const executeAgentActionSchema = z.object({
  actionId: z.string().uuid(),
});

export async function POST(request: Request) {
  const actingUserId = await getImpersonatedUserId();

  if (!actingUserId) {
    return NextResponse.json({ error: "No active user selected." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = executeAgentActionSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid agent action payload." }, { status: 400 });
  }

  try {
    const thread = await executeAgentAction({
      actingUserId,
      actionId: parsedBody.data.actionId,
    });

    return NextResponse.json({ thread });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to execute action.";
    const status =
      message.includes("permission") || message.includes("Action is no longer available.")
        ? 403
        : message.includes("newer revision")
          ? 409
          : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
