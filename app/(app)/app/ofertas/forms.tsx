"use client";

import { ConfirmButton } from "@/components/ConfirmButton";
import { useActionState, useState, useTransition } from "react";
import { SaveState, SubmitButton } from "@/components/ui";
import Link from "next/link";
import { STAGES } from "@/lib/stages";
import type { GateGuide } from "@/lib/stage-guides";
import {
  checkGateAction, confirmGateAction, createOfferAction, importAnswersAction, importOffersAction, offerPromptAction, recordSaleAction, removeSaleAction, setStatusAction, uncheckGateAction, updateOfferAction,
  type OfferState,
} from "./actions";

function Feedback({ state }: { state: OfferState }) {
  if (!state) return null;
  return (
    <>
      {state.error && <div role="alert" className="msg err">{state.error}</div>}
      {state.ok && <div role="status" className="msg ok">{state.ok}</div>}
    </>
  );
}

const stageOptions = STAGES.map((s) => (
  <option key={s.n} value={s.n}>{s.n}. {s.name}</option>
));

/** Cola a tabela de ofertas (Excel/Docs) e importa em lote; "Conferir" não grava nada. */
export function ImportOffersForm({ programId }: { programId: string }) {
  const [state, action] = useActionState(importOffersAction.bind(null, programId), undefined);
  return (
    <form autoComplete="off" action={action}>
      <p className="sub">Cole as linhas da planilha de importação (colunas: Receita · Nome · Problema · Público · Meta · Prazo · Onda · Preço, com o cabeçalho). Também vale a tabela agrupada por <b>Receita N — …</b>. Ofertas com o mesmo nome são puladas.</p>
      <p className="sub"><a href="/api/modelos/importacao-ofertas" download>⬇️ Baixar o modelo da planilha (.xlsx)</a> — traz as instruções e listas de escolha; dá para preenchê-lo à mão ou no chat.</p>
      <textarea name="text" rows={8} required placeholder="Cole aqui as linhas copiadas da planilha" aria-label="Tabela de ofertas" />
      <div className="row" style={{ marginTop: 8 }}>
        <SubmitButton className="btn sec" name="mode" value="check" pendingLabel="Conferindo…">Conferir</SubmitButton>
        <SubmitButton name="mode" value="apply" pendingLabel="Importando…">Importar</SubmitButton>
      </div>
      {state?.error && <div role="alert" className="msg err" style={{ whiteSpace: "pre-line" }}>{state.error}</div>}
      {state?.ok && <div role="status" className="msg ok">{state.ok}</div>}
    </form>
  );
}

/** Gera o prompt da oferta inteira para a IA do assessorado e importa a resposta (tudo entra como pendente de revisão). */
export function AiCompleteForm({ offerId }: { offerId: string }) {
  const [prompt, setPrompt] = useState<string>();
  const [err, setErr] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();
  const [state, action] = useActionState(importAnswersAction.bind(null, offerId), undefined);
  const gen = () => start(async () => {
    const r = await offerPromptAction(offerId);
    setErr(r.error);
    setPrompt(r.text);
    setCopied(false);
  });
  const copy = async () => {
    if (!prompt) return;
    try { await navigator.clipboard.writeText(prompt); setCopied(true); } catch { setErr("Não consegui copiar automaticamente: selecione o texto e copie."); }
  };
  return (
    <div>
      <p className="sub"><b>1.</b> Gere o prompt desta oferta e cole na sua IA (ChatGPT, Claude, Gemini…), no mesmo chat em que você já conversa sobre o seu negócio. <b>2.</b> Cole aqui a resposta dela. Tudo entra como <b>pendente</b>: o mentor revisa e confirma.</p>
      <div className="row">
        <button type="button" className="btn sec" disabled={busy} onClick={gen}>{busy ? "Gerando…" : prompt ? "Gerar de novo" : "Gerar prompt"}</button>
        {prompt && <button type="button" className="btn sec" onClick={copy}>{copied ? "✅ Copiado" : "Copiar prompt"}</button>}
      </div>
      {err && <div role="alert" className="msg err">{err}</div>}
      {prompt && <textarea readOnly rows={10} value={prompt} aria-label="Prompt para a sua IA" onFocus={(e) => e.currentTarget.select()} />}
      <form autoComplete="off" action={action} style={{ marginTop: 10 }}>
        <label htmlFor="ai-answer">Resposta da sua IA (cole o bloco JSON)</label>
        <textarea id="ai-answer" name="text" rows={6} required placeholder='{ "versao": 1, "oferta": "…", "ferramentas": { … }, "itens": { … } }' />
        <div className="row" style={{ marginTop: 8 }}>
          <SubmitButton className="btn sec" name="mode" value="check" pendingLabel="Conferindo…">Conferir</SubmitButton>
          <SubmitButton name="mode" value="apply" pendingLabel="Importando…">Importar</SubmitButton>
        </div>
        {state?.error && <div role="alert" className="msg err" style={{ whiteSpace: "pre-line" }}>{state.error}</div>}
        {state?.ok && <div role="status" className="msg ok" style={{ whiteSpace: "pre-line" }}>{state.ok}</div>}
      </form>
    </div>
  );
}

