import { NextResponse } from "next/server";

import { setImpersonatedUserId } from "@/lib/impersonation";
import { getAvailableUsers } from "@/lib/knowledge-base";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user");
  const pageId = searchParams.get("page");
  const users = await getAvailableUsers();
  const redirectUrl = new URL("/", request.url);

  if (pageId) {
    redirectUrl.searchParams.set("page", pageId);
  }

  const isKnownUser = users.some((user) => user.id === userId);

  if (!userId || !isKnownUser) {
    return NextResponse.redirect(redirectUrl);
  }

  await setImpersonatedUserId(userId);

  return NextResponse.redirect(redirectUrl);
}
