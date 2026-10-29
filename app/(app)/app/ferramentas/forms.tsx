"use client";

import { useActionState, useState, useTransition } from "react";
import { SaveState, SubmitButton } from "@/components/ui";
import type { ToolField } from "@/lib/db/schema";
import { createEntryAction, reviewEntryAction, saveEntryAction, type ToolState } from "./actions";

function Feedback({ state }: { state: ToolState }) {
  if (!state) return null;
  return (
    <>
      {state.error && <div className="msg err">{state.error}</div>}
      {state.ok && <div className="msg ok">{state.ok}</div>}
      {state.warnings?.map((w) => <div key={w} className="msg err">⚠ {w}</div>)}
    </>
  );
}

export function NewEntryForm({ programId, slug, offers, needsOffer }: { programId: string; slug: string; offers: { id: string; name: string }[]; needsOffer: boolean }) {
  const [state, action] = useActionState(createEntryAction.bind(null, programId, slug), undefined);
  return (
    <form action={action} className="row" style={{ alignItems: "flex-end" }}>
      {(needsOffer || offers.length > 0) && (
        <div style={{ minWidth: 200 }}>
          <label htmlFor={`o-${slug}`}>Oferta{needsOffer ? " (obrigatória)" : " (opcional)"}</label>
          <select id={`o-${slug}`} name="offerId" required={needsOffer} defaultValue="">
            {!needsOffer && <option value="">— nenhuma —</option>}
            {needsOffer && <option value="" disabled>Escolha…</option>}
            {offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ minWidth: 200 }}><label htmlFor={`t-${slug}`}>Título (opcional)</label><input id={`t-${slug}`} name="title" /></div>
      <SubmitButton className="btn sec" pendingLabel="Abrindo…">Nova entrada</SubmitButton>
      <div style={{ flexBasis: "100%" }}><Feedback state={state} /></div>
    </form>
  );
}

export function EntryForm({ entryId, fields, data }: { entryId: string; fields: ToolField[]; data: Record<string, unknown> }) {
  const [state, action] = useActionState(saveEntryAction.bind(null, entryId), undefined);
  return (
    <form action={action}>
      {fields.map((f) => {
        const id = `f-${f.key}`;
        const v = data[f.key];
        return (
          <div key={f.key} className="entry-field">
            {f.type === "checklist" ? (
              <>
                <label>{f.label}{f.required ? " *" : ""}</label>
                {f.options!.map((o) => (
                  <label key={o} className="chk"><input type="checkbox" name={`f:${f.key}`} value={o} defaultChecked={Array.isArray(v) && v.includes(o)} /> {o}</label>
                ))}
              </>
            ) : (
              <>
                <label htmlFor={id}>{f.label}{f.required ? " *" : ""}</label>
                {f.type === "textarea" ? (
                  <textarea id={id} name={`f:${f.key}`} rows={3} defaultValue={String(v ?? "")} />
                ) : f.type === "select" ? (
                  <select id={id} name={`f:${f.key}`} defaultValue={String(v ?? "")}><option value="">—</option>{f.options!.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                ) : (
                  <input id={id} name={`f:${f.key}`} type={f.type === "url" ? "url" : "text"} inputMode={f.type === "number" ? "decimal" : undefined} defaultValue={String(v ?? "")} />
                )}
              </>
            )}
            {f.help && <div className="help">{f.help}</div>}
          </div>
        );
      })}
      <Feedback state={state} />
      <div className="row">
        <SubmitButton className="btn sec" name="intent" value="draft">Salvar rascunho</SubmitButton>
        <SubmitButton name="intent" value="conclude" pendingLabel="Concluindo…">Concluir</SubmitButton>
      </div>
    </form>
  );
}

export function ReviewButton({ entryId }: { entryId: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ToolState>();
  return (
    <div className="row">
      <button className="btn" disabled={pending} onClick={() => start(async () => setRes(await reviewEntryAction(entryId)))}>Marcar como revisada</button>
      <SaveState pending={pending} ok={res?.ok} error={res?.error} />
    </div>
  );
}

/** Botão "Começar" da trilha: abre uma entrada em branco (opcionalmente já ligada a uma oferta) e vai para ela. */
export function StartButton({ programId, slug, offerId, label = "Começar" }: { programId: string; slug: string; offerId?: string; label?: string }) {
  const [state, action] = useActionState(createEntryAction.bind(null, programId, slug), undefined);
  return (
    <form action={action}>
      {offerId && <input type="hidden" name="offerId" value={offerId} />}
      <SubmitButton className="btn sec" pendingLabel="Abrindo…">{label}</SubmitButton>
      {state?.error && <div className="msg err">{state.error}</div>}
    </form>
  );
}
