"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { assignMentorsAction, createMenteeAction, createProgramAction, type MenteeState } from "./actions";

type Mentor = { id: string; name: string };
type Template = { id: string; name: string; segment: string; model: string; version: number };

function Feedback({ state }: { state: MenteeState }) {
  if (!state) return null;
  return (
    <>
      {state.error && <div className="msg err">{state.error}</div>}
      {state.ok && (
        <div className="msg ok">
          {state.ok} {state.tempPassword && <code className="pw">{state.tempPassword}</code>}
        </div>
      )}
    </>
  );
}

export function NewMenteeForm({ mentors }: { mentors: Mentor[] }) {
  const [state, action] = useActionState(createMenteeAction, undefined);
  return (
    <form action={action} className="card">
      <h2 className="h2">Novo mentorado</h2>
      <label htmlFor="fullName">Nome completo</label>
      <input id="fullName" name="fullName" required />
      <label htmlFor="email">E-mail</label>
      <input id="email" name="email" type="email" />
      <label htmlFor="segment">Segmento (ex.: educação, finanças, saúde)</label>
      <input id="segment" name="segment" />
      <label>Mentores</label>
      <div className="scope-list">
        {mentors.length === 0 && <span className="empty">Nenhum mentor cadastrado ainda.</span>}
        {mentors.map((m) => (
          <label key={m.id} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
            <input type="checkbox" name="mentorIds" value={m.id} style={{ width: "auto" }} /> {m.name}
          </label>
        ))}
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
        <input type="checkbox" name="createAccess" style={{ width: "auto" }} /> Liberar acesso ao sistema (exige e-mail)
      </label>
      <Feedback state={state} />
      <SubmitButton>Cadastrar</SubmitButton>
    </form>
  );
}

export function AssignMentorsForm({ menteeId, mentors, selected }: { menteeId: string; mentors: Mentor[]; selected: string[] }) {
  const [state, action] = useActionState(assignMentorsAction.bind(null, menteeId), undefined);
  return (
    <form action={action}>
      <div className="scope-list">
        {mentors.map((m) => (
          <label key={m.id} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
            <input type="checkbox" name="mentorIds" value={m.id} defaultChecked={selected.includes(m.id)} style={{ width: "auto" }} /> {m.name}
          </label>
        ))}
      </div>
      <Feedback state={state} />
      <SubmitButton className="btn sec">Salvar mentores</SubmitButton>
    </form>
  );
}

export function NewProgramForm({ menteeId, templates }: { menteeId: string; templates: Template[] }) {
  const [state, action] = useActionState(createProgramAction.bind(null, menteeId), undefined);
  return (
    <form action={action} className="card">
      <h2 className="h2">Abrir programa</h2>
      <p className="sub">O programa recebe uma <b>cópia</b> do catálogo e da pirâmide do template; mudar o template depois não altera este programa.</p>
      <label htmlFor="templateId">Template</label>
      <select id="templateId" name="templateId" required>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.name} — {t.segment} / {t.model} (v{t.version})</option>
        ))}
      </select>
      <label htmlFor="name">Nome do programa</label>
      <input id="name" name="name" required />
      <label htmlFor="model">Modelo (Smart, Executive, Master, Advisory, Impulso… — vazio usa o do template)</label>
      <input id="model" name="model" />
      <label htmlFor="purpose">Propósito (topo da Escala do Negócio)</label>
      <input id="purpose" name="purpose" />
      <label htmlFor="weeklyHours">Horas por semana disponíveis</label>
      <input id="weeklyHours" name="weeklyHours" type="number" min={0} max={168} />
      <div className="row">
        <div style={{ flex: 1 }}><label htmlFor="startDate">Início</label><input id="startDate" name="startDate" type="date" /></div>
        <div style={{ flex: 1 }}><label htmlFor="endDate">Término</label><input id="endDate" name="endDate" type="date" /></div>
      </div>
      <Feedback state={state} />
      <SubmitButton>Abrir programa</SubmitButton>
    </form>
  );
}
