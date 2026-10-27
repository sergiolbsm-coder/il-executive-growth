import Link from "next/link";
import { notFound } from "next/navigation";
import { listToolsAdmin } from "@/domains/tools/service";
import { canManageTemplates } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { TemplateToolsForm, ToolEditor, type ToolFormValue } from "./forms";

const NEW_FIELDS = JSON.stringify([{ key: "campo1", label: "Primeiro campo", type: "textarea", required: true }], null, 2);
const PHASE: Record<string, string> = { levantamento: "Levantamento", prototipacao: "Prototipação", lancamento: "Lançamento", transversal: "Transversal" };

export default async function AdminToolsPage({ searchParams }: { searchParams: Promise<{ t?: string; saved?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = toContext(user);
  if (!canManageTemplates(ctx)) notFound();
  const { tools, templates } = await listToolsAdmin(ctx);
  const sel = sp.t && sp.t !== "novo" ? tools.find((t) => t.slug === sp.t) : undefined;
  const editing = sp.t === "novo" || !!sel;
  const value: ToolFormValue = sel
    ? { slug: sel.slug, name: sel.name, phase: sel.phase, kind: sel.kind, description: sel.description ?? "", fieldsJson: JSON.stringify(sel.fields, null, 2), externalUrl: sel.externalUrl ?? "", strategic: sel.strategic, weight: sel.weight, active: sel.active, gateKeys: sel.gateKeys.join(", "), isNew: false }
    : { slug: "", name: "", phase: "transversal", kind: "declarativa", description: "", fieldsJson: NEW_FIELDS, externalUrl: "", strategic: false, weight: 1, active: true, gateKeys: "", isNew: true };
  return (
    <>
      <h1>Ferramentas (cadastro)</h1>
      <p className="sub">Catálogo de ferramentas da Caixa de ferramentas. Ferramentas declarativas são formulários definidos por campos; as externas abrem um link.</p>
      {sp.saved && <div className="msg ok">Ferramenta salva.</div>}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}><h2 className="h2" style={{ margin: 0 }}>Catálogo ({tools.length})</h2><Link href="/admin/ferramentas?t=novo" className="btn sec">+ Nova ferramenta</Link></div>
        <table>
          <thead><tr><th>Ferramenta</th><th>Fase</th><th>Tipo</th><th>Peso</th><th>Comprova</th><th>Templates</th><th></th></tr></thead>
          <tbody>
            {tools.map((t) => (
              <tr key={t.slug} style={t.active ? undefined : { opacity: 0.55 }}>
                <td>{t.name} {t.strategic && <span className="badge">estratégica</span>}{!t.active && <> <span className="badge muted">inativa</span></>}<br /><code className="pw">{t.slug}</code></td>
                <td>{PHASE[t.phase]}</td><td>{t.kind}</td><td>{t.weight}</td>
                <td style={{ fontSize: 12 }}>{t.gateKeys.join(", ") || "—"}</td><td>{t.templateIds.length}</td>
                <td><Link href={`/admin/ferramentas?t=${t.slug}`} className="btn sec">Editar</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <div className="card"><h2 className="h2">{sel ? `Editar: ${sel.name}` : "Nova ferramenta"}</h2><ToolEditor v={value} /></div>}
      <div className="card">
        <h2 className="h2">Ferramentas por template</h2>
        <p className="sub">Define quais ferramentas cada modelo inclui. Programas novos recebem uma cópia; os que já existem não mudam sozinhos.</p>
        {templates.map((tp) => (
          <details key={tp.id} style={{ borderBottom: "1px solid var(--idl-border)", padding: "10px 0" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>{tp.name} <span className="badge muted">{tools.filter((t) => t.templateIds.includes(tp.id)).length} ferramentas</span></summary>
            <div style={{ marginTop: 10 }}><TemplateToolsForm templateId={tp.id} tools={tools.map((t) => ({ slug: t.slug, name: t.name, active: t.active }))} selected={tools.filter((t) => t.templateIds.includes(tp.id)).map((t) => t.slug)} /></div>
          </details>
        ))}
      </div>
    </>
  );
}
