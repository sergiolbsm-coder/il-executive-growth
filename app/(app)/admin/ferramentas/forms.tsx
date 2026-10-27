"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui";
import { saveToolAction, setTemplateToolsAction, type AdminToolState } from "./actions";

function Feedback({ state }: { state: AdminToolState }) {
  if (!state) return null;
  return (
    <>
      {state.error && <div className="msg err">{state.error}</div>}
      {state.ok && <div className="msg ok">{state.ok}</div>}
    </>
  );
}

export type ToolFormValue = {
  slug: string; name: string; phase: string; kind: "declarativa" | "externa"; description: string; fieldsJson: string;
  externalUrl: string; strategic: boolean; weight: number; active: boolean; gateKeys: string; isNew: boolean;
};

export function ToolEditor({ v }: { v: ToolFormValue }) {
  const [state, action] = useActionState(saveToolAction, undefined);
  const [kind, setKind] = useState(v.kind);
  return (
    <form action={action} key={v.slug || "novo"}>
      <div className="row">
        <div style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="slug">Identificador (não muda depois)</label>
          <input id="slug" name="slug" defaultValue={v.slug} readOnly={!v.isNew} required placeholder="ex.: diario-decisoes" />
        </div>
        <div style={{ flex: 2, minWidth: 240 }}><label htmlFor="name">Nome</label><input id="name" name="name" defaultValue={v.name} required /></div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="phase">Fase</label>
          <select id="phase" name="phase" defaultValue={v.phase}>
            <option value="levantamento">Levantamento</option><option value="prototipacao">Prototipação</option><option value="lancamento">Lançamento</option><option value="transversal">Transversal</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="kind">Tipo</label>
          <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as "declarativa" | "externa")} disabled={!v.isNew}>
            <option value="declarativa">Declarativa (formulário)</option><option value="externa">Externa (link)</option>
          </select>
          {!v.isNew && <input type="hidden" name="kind" value={kind} />}
        </div>
        <div style={{ flex: 1, minWidth: 120 }}><label htmlFor="weight">Peso (1–10)</label><input id="weight" name="weight" type="number" min={1} max={10} defaultValue={v.weight} /></div>
      </div>
      <label htmlFor="description">Descrição</label>
      <textarea id="description" name="description" rows={2} defaultValue={v.description} />
      <div className="row">
        <label className="chk"><input type="checkbox" name="strategic" defaultChecked={v.strategic} /> Estratégica (pesa o dobro no score)</label>
        <label className="chk"><input type="checkbox" name="active" defaultChecked={v.active} /> Ativa</label>
      </div>
      {kind === "declarativa" ? (
        <>
          <label htmlFor="gateKeys">Itens de portão que ela comprova (identificadores separados por vírgula)</label>
          <input id="gateKeys" name="gateKeys" defaultValue={v.gateKeys} placeholder="ex.: preco, pitch" />
          <label htmlFor="fields">Campos (JSON). Tipos: text, textarea, number, url, select, checklist (select/checklist exigem options)</label>
          <textarea id="fields" name="fields" rows={14} defaultValue={v.fieldsJson} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} spellCheck={false} />
        </>
      ) : (
        <>
          <label htmlFor="externalUrl">Link (http:// ou https://)</label>
          <input id="externalUrl" name="externalUrl" type="url" defaultValue={v.externalUrl} />
        </>
      )}
      <Feedback state={state} />
      <SubmitButton>{v.isNew ? "Criar ferramenta" : "Salvar ferramenta"}</SubmitButton>
    </form>
  );
}

export function TemplateToolsForm({ templateId, tools, selected }: { templateId: string; tools: { slug: string; name: string; active: boolean }[]; selected: string[] }) {
  const [state, action] = useActionState(setTemplateToolsAction.bind(null, templateId), undefined);
  return (
    <form action={action}>
      <div className="kgrid">
        {tools.map((t) => (
          <label key={t.slug} className="chk"><input type="checkbox" name="tools" value={t.slug} defaultChecked={selected.includes(t.slug)} /> {t.name}{!t.active && <span className="badge muted">inativa</span>}</label>
        ))}
      </div>
      <Feedback state={state} />
      <SubmitButton className="btn sec">Salvar ferramentas do template</SubmitButton>
    </form>
  );
}
