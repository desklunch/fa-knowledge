import { cookies } from "next/headers";

export const IMPERSONATION_COOKIE = "fa_active_user";

export function getImpersonationCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function getImpersonatedUserId() {
  const cookieStore = await cookies();

  return cookieStore.get(IMPERSONATION_COOKIE)?.value ?? null;
}

export async function setImpersonatedUserId(userId: string) {
  const cookieStore = await cookies();

  cookieStore.set(IMPERSONATION_COOKIE, userId, getImpersonationCookieOptions());
}
