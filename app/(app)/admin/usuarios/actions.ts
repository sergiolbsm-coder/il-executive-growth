"use server";

import { revalidatePath } from "next/cache";
import { createUser, resetPassword, setActive, setMentorScope, updateUser, ValidationError } from "@/domains/users/service";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import type { MentorScope, UserRole } from "@/lib/db/schema";

export type GrantState = { error?: string; ok?: string; tempPassword?: string } | undefined;

const describe = (g: { mail: { sent: boolean }; tempPassword: string }): GrantState => ({
  ok: g.mail.sent ? "E-mail de liberação enviado." : "E-mail não enviado — repasse a senha por outro canal:",
  tempPassword: g.mail.sent ? undefined : g.tempPassword,
});

async function guard<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

export async function createUserAction(_: GrantState, form: FormData): Promise<GrantState> {
  const actor = toContext(await requireUser());
  const typed = String(form.get("password") ?? "").trim();
  const r = await guard(() =>
    createUser(actor, {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      role: String(form.get("role")) as UserRole,
      password: typed || undefined,
      mentorScope: form.get("mentorScope") === "all" ? "all" : "assigned",
    }),
  );
  revalidatePath("/admin/usuarios");
  return "error" in r ? r : describe(r);
}

export async function resetPasswordAction(id: string): Promise<GrantState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => resetPassword(actor, id));
  revalidatePath("/admin/usuarios");
  return "error" in r ? r : describe(r);
}

export async function toggleActiveAction(id: string, active: boolean): Promise<GrantState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => setActive(actor, id, active));
  revalidatePath("/admin/usuarios");
  return r && "error" in r ? r : undefined;
}

export async function setScopeAction(id: string, scope: MentorScope): Promise<GrantState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => setMentorScope(actor, id, scope));
  revalidatePath("/admin/usuarios");
  return r && "error" in r ? r : undefined;
}

export async function updateUserAction(id: string, name: string, email: string): Promise<GrantState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => updateUser(actor, id, { name, email }));
  revalidatePath("/admin/usuarios");
  revalidatePath("/app/mentorados");
  return r && "error" in r ? r : { ok: "Dados atualizados." };
}
