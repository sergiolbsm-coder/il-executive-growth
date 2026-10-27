"use client";

import { useActionState, useState, useTransition } from "react";
import { SaveState, SubmitButton } from "@/components/ui";
import { createSessionAction, createTaskAction, setTaskStatusAction, type SessState } from "./actions";

type Prog = { id: string; label: string };

function Feedback({ state }: { state: SessState }) {
  if (!state) return null;
  return (
    <>
      {state.error && <div className="msg err">{state.error}</div>}
      {state.ok && <div className="msg ok">{state.ok}</div>}
    </>
  );
}

export function NewSessionForm({ programs, today }: { programs: Prog[]; today: string }) {
  const [state, action] = useActionState(createSessionAction, undefined);
  return (
    <form action={action}>
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label htmlFor="sp">Programa</label>
          <select id="sp" name="programId" required>{programs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}><label htmlFor="sd">Data</label><input id="sd" name="heldOn" type="date" defaultValue={today} required /></div>
      </div>
      <label htmlFor="st">Título</label>
      <input id="st" name="title" required />
      <label htmlFor="ss">Ata (compartilhada com o mentorado)</label>
      <textarea id="ss" name="summary" rows={3} />
      <label htmlFor="sdec">Decisões</label>
      <textarea id="sdec" name="decisions" rows={2} />
      <label htmlFor="sn">Notas internas (a equipe vê; o mentorado nunca vê)</label>
      <textarea id="sn" name="internalNotes" rows={2} />
      <Feedback state={state} />
      <SubmitButton>Registrar sessão</SubmitButton>
    </form>
  );
}

export function NewTaskForm({ programs, sessions }: { programs: Prog[]; sessions: { id: string; programId: string; label: string }[] }) {
  const [state, action] = useActionState(createTaskAction, undefined);
  const [prog, setProg] = useState(programs[0]?.id ?? "");
  return (
    <form action={action}>
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label htmlFor="tp">Programa</label>
          <select id="tp" name="programId" value={prog} onChange={(e) => setProg(e.target.value)} required>{programs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label htmlFor="ta">Responsável</label>
          <select id="ta" name="assignee" defaultValue="mentorado"><option value="mentorado">Mentorado</option><option value="mentor">Mentor</option></select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}><label htmlFor="td">Prazo</label><input id="td" name="dueDate" type="date" /></div>
      </div>
      <label htmlFor="tt">Tarefa</label>
      <input id="tt" name="title" required />
      <label htmlFor="tsess">Sessão de origem (opcional)</label>
      <select id="tsess" name="sessionId" defaultValue="">
        <option value="">— nenhuma —</option>
        {sessions.filter((x) => x.programId === prog).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      <Feedback state={state} />
      <SubmitButton>Criar tarefa</SubmitButton>
    </form>
  );
}

export function TaskStatusButtons({ taskId, status, canCancel }: { taskId: string; status: string; canCancel: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<SessState>();
  const run = (st: "aberta" | "concluida" | "cancelada") => start(async () => setRes(await setTaskStatusAction(taskId, st)));
  return (
    <div className="row" style={{ gap: 6 }}>
      {status === "aberta" && <button className="btn sec" disabled={pending} onClick={() => run("concluida")}>✓ Concluir</button>}
      {status === "concluida" && <button className="btn sec" disabled={pending} onClick={() => run("aberta")}>Reabrir</button>}
      {status === "cancelada" && canCancel && <button className="btn sec" disabled={pending} onClick={() => run("aberta")}>Reabrir</button>}
      {status === "aberta" && canCancel && <button className="btn sec" disabled={pending} onClick={() => confirm("Cancelar esta tarefa?") && run("cancelada")}>Cancelar</button>}
      <SaveState pending={pending} error={res?.error} />
    </div>
  );
}
