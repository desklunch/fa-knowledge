import { cookies } from "next/headers";

const IMPERSONATION_COOKIE = "fa_active_user";

export async function getImpersonatedUserId() {
  const cookieStore = await cookies();

  return cookieStore.get(IMPERSONATION_COOKIE)?.value ?? null;
}

export async function setImpersonatedUserId(userId: string) {
  const cookieStore = await cookies();

  cookieStore.set(IMPERSONATION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
