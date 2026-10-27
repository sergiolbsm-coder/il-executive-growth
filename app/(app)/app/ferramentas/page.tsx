import Link from "next/link";
import { listMentees } from "@/domains/mentees/service";
import { listOffers } from "@/domains/offers/service";
import { listPrograms } from "@/domains/programs/service";
import { listProgramTools } from "@/domains/tools/service";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";
import { ProgramPicker, pickProgram } from "@/components/ProgramPicker";
import { NewEntryForm } from "./forms";

const PHASES = [
  ["levantamento", "Levantamento"], ["prototipacao", "Prototipação"], ["lancamento", "Lançamento"], ["transversal", "Transversais"],
] as const;
const CREDIT: Record<string, string> = { revisada: "✅ revisada", concluida: "☑️ concluída", rascunho: "✏️ rascunho" };

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = toContext(user);
  const mentees = await listMentees(ctx);
  const programs = (await listPrograms(ctx, mentees)).filter((p) => p.status !== "encerrado").map((p) => ({ ...p, menteeName: mentees.find((m) => m.id === p.menteeId)?.fullName }));
  const prog = pickProgram(programs, sp.p);
  if (!prog) return (<><h1>Ferramentas</h1><div className="card"><p className="empty">Nenhum programa ativo por aqui ainda.</p></div></>);
  const [data, offers] = await Promise.all([listProgramTools(ctx, prog.id), listOffers(ctx, prog.id)]);
  const offerOpts = offers.filter((o) => o.status === "ativa").map((o) => ({ id: o.id, name: o.name }));
  return (
    <>
      <h1>Ferramentas</h1>
      <p className="sub">Caixa de ferramentas do programa. Concluir uma ferramenta numa oferta comprova os itens de portão ligados a ela; usar as estratégicas eleva o Score de Alavancagem.</p>
      <ProgramPicker programs={programs} current={prog.id} base="/app/ferramentas" />
      {data.tools.length === 0 && <div className="card"><p className="empty">Este programa ainda não tem ferramentas. {data.canEdit ? "Abra o programa e use “Carregar padrões do template”." : ""}</p></div>}
      {PHASES.map(([ph, title]) => {
        const list = data.tools.filter((t) => t.phase === ph);
        if (!list.length) return null;
        return (
          <div key={ph}>
            <h2 className="h2" style={{ margin: "22px 0 10px" }}>{title}</h2>
            {list.map((t) => (
              <div key={t.slug} className="card tool-card">
                <h3>
                  {t.name} {t.strategic && <span className="badge">estratégica</span>} {t.kind === "externa" && <span className="badge muted">externa</span>}{" "}
                  {t.best && <span className="stage-chip">{CREDIT[t.best]}</span>}
                </h3>
                {t.description && <p className="sub" style={{ margin: "0 0 8px" }}>{t.description}</p>}
                {t.gateKeys.length > 0 && <p className="opt" style={{ margin: "0 0 8px" }}>Comprova no portão: {t.gateKeys.join(", ")}</p>}
                {t.kind === "externa" ? (
                  <a className="btn sec" href={t.externalUrl ?? "#"} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", textDecoration: "none" }}>Abrir em outra aba ↗</a>
                ) : (
                  <>
                    {t.entries.length > 0 && (
                      <table style={{ marginBottom: 10 }}>
                        <thead><tr><th>Entrada</th><th>Oferta</th><th>Situação</th><th>Atualizada</th></tr></thead>
                        <tbody>
                          {t.entries.map((e) => (
                            <tr key={e.id}>
                              <td><Link href={`/app/ferramentas/entrada/${e.id}`}>{e.title || t.name}</Link></td>
                              <td>{e.offerName ?? "—"}</td>
                              <td>{e.status === "concluida" ? (e.reviewed ? "✅ revisada" : "☑️ concluída") : "✏️ rascunho"}</td>
                              <td>{fmtDateTime(e.updatedAt.toISOString())}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <NewEntryForm programId={prog.id} slug={t.slug} offers={offerOpts} needsOffer={t.gateKeys.length > 0} />
                  </>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
