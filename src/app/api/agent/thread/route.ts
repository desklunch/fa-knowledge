import { NextResponse } from "next/server";

import { getAgentThread } from "@/lib/agent";
import { getImpersonatedUserId } from "@/lib/impersonation";

export async function GET() {
  const actingUserId = await getImpersonatedUserId();

  if (!actingUserId) {
    return NextResponse.json({ error: "No active user selected." }, { status: 401 });
  }

  try {
    const thread = await getAgentThread({ actingUserId });
    return NextResponse.json({ thread });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load agent thread.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
