import { notFound } from "next/navigation";
import { getTemplate, listTemplates } from "@/domains/templates/service";
import { canManageTemplates } from "@/lib/authorization";
import { EditTemplateForm } from "./form";
import { requireUser, toContext } from "@/lib/auth/session";

export default async function TemplatesPage() {
  const user = await requireUser();
  const ctx = toContext(user);
  if (!canManageTemplates(ctx)) notFound();
  const list = await listTemplates(ctx);
  const full = await Promise.all(list.map((t) => getTemplate(ctx, t.id))); // consultas em paralelo (banco remoto)
  return (
    <>
      <h1>Templates</h1>
      <p className="sub">Base → segmento → modelo. Programas recebem uma cópia (snapshot); editar um template não altera programas em andamento. Aqui você renomeia o plano; a edição de receitas e portões chega no próximo passo.</p>
      {full.map(({ template, sources, levels }) => (
        <details key={template.id} className="card" open={full.length === 1}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>
            {template.name} <span className="badge muted">{template.segment} / {template.model}</span> <span className="badge muted">v{template.version}</span>
          </summary>
          {template.notes && <p className="sub" style={{ marginTop: 12 }}>{template.notes}</p>}
          <EditTemplateForm id={template.id} initial={{ name: template.name, segment: template.segment, model: template.model, notes: template.notes }} />
          <h2 className="h2">Escala do Negócio</h2>
          <table>
            <thead><tr><th>Nível</th><th>Volume</th><th>Ticket</th><th>Esforço</th><th>Papel</th></tr></thead>
            <tbody>
              {[...levels].sort((a, b) => b.level - a.level).map((l) => (
                <tr key={l.id}><td><b>{l.level}</b> · {l.name}</td><td>{l.volume}</td><td>{l.ticket}</td><td>{l.effort}</td><td>{l.role}</td></tr>
              ))}
            </tbody>
          </table>
          <h2 className="h2" style={{ marginTop: 20 }}>Catálogo de receitas</h2>
          <table>
            <thead><tr><th>#</th><th>Receita</th><th>Identificador</th><th>Nível</th><th>Papel</th><th>Motor</th></tr></thead>
            <tbody>
              {sources.map((s, i) => (
                <tr key={s.id}><td>{i + 1}</td><td>{s.name}</td><td><code className="pw">{s.slug}</code></td><td>{s.level}</td><td>{s.role ?? "—"}</td><td>{s.isMotor ? "★" : "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </>
  );
}
