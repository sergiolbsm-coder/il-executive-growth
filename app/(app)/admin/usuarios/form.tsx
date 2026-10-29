"use client";

import { useActionState, useState, useTransition } from "react";
import { SaveState, SubmitButton } from "@/components/ui";
import { createUserAction, resetPasswordAction, setScopeAction, toggleActiveAction, updateUserAction, type GrantState } from "./actions";

export function NewUserForm() {
  const [state, action] = useActionState(createUserAction, undefined);
  const [role, setRole] = useState("mentor");
  return (
    <form action={action} className="card">
      <h2 className="h2">Liberar novo acesso</h2>
      <label htmlFor="name">Nome</label>
      <input id="name" name="name" required />
      <label htmlFor="email">E-mail</label>
      <input id="email" name="email" type="email" required />
      <label htmlFor="role">Perfil</label>
      <select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="mentor">Mentor</option>
        <option value="direcao">Direção</option>
        <option value="admin">Administração</option>
        <option value="mentorado">Mentorado (prefira cadastrar pela tela de Mentorados)</option>
      </select>
      {role === "mentor" && (
        <>
          <label htmlFor="mentorScope">Carteira do mentor</label>
          <select id="mentorScope" name="mentorScope" defaultValue="assigned">
            <option value="assigned">Só os mentorados atribuídos a ele</option>
            <option value="all">Todos os mentorados</option>
          </select>
        </>
      )}
      <label htmlFor="password">Senha provisória (opcional — vazio gera uma)</label>
      <input id="password" name="password" type="text" minLength={8} autoComplete="off" />
      {state?.error && <div className="msg err">{state.error}</div>}
      {state?.ok && <div className="msg ok">{state.ok} {state.tempPassword && <code className="pw">{state.tempPassword}</code>}</div>}
      <SubmitButton pendingLabel="Criando…">Liberar acesso</SubmitButton>
    </form>
  );
}

export function RowActions({ id, active, self, role, scope, name, email }: { id: string; active: boolean; self: boolean; role: string; scope: string; name: string; email: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<GrantState>();
  const [editing, setEditing] = useState(false);
  const run = (fn: () => Promise<GrantState>) => start(async () => setRes(await fn()));
  const save = (form: FormData) =>
    start(async () => {
      const r = await updateUserAction(id, String(form.get("name") ?? ""), String(form.get("email") ?? ""));
      setRes(r);
      if (!r?.error) setEditing(false);
    });
  return (
    <div>
      {editing && (
        <form action={save} style={{ marginBottom: 8 }}>
          <input name="name" defaultValue={name} aria-label="Nome" required />
          <input name="email" type="email" defaultValue={email} aria-label="E-mail" required />
          <div className="row">
            <button className="btn" disabled={pending}>Salvar</button>
            <button type="button" className="btn sec" disabled={pending} onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </form>
      )}
      <div className="row">
        {!editing && <button className="btn sec" disabled={pending} onClick={() => setEditing(true)}>Editar nome/e-mail</button>}
        <button className="btn sec" disabled={pending} onClick={() => confirm("Gerar nova senha provisória e encerrar as sessões deste usuário?") && run(() => resetPasswordAction(id))}>Redefinir senha</button>
        {!self && (
          <button className="btn sec" disabled={pending} onClick={() => run(() => toggleActiveAction(id, !active))}>{active ? "Desativar" : "Reativar"}</button>
        )}
        {role === "mentor" && (
          <select
            aria-label="Carteira do mentor"
            defaultValue={scope}
            disabled={pending}
            style={{ width: "auto", padding: "6px 10px" }}
            onChange={(e) => run(() => setScopeAction(id, e.target.value === "all" ? "all" : "assigned"))}
          >
            <option value="assigned">só atribuídos</option>
            <option value="all">todos</option>
          </select>
        )}
        <SaveState pending={pending} ok={res?.ok} error={res?.error} />
      </div>
      {res?.tempPassword && <div className="msg ok">Senha provisória: <code className="pw">{res.tempPassword}</code></div>}
    </div>
  );
}