export function NewOfferForm({ programId, sources }: { programId: string; sources: { slug: string; name: string; level: number }[] }) {
  const [state, action] = useActionState(createOfferAction.bind(null, programId), undefined);
  return (
    <form autoComplete="off" action={action}>
      <p className="sub">Toda oferta nasce em <b>Ideia</b>: informe a receita, o problema que resolve e o público.</p>
      <label htmlFor="revenueSlug">Receita (fonte de receita)</label>
      <select id="revenueSlug" name="revenueSlug" required>
        {sources.map((s) => <option key={s.slug} value={s.slug}>{s.name} (nível {s.level})</option>)}
      </select>
      <label htmlFor="name">Nome da oferta</label>
      <input autoComplete="off" id="name" name="name" required />
      <label htmlFor="problem">Problema que resolve</label>
      <textarea id="problem" name="problem" rows={2} required />
      <label htmlFor="audience">Público</label>
      <textarea id="audience" name="audience" rows={2} required />
      <div className="row">
        <div style={{ flex: 1, minWidth: 140 }}>
          <label htmlFor="targetStage">Meta de estágio</label>
          <select id="targetStage" name="targetStage" defaultValue="3">{stageOptions}</select>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label htmlFor="dueDate">Prazo da meta</label>
          <input id="dueDate" name="dueDate" type="date" />
        </div>
        <div style={{ flex: 1, minWidth: 100 }}>
          <label htmlFor="wave">Onda</label>
          <select id="wave" name="wave" defaultValue=""><option value="">—</option><option value="1">1 · Vender e validar</option><option value="2">2 · Aumentar ticket</option><option value="3">3 · Recorrência</option></select>
        </div>
      </div>
      <label htmlFor="priceNote">Preço (referência, opcional)</label>
      <input id="priceNote" name="priceNote" placeholder="ex.: R$ 1.500 por turma" />
      <Feedback state={state} />
      <SubmitButton>Criar oferta</SubmitButton>
    </form>
  );
}

