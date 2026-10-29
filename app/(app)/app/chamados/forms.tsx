"use client";

import { useActionState, useState, useTransition } from "react";
import { SubmitButton } from "@/components/ui";
import { TICKET_AREAS, TICKET_KINDS, type TicketArea } from "@/lib/support";
import { assumeAction, createTicketAction, reopenAction, replyAction, resolveAction } from "./actions";

export function NewTicketForm({ mentees, defaultArea, pagePath }: { mentees: { id: string; name: string }[]; defaultArea: TicketArea; pagePath: string }) {
  const [state, action] = useActionState(createTicketAction, undefined);
  return (
    <form action={action} className="card">
      <input type="hidden" name="pagePath" value={pagePath} />
      {mentees.length > 0 && (
        <>
          <label htmlFor="menteeId">Mentorado</label>
          <select id="menteeId" name="menteeId" required defaultValue="">
            <option value="" disabled>Escolha…</option>
            {mentees.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </>
      )}
      <label htmlFor="area">Sobre qual funcionalidade?</label>
      <select id="area" name="area" defaultValue={defaultArea} required>
        {Object.entries(TICKET_AREAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <label htmlFor="kind">O que você precisa?</label>
      <select id="kind" name="kind" defaultValue="duvida">
        {Object.entries(TICKET_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <label htmlFor="title">Assunto (resumo em uma frase)</label>
      <input id="title" name="title" maxLength={160} required placeholder="Ex.: não consigo marcar o portão da ficha de 1 página" />
      <label htmlFor="description">Detalhes</label>
      <textarea id="description" name="description" rows={6} maxLength={4000} placeholder="O que você tentou fazer, o que apareceu na tela…" />
      {state?.error && <div className="msg err">{state.error}</div>}
      <SubmitButton pendingLabel="Enviando…">Enviar chamado</SubmitButton>
    </form>
  );
}

export function ReplyForm({ ticketId, staff }: { ticketId: string; staff: boolean }) {
  const [state, action] = useActionState(replyAction.bind(null, ticketId), undefined);
  return (
    <form action={action} key={state?.ok ?? "new"}>
      <label htmlFor="body">Responder</label>
      <textarea id="body" name="body" rows={4} maxLength={4000} required />
      {staff && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
          <input type="checkbox" name="internal" style={{ width: "auto" }} /> Nota interna (o mentorado não vê)
        </label>
      )}
      {state?.error && <div className="msg err">{state.error}</div>}
      {state?.ok && <div className="msg ok">{state.ok}</div>}
      <SubmitButton pendingLabel="Enviando…">Enviar</SubmitButton>
    </form>
  );
}

export function ResolveForm({ ticketId }: { ticketId: string }) {
  const [state, action] = useActionState(resolveAction.bind(null, ticketId), undefined);
  return (
    <form action={action}>
      <label htmlFor="solution">Solução / resposta final (o mentorado vê e fica no painel de soluções)</label>
      <textarea id="solution" name="solution" rows={4} maxLength={4000} required />
      {state?.error && <div className="msg err">{state.error}</div>}
      {state?.ok && <div className="msg ok">{state.ok}</div>}
      <SubmitButton pendingLabel="Resolvendo…">Marcar como resolvido</SubmitButton>
    </form>
  );
}

export function TicketButtons({ ticketId, status, staff }: { ticketId: string; status: string; staff: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();
  const run = (fn: () => Promise<{ error?: string } | undefined>) => start(async () => setErr((await fn())?.error));
  return (
    <div className="row">
      {staff && status !== "resolvido" && <button className="btn sec" disabled={pending} onClick={() => run(() => assumeAction(ticketId))}>{pending ? "Aguarde…" : "Assumir chamado"}</button>}
      {status === "resolvido" && <button className="btn sec" disabled={pending} onClick={() => run(() => reopenAction(ticketId))}>{pending ? "Aguarde…" : "Reabrir"}</button>}
      {err && <span className="msg err">{err}</span>}
    </div>
  );
}
