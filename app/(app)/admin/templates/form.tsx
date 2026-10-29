"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { updateTemplateAction } from "./actions";

export function EditTemplateForm({ id, initial }: { id: string; initial: { name: string; segment: string; model: string; notes: string | null } }) {
  const [state, action] = useActionState(updateTemplateAction.bind(null, id), undefined);
  return (
    <form action={action} style={{ marginTop: 12 }}>
      <label htmlFor={`name-${id}`}>Nome do plano (template)</label>
      <input id={`name-${id}`} name="name" defaultValue={initial.name} required />
      <div className="row">
        <div style={{ flex: 1 }}><label htmlFor={`seg-${id}`}>Segmento</label><input id={`seg-${id}`} name="segment" defaultValue={initial.segment} required /></div>
        <div style={{ flex: 1 }}><label htmlFor={`mod-${id}`}>Modelo</label><input id={`mod-${id}`} name="model" defaultValue={initial.model} required /></div>
      </div>
      <label htmlFor={`notes-${id}`}>Observações</label>
      <input id={`notes-${id}`} name="notes" defaultValue={initial.notes ?? ""} />
      {state?.error && <div className="msg err">{state.error}</div>}
      {state?.ok && <div className="msg ok">{state.ok}</div>}
      <SubmitButton>Salvar plano</SubmitButton>
    </form>
  );
}
