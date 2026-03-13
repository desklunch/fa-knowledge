import { NextResponse } from "next/server";
import { z } from "zod";

import { searchKnowledgeBase } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";

const searchSchema = z.object({
  q: z.string().trim().min(3).max(200),
});

export async function GET(request: Request) {
  const actingUserId = await getImpersonatedUserId();

  if (!actingUserId) {
    return NextResponse.json({ error: "No active user selected." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = searchSchema.safeParse({
    q: searchParams.get("q") ?? "",
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchKnowledgeBase({
    userId: actingUserId,
    query: parsedQuery.data.q,
  });

  return NextResponse.json(results);
}
