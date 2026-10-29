"use client";

import { useActionState, useState, useTransition } from "react";
import { SaveState, SubmitButton } from "@/components/ui";
import { LINK_CATEGORIES } from "@/domains/content/links";
import { addLinkAction, removeLinkAction, setDoneAction, updateLinkAction, type ContentState } from "./actions";

function Feedback({ state }: { state: ContentState }) {
  if (!state) return null;
  return (
    <>
      {state.error && <div className="msg err">{state.error}</div>}
      {state.ok && <div className="msg ok">{state.ok}</div>}
    </>
  );
}

const categoryOptions = LINK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>);

export function NewLinkForm({ programId }: { programId: string }) {
  const [state, action] = useActionState(addLinkAction.bind(null, programId), undefined);
  return (
    <form action={action} key={state?.ok ?? "new"}>
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}><label htmlFor="lt">Título</label><input id="lt" name="title" required /></div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label htmlFor="lc">Tipo</label>
          <select id="lc" name="category" defaultValue=""><option value="">Automático (Drive ou Atividade)</option>{categoryOptions}</select>
        </div>
      </div>
      <label htmlFor="lu">Endereço (Drive, Docs, Sheets, atividade, assessment… qualquer link http/https)</label>
      <input id="lu" name="url" type="url" placeholder="https://…" required />
      <label htmlFor="ld">Descrição (opcional)</label>
      <input id="ld" name="description" />
      <Feedback state={state} />
      <SubmitButton>Adicionar link</SubmitButton>
    </form>
  );
}

/** Check "já fiz / já acessei": cada clique grava na hora. */
export function DoneCheck({ linkId, done, doneLabel }: { linkId: string; done: boolean; doneLabel: string | null }) {
  const [pending, start] = useTransition();
  const [checked, setChecked] = useState(done);
  const [res, setRes] = useState<ContentState>();
  return (
    <label className="chk" style={{ margin: 0, whiteSpace: "nowrap" }} title={doneLabel ?? undefined}>
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        style={{ width: "auto" }}
        onChange={(e) => {
          const v = e.target.checked;
          setChecked(v);
          start(async () => {
            const r = await setDoneAction(linkId, v);
            setRes(r);
            if (r?.error) setChecked(!v);
          });
        }}
      />{" "}
      {checked ? "Já fiz / acessei" : "Marcar como feito"}
      <SaveState pending={pending} error={res?.error} />
    </label>
  );
}

export function LinkActions({ link }: { link: { id: string; title: string; url: string; category: string | null; description: string | null } }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ContentState>();
  const [state, action] = useActionState(updateLinkAction.bind(null, link.id), undefined);
  return (
    <div>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn sec" disabled={pending} onClick={() => confirm("Remover este link?") && start(async () => setRes(await removeLinkAction(link.id)))}>Remover</button>
        <SaveState pending={pending} error={res?.error} />
      </div>
      <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: "pointer", fontSize: 12 }}>Editar</summary>
        <form action={action}>
          <label>Título</label><input name="title" defaultValue={link.title} required />
          <label>Endereço</label><input name="url" type="url" defaultValue={link.url} required />
          <label>Tipo</label><select name="category" defaultValue={link.category ?? ""}><option value="">Automático</option>{categoryOptions}</select>
          <label>Descrição</label><input name="description" defaultValue={link.description ?? ""} />
          <Feedback state={state} />
          <SubmitButton className="btn sec">Salvar link</SubmitButton>
        </form>
      </details>
    </div>
  );
}
