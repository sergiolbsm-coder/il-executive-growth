"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { SaveState, SubmitButton } from "@/components/ui";
import { CARD_KINDS, FUNNEL_STAGES, LESSON_QUESTIONS, PRIORITIES, canHaveLessons } from "@/lib/strategy";
import {
  addLessonAction, createCardAction, moveCardAction, removeCardAction, removeLessonAction, updateCardAction, updateLessonAction, type StrategyState,
} from "./actions";

function Feedback({ state }: { state: StrategyState }) {
  if (!state) return null;
  return (
    <>
      {state.error && <div className="msg err">{state.error}</div>}
      {state.ok && <div className="msg ok">{state.ok}</div>}
    </>
  );
}

type CardFields = { kind: string; title: string; description: string | null; approach: string | null; objection: string | null; materialUrl: string | null; priority: string };

function CardFieldsForm({ initial }: { initial?: CardFields }) {
  return (
    <>
      <div className="row">
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Tipo do cartão</label>
          <select name="kind" defaultValue={initial?.kind ?? "cliente"}>{Object.entries(CARD_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label>Prioridade</label>
          <select name="priority" defaultValue={initial?.priority ?? "media"}>{Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
      </div>
      <label>Título (perfil ou demanda — nunca o nome de uma pessoa ou empresa)</label>
      <input name="title" maxLength={160} required defaultValue={initial?.title ?? ""} placeholder="Ex.: Escolas privadas de médio porte" />
      <label>Quem é / o que pede</label>
      <textarea name="description" rows={2} maxLength={1000} defaultValue={initial?.description ?? ""} />
      <label>O que fazer ou dizer nesta etapa</label>
      <textarea name="approach" rows={3} maxLength={1000} defaultValue={initial?.approach ?? ""} placeholder="Roteiro, argumento ou pergunta-chave" />
      <label>Objeção provável e a resposta</label>
      <textarea name="objection" rows={2} maxLength={1000} defaultValue={initial?.objection ?? ""} />
      <label>Material de apoio (link, opcional)</label>
      <input name="materialUrl" type="url" placeholder="https://…" defaultValue={initial?.materialUrl ?? ""} />
    </>
  );
}

export function NewCardForm({ offerId }: { offerId: string }) {
  const [state, action] = useActionState(createCardAction.bind(null, offerId), undefined);
  return (
    <form action={action} key={state?.ok ?? "new"}>
      <div style={{ maxWidth: 260 }}>
        <label htmlFor="ns">Em qual etapa do funil usar</label>
        <select id="ns" name="stage" defaultValue="primeiro_contato">{FUNNEL_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
      </div>
      <CardFieldsForm />
      <Feedback state={state} />
      <SubmitButton pendingLabel="Adicionando…">Adicionar cartão</SubmitButton>
    </form>
  );
}

export function CardActions({ card }: { card: CardFields & { id: string; stage: string } }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<StrategyState>();
  const [state, action] = useActionState(updateCardAction.bind(null, card.id), undefined);
  return (
    <div>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <select
          aria-label="Mover para a etapa"
          value={card.stage}
          disabled={pending}
          style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
          onChange={(e) => start(async () => setRes(await moveCardAction(card.id, e.target.value)))}
        >
          {FUNNEL_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <SaveState pending={pending} error={res?.error} />
      </div>
      <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: "pointer", fontSize: 12 }}>Editar</summary>
        <form action={action}>
          <CardFieldsForm initial={card} />
          <Feedback state={state} />
          <div className="row">
            <SubmitButton className="btn sec">Salvar</SubmitButton>
            <button type="button" className="btn sec" disabled={pending} style={{ marginTop: 16 }}
              onClick={() => confirm("Remover este cartão e as lições dele?") && start(async () => setRes(await removeCardAction(card.id)))}>Remover cartão</button>
          </div>
        </form>
      </details>
    </div>
  );
}

type Lesson = { id: string; question: string; answer: string };

/** Lições aprendidas dos cartões em Perdido e Concluído: perguntas sugeridas ou livres, quantas forem preciso. */
export function Lessons({ cardId, stage, lessons }: { cardId: string; stage: string; lessons: Lesson[] }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<StrategyState>();
  const [pick, setPick] = useState("");
  const [state, action] = useActionState(addLessonAction.bind(null, cardId), undefined);
  const [editing, setEditing] = useState<string | null>(null);
  const [editState, editAction] = useActionState(async (_: StrategyState, f: FormData) => {
    const r = await updateLessonAction(String(f.get("id")), undefined, f);
    if (!r?.error) setEditing(null);
    return r;
  }, undefined);
  if (!canHaveLessons(stage) && lessons.length === 0) return null;
  const suggestions = LESSON_QUESTIONS[stage === "concluido" ? "concluido" : "perdido"];
  return (
    <div className="lessons">
      <div className="lessons-title">📝 Lições aprendidas ({lessons.length})</div>
      {lessons.map((l) => (
        <div key={l.id} className="lesson">
          {editing === l.id ? (
            <form action={editAction}>
              <input type="hidden" name="id" value={l.id} />
              <input name="question" defaultValue={l.question} maxLength={300} required />
              <textarea name="answer" rows={3} defaultValue={l.answer} maxLength={2000} required />
              <Feedback state={editState} />
              <div className="row"><SubmitButton className="btn sec">Salvar</SubmitButton><button type="button" className="btn sec" style={{ marginTop: 16 }} onClick={() => setEditing(null)}>Cancelar</button></div>
            </form>
          ) : (
            <>
              <b>{l.question}</b>
              <p>{l.answer}</p>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn sec" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => setEditing(l.id)}>Editar</button>
                <button className="btn sec" style={{ padding: "2px 8px", fontSize: 11 }} disabled={pending} onClick={() => confirm("Remover esta lição?") && start(async () => setRes(await removeLessonAction(l.id)))}>Remover</button>
              </div>
            </>
          )}
        </div>
      ))}
      {res?.error && <div className="msg err">{res.error}</div>}
      {canHaveLessons(stage) && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ Registrar lição</summary>
          <form action={action} key={state?.ok ?? "new"}>
            <label>Pergunta</label>
            <select name="questionPick" value={pick} onChange={(e) => setPick(e.target.value)} required>
              <option value="" disabled>Escolha uma pergunta…</option>
              {suggestions.map((q) => <option key={q} value={q}>{q}</option>)}
              <option value="__outra">Outra pergunta (escrever)…</option>
            </select>
            {pick === "__outra" && <input name="questionCustom" maxLength={300} placeholder="Escreva a pergunta" required />}
            <label>Resposta</label>
            <textarea name="answer" rows={3} maxLength={2000} required />
            <Feedback state={state} />
            <SubmitButton className="btn sec" pendingLabel="Registrando…">Registrar lição</SubmitButton>
          </form>
        </details>
      )}
    </div>
  );
}

/** Combo de ofertas: ao escolher, o quadro da oferta é carregado (mantém programa e filtro). */
export function OfferSelect({ programId, offerId, kind, offers }: { programId: string; offerId: string; kind?: string; offers: { id: string; name: string; count: number }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="row" style={{ alignItems: "center", marginBottom: 10 }}>
      <label htmlFor="offer-select" style={{ margin: 0, fontWeight: 700 }}>Oferta</label>
      <select
        id="offer-select"
        value={offerId}
        disabled={pending}
        style={{ width: "auto", minWidth: 260 }}
        onChange={(e) => {
          const q = new URLSearchParams({ p: programId, o: e.target.value, ...(kind ? { k: kind } : {}) });
          start(() => router.push(`/app/estrategia?${q.toString()}`));
        }}
      >
        {offers.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.count} {o.count === 1 ? "cartão" : "cartões"})</option>)}
      </select>
      {pending && <span className="sub" style={{ margin: 0 }}><span className="spinner" style={{ width: 14, height: 14, display: "inline-block", verticalAlign: "middle" }} /> Carregando o quadro…</span>}
    </div>
  );
}