export function OfferEditForm({
  offerId,
  initial,
  sources,
}: {
  offerId: string;
  sources: { slug: string; name: string; level: number }[];
  initial: { revenueSlug: string; name: string; problem: string; audience: string; priceNote: string | null; level: number; wave: number | null; dueDate: string | null; targetStage: number };
}) {
  const [state, action] = useActionState(updateOfferAction.bind(null, offerId), undefined);
  return (
    <form autoComplete="off" action={action}>
      <label htmlFor="name">Nome</label>
      <input autoComplete="off" id="name" name="name" defaultValue={initial.name} required />
      <label htmlFor="revenueSlug">Receita (fonte de receita)</label>
      <select id="revenueSlug" name="revenueSlug" defaultValue={initial.revenueSlug}>
        {sources.map((s) => <option key={s.slug} value={s.slug}>{s.name} (nível sugerido {s.level})</option>)}
      </select>
      <label htmlFor="problem">Problema que resolve</label>
      <textarea id="problem" name="problem" rows={2} defaultValue={initial.problem} required />
      <label htmlFor="audience">Público</label>
      <textarea id="audience" name="audience" rows={2} defaultValue={initial.audience} required />
      <div className="row">
        <div style={{ flex: 1, minWidth: 120 }}>
          <label htmlFor="level">Nível (Escala)</label>
          <select id="level" name="level" defaultValue={initial.level}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label htmlFor="targetStage">Meta de estágio</label>
          <select id="targetStage" name="targetStage" defaultValue={initial.targetStage}>{stageOptions}</select>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label htmlFor="dueDate">Prazo da meta</label>
          <input id="dueDate" name="dueDate" type="date" defaultValue={initial.dueDate ?? ""} />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label htmlFor="wave">Onda</label>
          <select id="wave" name="wave" defaultValue={initial.wave ?? ""}><option value="">—</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select>
        </div>
      </div>
      <label htmlFor="priceNote">Preço (referência)</label>
      <input id="priceNote" name="priceNote" defaultValue={initial.priceNote ?? ""} />
      <Feedback state={state} />
      <SubmitButton>Salvar oferta</SubmitButton>
    </form>
  );
}

export function StatusForm({ offerId, status }: { offerId: string; status: string }) {
  const [state, action] = useActionState(setStatusAction.bind(null, offerId), undefined);
  const [choice, setChoice] = useState(status === "ativa" ? "pausada" : "ativa");
  return (
    <form autoComplete="off" action={action}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ minWidth: 160 }}>
          <label htmlFor="status">Situação</label>
          <select id="status" name="status" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="ativa">Ativa / reativar</option>
            <option value="pausada">Pausar</option>
            <option value="descartada">Descartar</option>
          </select>
        </div>
        {choice !== "ativa" && (
          <div style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="reason">Motivo (obrigatório)</label>
            <input id="reason" name="reason" required minLength={3} />
          </div>
        )}
        <SubmitButton className="btn sec">Aplicar</SubmitButton>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export type GateItemProps = {
  offerId: string;
  gate: { key: string; label: string; kind: "manual" | "vendas"; threshold: number | null; required: boolean };
  check: { state: "pendente" | "confirmado"; evidence: string; by: string | null; confirmedBy: string | null; at: string } | null;
  salesCount: number;
  canStaff: boolean;
  canPropose: boolean;
  offerActive: boolean;
  guide?: GateGuide;
};

/** "Como fazer" de um item: passos, exemplo e o que colar como evidência. */
function HowTo({ guide }: { guide: GateGuide }) {
  return (
    <details className="howto">
      <summary>Como fazer</summary>
      <ol>{guide.how.map((h) => <li key={h}>{h}</li>)}</ol>
      {guide.example && <p className="ex"><b>Exemplo:</b> {guide.example}</p>}
      <p className="ex"><b>Evidência:</b> {guide.evidence}</p>
      {guide.tool && <p className="ex"><Link href="/app/ferramentas">Abrir a ferramenta que ajuda a preencher →</Link></p>}
    </details>
  );
}

