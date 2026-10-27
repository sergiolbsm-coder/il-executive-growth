"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { addKpiAction, saveCheckinAction, saveKpisAction, saveTargetsAction, type CadState } from "./actions";

function Feedback({ state }: { state: CadState }) {
  if (!state) return null;
  return (
    <>
      {state.error && <div className="msg err">{state.error}</div>}
      {state.ok && <div className="msg ok">{state.ok}</div>}
    </>
  );
}

type Kpi = { key: string; label: string; grp: string; weeklyTarget: number | null };

export function KpiForm({ programId, weekStart, kpis, actuals, disabled }: { programId: string; weekStart: string; kpis: Kpi[]; actuals: Record<string, number>; disabled: boolean }) {
  const [state, action] = useActionState(saveKpisAction.bind(null, programId, weekStart), undefined);
  const groups = [...new Set(kpis.map((k) => k.grp))];
  return (
    <form action={action} key={weekStart}>
      {groups.map((g) => (
        <div key={g}>
          <h3 style={{ margin: "14px 0 6px", fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--idl-text-muted)" }}>{g}</h3>
          <div className="kgrid">
            {kpis.filter((k) => k.grp === g).map((k) => (
              <div key={k.key}>
                <label htmlFor={`k-${k.key}`}>{k.label} <span className="tgt">{k.weeklyTarget != null ? `· meta ${k.weeklyTarget}/sem` : "· sem meta"}</span></label>
                <input id={`k-${k.key}`} name={`kpi:${k.key}`} inputMode="decimal" defaultValue={actuals[k.key] ?? ""} placeholder="—" disabled={disabled} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Feedback state={state} />
      {!disabled && <SubmitButton>Salvar KPIs da semana</SubmitButton>}
    </form>
  );
}

type Checkin = { plan: string | null; done: string | null; result: string | null; adjust: string | null; objection: string | null; bestContent: string | null; blocker: string | null; traffic: string | null } | null;

export function CheckinForm({ programId, weekStart, checkin, disabled }: { programId: string; weekStart: string; checkin: Checkin; disabled: boolean }) {
  const [state, action] = useActionState(saveCheckinAction.bind(null, programId, weekStart), undefined);
  const v = (x: string | null | undefined) => x ?? "";
  return (
    <form action={action} key={weekStart}>
      <div className="row">
        <div style={{ flex: 1, minWidth: 260 }}>
          <label htmlFor="plan">P — O que planejei para a semana</label>
          <textarea id="plan" name="plan" rows={3} defaultValue={v(checkin?.plan)} disabled={disabled} />
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <label htmlFor="done">D — O que fiz</label>
          <textarea id="done" name="done" rows={3} defaultValue={v(checkin?.done)} disabled={disabled} />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 260 }}>
          <label htmlFor="result">C — Resultado real</label>
          <textarea id="result" name="result" rows={3} defaultValue={v(checkin?.result)} disabled={disabled} />
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <label htmlFor="adjust">A — Ajuste para a próxima semana</label>
          <textarea id="adjust" name="adjust" rows={3} defaultValue={v(checkin?.adjust)} disabled={disabled} />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 220 }}><label htmlFor="objection">Objeção mais frequente</label><input id="objection" name="objection" defaultValue={v(checkin?.objection)} disabled={disabled} /></div>
        <div style={{ flex: 1, minWidth: 220 }}><label htmlFor="bestContent">Conteúdo que mais engajou</label><input id="bestContent" name="bestContent" defaultValue={v(checkin?.bestContent)} disabled={disabled} /></div>
        <div style={{ flex: 1, minWidth: 220 }}><label htmlFor="blocker">O que travou</label><input id="blocker" name="blocker" defaultValue={v(checkin?.blocker)} disabled={disabled} /></div>
      </div>
      <label htmlFor="traffic">Semáforo da semana</label>
      <select id="traffic" name="traffic" defaultValue={v(checkin?.traffic)} disabled={disabled} style={{ maxWidth: 240 }}>
        <option value="">— sem avaliação —</option><option value="verde">🟢 Verde</option><option value="amarelo">🟡 Amarelo</option><option value="vermelho">🔴 Vermelho</option>
      </select>
      <Feedback state={state} />
      {!disabled && <SubmitButton>Salvar check-in</SubmitButton>}
    </form>
  );
}

export function TargetsForm({ programId, kpis }: { programId: string; kpis: Kpi[] }) {
  const [state, action] = useActionState(saveTargetsAction.bind(null, programId), undefined);
  return (
    <form action={action}>
      <div className="kgrid">
        {kpis.map((k) => (
          <div key={k.key}>
            <label htmlFor={`t-${k.key}`}>{k.label} <span className="tgt">· {k.grp}</span></label>
            <input id={`t-${k.key}`} name={`t:${k.key}`} inputMode="decimal" defaultValue={k.weeklyTarget ?? ""} placeholder="sem meta" />
          </div>
        ))}
      </div>
      <Feedback state={state} />
      <SubmitButton className="btn sec">Salvar metas semanais</SubmitButton>
    </form>
  );
}

export function AddKpiForm({ programId }: { programId: string }) {
  const [state, action] = useActionState(addKpiAction.bind(null, programId), undefined);
  return (
    <form action={action}>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}><label htmlFor="nk">Identificador</label><input id="nk" name="key" placeholder="ex.: indicacoes" required /></div>
        <div style={{ flex: 2, minWidth: 200 }}><label htmlFor="nl">Nome do KPI</label><input id="nl" name="label" required /></div>
        <div style={{ flex: 1, minWidth: 140 }}><label htmlFor="ng">Grupo</label><input id="ng" name="grp" defaultValue="Prospecção" /></div>
        <div style={{ flex: 1, minWidth: 120 }}><label htmlFor="nt">Meta/sem</label><input id="nt" name="weeklyTarget" inputMode="decimal" /></div>
      </div>
      <Feedback state={state} />
      <SubmitButton className="btn sec">Acrescentar KPI</SubmitButton>
    </form>
  );
}
