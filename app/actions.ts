"use server";

import { redirect } from "next/navigation";
import { changeOwnPassword, ValidationError } from "@/domains/users/service";
import { destroySession, login } from "@/lib/auth/core";
import { clearSessionCookie, getSessionToken, requireUser, setSessionCookie } from "@/lib/auth/session";

export type FormState = { error?: string } | undefined;

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const result = await login(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!result.ok) {
    return { error: result.reason === "locked" ? "Muitas tentativas. Aguarde alguns minutos." : "E-mail ou senha inválidos." };
  }
  await setSessionCookie(result.token);
  redirect(result.user.mustChangePassword ? "/trocar-senha" : "/app/dashboard");
}

export async function logoutAction() {
  await destroySession(await getSessionToken());
  await clearSessionCookie();
  redirect("/login");
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser({ allowPasswordChange: true });
  const next = String(form.get("next") ?? "");
  if (next !== String(form.get("confirm") ?? "")) return { error: "A confirmação não confere." };
  try {
    await changeOwnPassword(user.id, String(form.get("current") ?? ""), next);
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    throw e;
  }
  redirect("/app/dashboard");
}