/** Um item de portão: aberto (com evidência), pendente (aguarda equipe) ou confirmado. Portões de vendas são automáticos. */
export function GateItem({ offerId, gate, check, salesCount, canStaff, canPropose, offerActive, guide }: GateItemProps) {
  const [state, action] = useActionState(checkGateAction.bind(null, offerId, gate.key), undefined);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<OfferState>();
  const run = (fn: () => Promise<OfferState>) => start(async () => setRes(await fn()));
  const optional = !gate.required;

  if (gate.kind === "vendas") {
    const need = gate.threshold ?? 1;
    const met = salesCount >= need;
    return (
      <div className="gate">
        <span className="mark">{met ? "✅" : "◻️"}</span>
        <div className="body">
          <div>{gate.label} {optional && <span className="opt">(opcional)</span>}</div>
          <div className="ev">{salesCount} de {need} venda(s) registrada(s) — calculado automaticamente</div>
          {guide && <HowTo guide={guide} />}
        </div>
      </div>
    );
  }

  return (
    <div className="gate">
      <span className="mark">{check ? (check.state === "confirmado" ? "✅" : "⏳") : "◻️"}</span>
      <div className="body">
        <div>{gate.label} {optional && <span className="opt">(opcional)</span>}</div>
        {guide && <HowTo guide={guide} />}
        {check && (
          <div className="ev">
            {check.state === "pendente" ? "Aguardando confirmação da equipe · " : "Confirmado · "}
            {check.evidence}
            <br />
            <span className="opt">marcado por {check.by ?? "—"} em {check.at}{check.state === "confirmado" && check.confirmedBy ? ` · confirmado por ${check.confirmedBy}` : ""}</span>
          </div>
        )}
        {check && canStaff && (
          <div className="row" style={{ marginTop: 6 }}>
            {check.state === "pendente" && <button className="btn sec" disabled={pending} onClick={() => run(() => confirmGateAction(offerId, gate.key))}>Confirmar</button>}
            <ConfirmButton className="btn sec" disabled={pending} message="Desmarcar este item? O estágio da oferta pode voltar." confirmLabel="Desmarcar item" onConfirm={() => run(() => uncheckGateAction(offerId, gate.key))}>Desmarcar</ConfirmButton>
            <SaveState pending={pending} error={res?.error} />
          </div>
        )}
        {!check && offerActive && (canStaff || canPropose) && (
          <form autoComplete="off" action={action} className="inline">
            <input name="evidence" placeholder="Evidência (texto ou link)" required minLength={3} aria-label={`Evidência: ${gate.label}`} />
            <SubmitButton className="btn sec" pendingLabel="Salvando…">{canStaff ? "Marcar" : "Enviar p/ confirmação"}</SubmitButton>
          </form>
        )}
        {state?.error && <div role="alert" className="msg err">{state.error}</div>}
      </div>
    </div>
  );
}

export function SaleForm({ offerId, siblings, today }: { offerId: string; siblings: { id: string; name: string }[]; today: string }) {
  const [state, action] = useActionState(recordSaleAction.bind(null, offerId), undefined);
  return (
    <form autoComplete="off" action={action}>
      <div className="row">
        <div style={{ flex: 2, minWidth: 180 }}><label htmlFor="clientName">Cliente</label><input id="clientName" name="clientName" required /></div>
        <div style={{ flex: 1, minWidth: 120 }}><label htmlFor="value">Valor (R$)</label><input id="value" name="value" inputMode="decimal" placeholder="2.500,00" required /></div>
        <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="soldAt">Data</label><input id="soldAt" name="soldAt" type="date" defaultValue={today} max={today} required /></div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}><label htmlFor="channel">Canal</label><input id="channel" name="channel" placeholder="LinkedIn, indicação, evento…" /></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="originOfferId">Oferta que originou o lead</label>
          <select id="originOfferId" name="originOfferId" defaultValue="">
            <option value="">— nenhuma —</option>
            {siblings.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <label htmlFor="notes">Observações</label>
      <input id="notes" name="notes" />
      <Feedback state={state} />
      <SubmitButton>Registrar venda</SubmitButton>
    </form>
  );
}

export function RemoveSaleButton({ offerId, saleId }: { offerId: string; saleId: string }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmButton className="btn sec" disabled={pending} message="Remover esta venda? O registro fica na auditoria." confirmLabel="Remover venda" onConfirm={() => start(async () => void (await removeSaleAction(offerId, saleId)))}>
      Remover
    </ConfirmButton>
  );
}
