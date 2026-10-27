import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthContext } from "@/lib/authorization";
import type { User } from "@/lib/db/schema";
import { SESSION_DAYS, resolveSession } from "./core";

export const SESSION_COOKIE = "ilg_session";

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Uma consulta de sessão por requisição (o layout e a página compartilham o resultado). */
export const getCurrentUser = cache(async (): Promise<User | null> => resolveSession(await getSessionToken()));

/** Sessão para ESCRITAS (server actions) e páginas: exige login e, salvo exceção, senha já trocada. */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/trocar-senha");
  return user;
}

export const toContext = (u: User): AuthContext => ({ userId: u.id, role: u.role, mentorScope: u.mentorScope });
