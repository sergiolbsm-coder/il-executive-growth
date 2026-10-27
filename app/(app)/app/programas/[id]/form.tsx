"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { updateProgramAction } from "./actions";

export function ProgramForm({
  programId,
  initial,
}: {
  programId: string;
  initial: { name: string; purpose: string | null; weeklyHours: number | null; startDate: string | null; endDate: string | null; status: string };
}) {
  const [state, action] = useActionState(updateProgramAction.bind(null, programId), undefined);
  return (
    <form action={action}>
      <label htmlFor="name">Nome do programa</label>
      <input id="name" name="name" defaultValue={initial.name} required />
      <label htmlFor="purpose">Propósito (topo da Escala do Negócio)</label>
      <input id="purpose" name="purpose" defaultValue={initial.purpose ?? ""} />
      <div className="row">
        <div style={{ flex: 1 }}>
          <label htmlFor="weeklyHours">Horas por semana</label>
          <input id="weeklyHours" name="weeklyHours" type="number" min={0} max={168} defaultValue={initial.weeklyHours ?? ""} />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="status">Situação</label>
          <select id="status" name="status" defaultValue={initial.status}>
            <option value="ativo">ativo</option>
            <option value="pausado">pausado</option>
            <option value="encerrado">encerrado</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1 }}><label htmlFor="startDate">Início</label><input id="startDate" name="startDate" type="date" defaultValue={initial.startDate ?? ""} /></div>
        <div style={{ flex: 1 }}><label htmlFor="endDate">Término</label><input id="endDate" name="endDate" type="date" defaultValue={initial.endDate ?? ""} /></div>
      </div>
      {state?.error && <div className="msg err">{state.error}</div>}
      {state?.ok && <div className="msg ok">{state.ok}</div>}
      <SubmitButton>Salvar</SubmitButton>
    </form>
  );
}
