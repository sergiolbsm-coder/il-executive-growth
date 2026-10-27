import Link from "next/link";
import { listMentees } from "@/domains/mentees/service";
import { listOffers } from "@/domains/offers/service";
import { getProgram, listPrograms } from "@/domains/programs/service";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDay } from "@/lib/format";
import { stageName } from "@/lib/stages";
import { Meters } from "@/components/ProgramMap";
import { ScheduleBadge, StageBar } from "@/components/StageBar";

export default async function OffersOverviewPage() {
  const user = await requireUser();
  const ctx = toContext(user);
  const mentees = await listMentees(ctx);
  const programs = (await listPrograms(ctx, mentees)).filter((p) => p.status !== "encerrado");
  const data = await Promise.all(programs.map(async (p) => ({ p, g: await getProgram(ctx, p.id), offers: await listOffers(ctx, p.id) })));
  return (
    <>
      <h1>Ofertas</h1>
      <p className="sub">Onde está cada oferta no ciclo: Ideia → Prototipada → Oferta pronta → Em prospecção → Primeira venda → Validada → Escala.</p>
      {data.length === 0 && <div className="card"><p className="empty">Nenhum programa ativo por aqui ainda.</p></div>}
      {data.map(({ p, g, offers }) => (
        <div key={p.id} className="card">
          <h2 className="h2"><Link href={`/app/programas/${p.id}`}>{p.name}</Link> <span className="badge muted">{g.mentee.fullName}</span></h2>
          <Meters sources={g.sources} offers={offers} />
          {offers.length === 0 ? (
            <p className="empty">Nenhuma oferta ainda. Abra o programa para criar a primeira.</p>
          ) : (
            <table>
              <thead><tr><th>Oferta</th><th>Receita</th><th style={{ width: 200 }}>Ciclo</th><th>Estágio</th><th>Meta / prazo</th><th>Vendas</th><th></th></tr></thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id} style={o.status !== "ativa" ? { opacity: 0.6 } : undefined}>
                    <td><Link href={`/app/ofertas/${o.id}`}>{o.name}</Link>{o.status !== "ativa" && <> <span className="badge muted">{o.status}</span></>}</td>
                    <td>{g.sources.find((s) => s.slug === o.revenueSlug)?.name ?? o.revenueSlug}</td>
                    <td><StageBar stage={o.stage} compact /></td>
                    <td>{o.stage}. {stageName(o.stage)}</td>
                    <td>{stageName(o.targetStage)}{o.dueDate ? ` · ${fmtDay(o.dueDate)}` : ""} <ScheduleBadge status={o.schedule} /></td>
                    <td>{o.salesCount}</td>
                    <td>{o.pendingChecks > 0 && <span className="badge" title="itens aguardando confirmação">⏳ {o.pendingChecks}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </>
  );
}
