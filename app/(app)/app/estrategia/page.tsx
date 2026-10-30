import Link from "next/link";
import { listMentees } from "@/domains/mentees/service";
import { listOffers } from "@/domains/offers/service";
import { listPrograms } from "@/domains/programs/service";
import { countCardsByOffer, listCards } from "@/domains/strategy/service";
import { requireUser, toContext } from "@/lib/auth/session";
import { CARD_KINDS, FUNNEL_STAGES, PRIORITIES, type CardKind } from "@/lib/strategy";
import { ProgramPicker, pickProgram } from "@/components/ProgramPicker";
import { CardActions, Lessons, NewCardForm, OfferSelect } from "./forms";

export default async function StrategyPage({ searchParams }: { searchParams: Promise<{ p?: string; o?: string; k?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = toContext(user);
  const mentees = await listMentees(ctx);
  const programs = (await listPrograms(ctx, mentees)).filter((p) => p.status !== "encerrado").map((p) => ({ ...p, menteeName: mentees.find((m) => m.id === p.menteeId)?.fullName }));
  const prog = pickProgram(programs, sp.p);
  if (!prog) return (<><h1>Estratégia de vendas</h1><div className="card"><p className="empty">Nenhum programa ativo por aqui ainda.</p></div></>);

  const [offersAll, counts] = await Promise.all([listOffers(ctx, prog.id), countCardsByOffer(ctx, prog.id)]);
  const offers = offersAll.filter((o) => o.status !== "descartada");
  const offer = offers.find((o) => o.id === sp.o) ?? offers[0];
  const kind = (Object.keys(CARD_KINDS) as CardKind[]).find((k) => k === sp.k);
  const base = (extra: Record<string, string>) => `/app/estrategia?${new URLSearchParams({ p: prog.id, ...(offer ? { o: offer.id } : {}), ...extra }).toString()}`;

  return (
    <>
      <h1>Estratégia de vendas</h1>
      <p className="sub">Apoio para executar o funil de vendas — {prog.menteeName} · {prog.name}. Cada oferta tem o seu quadro; o cartão fica na etapa em que será usado.</p>
      <ProgramPicker programs={programs} current={prog.id} base="/app/estrategia" />
      {!offer ? (
        <div className="card"><p className="empty">Este programa ainda não tem ofertas. <Link href="/app/ofertas">Cadastre uma oferta primeiro →</Link></p></div>
      ) : (
        <Board programId={prog.id} offers={offers.map((o) => ({ id: o.id, name: o.name }))} counts={counts} offerId={offer.id} kind={kind} base={base} />
      )}
    </>
  );
}

async function Board({ programId, offers, counts, offerId, kind, base }: { programId: string; offers: { id: string; name: string }[]; counts: Map<string, number>; offerId: string; kind?: CardKind; base: (e: Record<string, string>) => string }) {
  const ctx = toContext(await requireUser());
  const { cards: all } = await listCards(ctx, offerId);
  const cards = kind ? all.filter((c) => c.kind === kind) : all;
  void programId;
  return (
    <>
      <OfferSelect programId={programId} offerId={offerId} kind={kind} offers={offers.map((o) => ({ id: o.id, name: o.name, count: counts.get(o.id) ?? 0 }))} />
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="sub" style={{ margin: 0 }}>Mostrar:</span>
        <Link href={base({})} className={`btn sec${!kind ? " on" : ""}`} style={!kind ? { background: "var(--idl-magenta)", color: "#fff", borderColor: "var(--idl-magenta)" } : undefined}>Todos</Link>
        {(Object.entries(CARD_KINDS) as [CardKind, string][]).map(([k, label]) => (
          <Link key={k} href={base({ k })} className="btn sec" style={kind === k ? { background: "var(--idl-magenta)", color: "#fff", borderColor: "var(--idl-magenta)" } : undefined}>{label}</Link>
        ))}
      </div>
      <div className="kanban">
        {FUNNEL_STAGES.map((st) => {
          const list = cards.filter((c) => c.stage === st.key);
          return (
            <div key={st.key} className={`kb-col kb-${st.key}`}>
              <div className="kb-head"><b>{st.label}</b> <span className="badge muted">{list.length}</span></div>
              <p className="kb-hint">{st.hint}</p>
              {list.map((c) => (
                <div key={c.id} className="kb-card">
                  <div className="row" style={{ gap: 4 }}>
                    <span className="badge">{CARD_KINDS[c.kind]}</span>
                    <span className={`badge ${c.priority === "alta" ? "" : "muted"}`}>{PRIORITIES[c.priority]}</span>
                  </div>
                  <b>{c.title}</b>
                  {c.description && <p>{c.description}</p>}
                  {c.approach && <p><span className="kb-lbl">Fazer/dizer:</span> {c.approach}</p>}
                  {c.objection && <p><span className="kb-lbl">Objeção:</span> {c.objection}</p>}
                  {c.materialUrl && <p><a href={c.materialUrl} target="_blank" rel="noopener noreferrer">📎 Material de apoio ↗</a></p>}
                  <Lessons cardId={c.id} stage={c.stage} lessons={c.lessons.map((l) => ({ id: l.id, question: l.question, answer: l.answer }))} />
                  <CardActions card={{ id: c.id, stage: c.stage, kind: c.kind, title: c.title, description: c.description, approach: c.approach, objection: c.objection, materialUrl: c.materialUrl, priority: c.priority }} />
                </div>
              ))}
              {list.length === 0 && <p className="kb-empty">—</p>}
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="h2">Novo cartão</h2>
        <p className="sub">Use perfis e demandas, nunca nomes de pessoas ou de empresas específicas.</p>
        <NewCardForm offerId={offerId} />
      </div>
    </>
  );
}
