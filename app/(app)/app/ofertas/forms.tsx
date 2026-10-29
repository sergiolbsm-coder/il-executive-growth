"use client";

import { useActionState, useState, useTransition } from "react";
import { SaveState, SubmitButton } from "@/components/ui";
import { STAGES } from "@/lib/stages";
import {
  checkGateAction, confirmGateAction, createOfferAction, recordSaleAction, removeSaleAction, setStatusAction, uncheckGateAction, updateOfferAction,
  type OfferState,
} from "./actions";

function Feedback({ state }: { state: OfferState }) {
  if (!state) return null;
  return (
    <>
      {state.error && <div className="msg err">{state.error}</div>}
      {state.ok && <div className="msg ok">{state.ok}</div>}
    </>
  );
}

const stageOptions = STAGES.map((s) => (
  <option key={s.n} value={s.n}>{s.n}. {s.name}</option>
));

export function NewOfferForm({ programId, sources }: { programId: string; sources: { slug: string; name: string; level: number }[] }) {
  const [state, action] = useActionState(createOfferAction.bind(null, programId), undefined);
  return (
    <form action={action}>
      <p className="sub">Toda oferta nasce em <b>Ideia</b>: informe a receita, o problema que resolve e o público.</p>
      <label htmlFor="revenueSlug">Receita (fonte de receita)</label>
      <select id="revenueSlug" name="revenueSlug" required>
        {sources.map((s) => <option key={s.slug} value={s.slug}>{s.name} (nível {s.level})</option>)}
      </select>
      <label htmlFor="name">Nome da oferta</label>
      <input id="name" name="name" required />
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
    <form action={action}>
      <label htmlFor="name">Nome</label>
      <input id="name" name="name" defaultValue={initial.name} required />
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
    <form action={action}>
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
};

/** Um item de portão: aberto (com evidência), pendente (aguarda equipe) ou confirmado. Portões de vendas são automáticos. */
export function GateItem({ offerId, gate, check, salesCount, canStaff, canPropose, offerActive }: GateItemProps) {
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
        </div>
      </div>
    );
  }

  return (
    <div className="gate">
      <span className="mark">{check ? (check.state === "confirmado" ? "✅" : "⏳") : "◻️"}</span>
      <div className="body">
        <div>{gate.label} {optional && <span className="opt">(opcional)</span>}</div>
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
            <button className="btn sec" disabled={pending} onClick={() => confirm("Desmarcar este item? O estágio da oferta pode voltar.") && run(() => uncheckGateAction(offerId, gate.key))}>Desmarcar</button>
            <SaveState pending={pending} error={res?.error} />
          </div>
        )}
        {!check && offerActive && (canStaff || canPropose) && (
          <form action={action} className="inline">
            <input name="evidence" placeholder="Evidência (texto ou link)" required minLength={3} aria-label={`Evidência: ${gate.label}`} />
            <SubmitButton className="btn sec" pendingLabel="Salvando…">{canStaff ? "Marcar" : "Enviar p/ confirmação"}</SubmitButton>
          </form>
        )}
        {state?.error && <div className="msg err">{state.error}</div>}
      </div>
    </div>
  );
}

export function SaleForm({ offerId, siblings, today }: { offerId: string; siblings: { id: string; name: string }[]; today: string }) {
  const [state, action] = useActionState(recordSaleAction.bind(null, offerId), undefined);
  return (
    <form action={action}>
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
    <button className="btn sec" disabled={pending} onClick={() => confirm("Remover esta venda? O registro fica na auditoria.") && start(async () => void (await removeSaleAction(offerId, saleId)))}>
      Remover
    </button>
  );
}
