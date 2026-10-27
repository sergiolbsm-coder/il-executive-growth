"use client";

import { useActionState, useState, useTransition } from "react";
import { SaveState, SubmitButton } from "@/components/ui";
import { CHANNELS, CHANNEL_LABEL, STATUSES, STATUS_LABEL, type ContentStatus } from "@/domains/content/summary";
import {
  addAxisAction, addLinkAction, createItemAction, exampleAxesAction, removeAxisAction, removeLinkAction, renameAxisAction, setItemStatusAction,
  syncKpisAction, togglePinAction, updateItemAction, updateLinkAction, type ContentState,
} from "./actions";

function Feedback({ state }: { state: ContentState }) {
  if (!state) return null;
  return (
    <>
      {state.error && <div className="msg err">{state.error}</div>}
      {state.ok && <div className="msg ok">{state.ok}</div>}
    </>
  );
}

type Opt = { id: string; name: string };
const channelOptions = CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>);
const statusOptions = STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>);

export function NewItemForm({ programId, week, axes, offers }: { programId: string; week: string; axes: Opt[]; offers: Opt[] }) {
  const [state, action] = useActionState(createItemAction.bind(null, programId), undefined);
  return (
    <form action={action}>
      <div className="row">
        <div style={{ flex: 1, minWidth: 150 }}><label htmlFor="nw">Semana</label><input id="nw" name="weekStart" type="date" defaultValue={week} required /></div>
        <div style={{ flex: 1, minWidth: 160 }}><label htmlFor="nc">Canal</label><select id="nc" name="channel" defaultValue="linkedin">{channelOptions}</select></div>
        <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="ns">Situação</label><select id="ns" name="status" defaultValue="ideia">{statusOptions}</select></div>
      </div>
      <label htmlFor="nt">Título</label>
      <input id="nt" name="title" required />
      <label htmlFor="nth">Tese (a ideia central)</label>
      <textarea id="nth" name="thesis" rows={2} />
      <div className="row">
        <div style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="na">Eixo</label>
          <select id="na" name="axisId" defaultValue=""><option value="">— sem eixo —</option>{axes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="no">Oferta que alimenta</label>
          <select id="no" name="offerId" defaultValue=""><option value="">— nenhuma —</option>{offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        </div>
      </div>
      <Feedback state={state} />
      <SubmitButton>Adicionar ao calendário</SubmitButton>
    </form>
  );
}

export function StatusSelect({ itemId, status }: { itemId: string; status: ContentStatus }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ContentState>();
  return (
    <div>
      <select aria-label="Situação" defaultValue={status} disabled={pending} style={{ padding: "5px 8px", fontSize: 12, width: "auto" }} onChange={(e) => start(async () => setRes(await setItemStatusAction(itemId, e.target.value as ContentStatus)))}>
        {statusOptions}
      </select>
      <SaveState pending={pending} error={res?.error} />
    </div>
  );
}

export function ItemEditForm({
  item, axes, offers,
}: {
  item: { id: string; weekStart: string; channel: string; title: string; thesis: string | null; axisId: string | null; offerId: string | null; status: string; publishUrl: string | null; publishedOn: string | null; engagement: number | null; leads: number | null };
  axes: Opt[]; offers: Opt[];
}) {
  const [state, action] = useActionState(updateItemAction.bind(null, item.id), undefined);
  return (
    <form action={action}>
      <div className="row">
        <div style={{ flex: 1, minWidth: 150 }}><label>Semana</label><input name="weekStart" type="date" defaultValue={item.weekStart} required /></div>
        <div style={{ flex: 1, minWidth: 160 }}><label>Canal</label><select name="channel" defaultValue={item.channel}>{channelOptions}</select></div>
        <div style={{ flex: 1, minWidth: 140 }}><label>Situação</label><select name="status" defaultValue={item.status}>{statusOptions}</select></div>
      </div>
      <label>Título</label>
      <input name="title" defaultValue={item.title} required />
      <label>Tese</label>
      <textarea name="thesis" rows={2} defaultValue={item.thesis ?? ""} />
      <div className="row">
        <div style={{ flex: 1, minWidth: 200 }}><label>Eixo</label><select name="axisId" defaultValue={item.axisId ?? ""}><option value="">— sem eixo —</option>{axes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div style={{ flex: 1, minWidth: 200 }}><label>Oferta que alimenta</label><select name="offerId" defaultValue={item.offerId ?? ""}><option value="">— nenhuma —</option>{offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
      </div>
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}><label>Link da publicação</label><input name="publishUrl" defaultValue={item.publishUrl ?? ""} placeholder="https://…" /></div>
        <div style={{ flex: 1, minWidth: 150 }}><label>Publicada em</label><input name="publishedOn" type="date" defaultValue={item.publishedOn ?? ""} /></div>
        <div style={{ flex: 1, minWidth: 110 }}><label>Engajamento</label><input name="engagement" inputMode="numeric" defaultValue={item.engagement ?? ""} /></div>
        <div style={{ flex: 1, minWidth: 110 }}><label>Convites/reuniões</label><input name="leads" inputMode="numeric" defaultValue={item.leads ?? ""} /></div>
      </div>
      <Feedback state={state} />
      <SubmitButton className="btn sec">Salvar publicação</SubmitButton>
    </form>
  );
}

export function SyncButton({ programId, week }: { programId: string; week: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ContentState>();
  return (
    <div>
      <button className="btn sec" disabled={pending} onClick={() => start(async () => setRes(await syncKpisAction(programId, week)))}>{pending ? "Atualizando…" : "Atualizar os KPIs desta semana com as publicações"}</button>
      <Feedback state={res} />
    </div>
  );
}

export function AxisRow({ axis, canEdit }: { axis: { id: string; name: string; description: string | null }; canEdit: boolean }) {
  const [state, action] = useActionState(renameAxisAction.bind(null, axis.id), undefined);
  const [pending, start] = useTransition();
  if (!canEdit) return <div className="task"><div className="t"><b>{axis.name}</b>{axis.description && <div className="opt">{axis.description}</div>}</div></div>;
  return (
    <details style={{ borderBottom: "1px solid var(--idl-border)", padding: "8px 0" }}>
      <summary style={{ cursor: "pointer" }}><b>{axis.name}</b>{axis.description && <span className="opt"> — {axis.description}</span>}</summary>
      <form action={action} style={{ marginTop: 8 }}>
        <div className="row">
          <div style={{ flex: 1, minWidth: 200 }}><label>Nome</label><input name="name" defaultValue={axis.name} required /></div>
          <div style={{ flex: 2, minWidth: 240 }}><label>Descrição</label><input name="description" defaultValue={axis.description ?? ""} /></div>
        </div>
        <Feedback state={state} />
        <div className="row"><SubmitButton className="btn sec">Salvar eixo</SubmitButton>
          <button type="button" className="btn sec" disabled={pending} onClick={() => confirm("Remover este eixo? As publicações dele continuam, só ficam sem eixo.") && start(async () => void (await removeAxisAction(axis.id)))} style={{ marginTop: 16 }}>Remover eixo</button>
        </div>
      </form>
    </details>
  );
}

export function AddAxisForm({ programId }: { programId: string }) {
  const [state, action] = useActionState(addAxisAction.bind(null, programId), undefined);
  return (
    <form action={action}>
      <div className="row">
        <div style={{ flex: 1, minWidth: 200 }}><label htmlFor="ax">Novo eixo</label><input id="ax" name="name" required /></div>
        <div style={{ flex: 2, minWidth: 240 }}><label htmlFor="axd">Descrição (opcional)</label><input id="axd" name="description" /></div>
      </div>
      <Feedback state={state} />
      <SubmitButton className="btn sec">Acrescentar eixo</SubmitButton>
    </form>
  );
}

export function ExampleAxesButton({ programId }: { programId: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ContentState>();
  return (
    <div>
      <button className="btn sec" disabled={pending} onClick={() => start(async () => setRes(await exampleAxesAction(programId)))}>Começar com 3 eixos de exemplo</button>
      <Feedback state={res} />
    </div>
  );
}

export function NewLinkForm({ programId, categories }: { programId: string; categories: string[] }) {
  const [state, action] = useActionState(addLinkAction.bind(null, programId), undefined);
  return (
    <form action={action}>
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}><label htmlFor="lt">Título</label><input id="lt" name="title" required /></div>
        <div style={{ flex: 1, minWidth: 160 }}><label htmlFor="lc">Categoria</label><input id="lc" name="category" list="cats" placeholder="ex.: Drive, Modelos…" /><datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
      </div>
      <label htmlFor="lu">Endereço (Drive, Docs, Sheets, LinkedIn… qualquer link http/https)</label>
      <input id="lu" name="url" type="url" placeholder="https://drive.google.com/…" required />
      <label htmlFor="ld">Descrição (opcional)</label>
      <input id="ld" name="description" />
      <label className="chk"><input type="checkbox" name="pinned" /> Fixar como acesso rápido</label>
      <Feedback state={state} />
      <SubmitButton>Adicionar link</SubmitButton>
    </form>
  );
}

export function LinkActions({ link, canManage }: { link: { id: string; title: string; url: string; category: string | null; description: string | null; pinned: boolean }; canManage: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ContentState>();
  const [state, action] = useActionState(updateLinkAction.bind(null, link.id), undefined);
  if (!canManage) return null;
  return (
    <div>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn sec" disabled={pending} onClick={() => start(async () => setRes(await togglePinAction(link.id, !link.pinned)))}>{link.pinned ? "Desafixar" : "Fixar"}</button>
        <button className="btn sec" disabled={pending} onClick={() => confirm("Remover este link da biblioteca?") && start(async () => setRes(await removeLinkAction(link.id)))}>Remover</button>
        <SaveState pending={pending} error={res?.error} />
      </div>
      <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: "pointer", fontSize: 12 }}>Editar</summary>
        <form action={action}>
          <label>Título</label><input name="title" defaultValue={link.title} required />
          <label>Endereço</label><input name="url" type="url" defaultValue={link.url} required />
          <label>Categoria</label><input name="category" defaultValue={link.category ?? ""} />
          <label>Descrição</label><input name="description" defaultValue={link.description ?? ""} />
          <label className="chk"><input type="checkbox" name="pinned" defaultChecked={link.pinned} /> Acesso rápido</label>
          <Feedback state={state} />
          <SubmitButton className="btn sec">Salvar link</SubmitButton>
        </form>
      </details>
    </div>
  );
}
