"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { changePasswordAction } from "../actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action}>
      <label htmlFor="current">Senha atual (ou provisória)</label>
      <input id="current" name="current" type="password" autoComplete="current-password" required />
      <label htmlFor="next">Nova senha (mín. 8 caracteres)</label>
      <input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
      <label htmlFor="confirm">Confirmar nova senha</label>
      <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      {state?.error && <div className="msg err">{state.error}</div>}
      <SubmitButton>Salvar senha</SubmitButton>
    </form>
  );
}
