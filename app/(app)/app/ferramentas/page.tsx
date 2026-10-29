import Link from "next/link";
import { listMentees } from "@/domains/mentees/service";
import { listOffers } from "@/domains/offers/service";
import { listPrograms } from "@/domains/programs/service";
import { listProgramTools } from "@/domains/tools/service";
import { requireUser, toContext } from "@/lib/auth/session";
import { ProgramPicker, pickProgram } from "@/components/ProgramPicker";
import { StartButton } from "./forms";

const PHASES = [
  ["levantamento", "Levantamento"], ["prototipacao", "Prototipação"], ["lancamento", "Lançamento"], ["transversal", "Transversais"],
] as const;
const CREDIT: Record<string, string> = { revisada: "✅ revisada", concluida: "☑️ concluída", rascunho: "✏️ rascunho" };

type Tool = Awaited<ReturnType<typeof listProgramTools>>["tools"][number];
type Entry = Tool["entries"][number];

/** Melhor entrada: concluída (revisada primeiro) > rascunho mais recente. */
function bestEntry(list: Entry[]): Entry | null {
  const rank = (e: Entry) => (e.status === "concluida" ? (e.reviewed ? 3 : 2) : 1);
  return [...list].sort((a, b) => rank(b) - rank(a) || b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
}
const mark = (e: Entry | null) => (!e ? "⬜" : e.status === "concluida" ? "✅" : "✏️");
const state = (e: Entry | null) => (!e ? "" : e.status === "concluida" ? (e.reviewed ? "revisada" : "concluída") : "rascunho");

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = toContext(user);
  const mentees = await listMentees(ctx);
  const programs = (await listPrograms(ctx, mentees)).filter((p) => p.status !== "encerrado").map((p) => ({ ...p, menteeName: mentees.find((m) => m.id === p.menteeId)?.fullName }));
  const prog = pickProgram(programs, sp.p);
  if (!prog) return (<><h1>Trilha de ferramentas</h1><div className="card"><p className="empty">Nenhum programa ativo por aqui ainda.</p></div></>);
  const [data, offers] = await Promise.all([listProgramTools(ctx, prog.id), listOffers(ctx, prog.id)]);
  const activeOffers = offers.filter((o) => o.status === "ativa").map((o) => ({ id: o.id, name: o.name }));

  // Situação de cada ferramenta: avulsa = tem entrada concluída; ligada a portão = concluída em TODAS as ofertas ativas.
  const rows = data.tools.map((t) => {
    const gated = t.gateKeys.length > 0 && t.kind === "declarativa";
    const perOffer = gated ? activeOffers.map((o) => ({ offer: o, entry: bestEntry(t.entries.filter((e) => e.offerId === o.id)) })) : [];
    const single = !gated ? bestEntry(t.entries) : null;
    const done = t.kind === "externa" ? false : gated ? perOffer.length > 0 && perOffer.every((x) => x.entry?.status === "concluida") : single?.status === "concluida";
    const partial = gated ? perOffer.filter((x) => x.entry?.status === "concluida").length : 0;
    return { t, gated, perOffer, single, done, partial };
  });
  const trackable = rows.filter((r) => r.t.kind === "declarativa");
  const doneCount = trackable.filter((r) => r.done).length;

  return (
    <>
      <h1>Trilha de ferramentas</h1>
      <p className="sub">Passo a passo das ferramentas do programa. O check é automático: ao concluir a ferramenta, ela é marcada aqui e comprova os itens de portão ligados a ela. Usar as estratégicas eleva o Score de Alavancagem.</p>
      <ProgramPicker programs={programs} current={prog.id} base="/app/ferramentas" />
      {data.tools.length === 0 && <div className="card"><p className="empty">Este programa ainda não tem ferramentas. {data.canEdit ? "Abra o programa e use “Carregar padrões do template”." : ""}</p></div>}
      {trackable.length > 0 && (
        <div className="card">
          <div className="row"><h2 className="h2" style={{ margin: 0 }}>Seu progresso</h2> <span className="badge">{doneCount}/{trackable.length}</span></div>
          <div className="desafios-barra-fundo"><div className="desafios-barra-preenchida" style={{ width: `${Math.round((doneCount / trackable.length) * 100)}%` }} /></div>
        </div>
      )}
      {PHASES.map(([ph, title]) => {
        const list = rows.filter((r) => r.t.phase === ph);
        if (!list.length) return null;
        return (
          <div key={ph}>
            <h2 className="h2" style={{ margin: "22px 0 10px" }}>{title}</h2>
            <div className="card">
              {list.map(({ t, gated, perOffer, single, done, partial }) => (
                <div key={t.slug} className={`desafio-card${done ? " desafio-concluido" : ""}`}>
                  <span className="desafio-check" aria-hidden>{t.kind === "externa" ? "↗️" : gated ? (done ? "✅" : partial ? "◐" : "⬜") : mark(single)}</span>
                  <div className="desafio-corpo">
                    <div className="desafio-titulo">
                      {t.name} {t.strategic && <span className="badge">estratégica</span>} {t.kind === "externa" && <span className="badge muted">externa</span>}
                    </div>
                    {t.description && <p className="desafio-descricao">{t.description}</p>}
                    {t.gateKeys.length > 0 && <p className="desafio-descricao" style={{ margin: "4px 0 0", fontSize: 12 }}>Comprova no portão: {t.gateKeys.join(", ")}</p>}
                    {gated && (
                      <>
                        <span className={`desafio-tag ${done ? "desafio-tag-ok" : "desafio-tag-prazo"}`}>{perOffer.length ? `${partial} de ${perOffer.length} ofertas` : "nenhuma oferta ativa ainda"}</span>
                        {perOffer.map(({ offer, entry }) => (
                          <div key={offer.id} className="row" style={{ marginTop: 8, alignItems: "center" }}>
                            <span style={{ width: 24 }}>{mark(entry)}</span>
                            <Link href={`/app/ofertas/${offer.id}`} style={{ flex: 1, minWidth: 160 }}>{offer.name}</Link>
                            {entry ? (
                              <Link href={`/app/ferramentas/entrada/${entry.id}`} className="btn sec">{entry.status === "concluida" ? `Ver (${state(entry)})` : "Continuar"}</Link>
                            ) : (
                              <StartButton programId={prog.id} slug={t.slug} offerId={offer.id} />
                            )}
                          </div>
                        ))}
                        {perOffer.length === 0 && <p style={{ margin: "8px 0 0" }}><Link href="/app/ofertas">Cadastre uma oferta primeiro →</Link></p>}
                      </>
                    )}
                    {!gated && t.kind === "declarativa" && single && <span className={`desafio-tag ${done ? "desafio-tag-ok" : "desafio-tag-prazo"}`}>{state(single)}</span>}
                  </div>
                  {!gated && (
                    <div className="desafio-acao">
                      {t.kind === "externa" ? (
                        <a className="btn sec" href={t.externalUrl ?? "#"} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Abrir em outra aba ↗</a>
                      ) : single ? (
                        <Link href={`/app/ferramentas/entrada/${single.id}`} className="btn sec">{single.status === "concluida" ? "Ver" : "Continuar"}</Link>
                      ) : (
                        <StartButton programId={prog.id} slug={t.slug} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
