import Link from "next/link";
import { notFound } from "next/navigation";
import { getOffer } from "@/domains/offers/service";
import { todayBR } from "@/domains/offers/stage";
import { ForbiddenError, canDeleteRecords } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";
import { fmtBRL, fmtDateTime, fmtDay } from "@/lib/format";
import { STAGES, stageName } from "@/lib/stages";
import { ScheduleBadge, StageBar } from "@/components/StageBar";
import { GateItem, OfferEditForm, RemoveSaleButton, SaleForm, StatusForm } from "../forms";

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ctx = toContext(user);
  let d;
  try {
    d = await getOffer(ctx, id);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof ValidationError) notFound();
    throw e;
  }
  const { offer, program, mentee, gates, checks, sales, siblings, people, canEdit } = d;
  const canPropose = user.role === "mentorado";
  const active = offer.status === "ativa";
  const name = (uid: string | null) => (uid ? people[uid] ?? null : null);
  const byKey = new Map(checks.map((c) => [c.gateKey, c]));
  const originName = (oid: string | null) => siblings.find((s) => s.id === oid)?.name ?? null;

  return (
    <>
      <p className="sub"><Link href={`/app/programas/${program.id}`}>← {program.name}</Link> · {mentee.fullName}</p>
      <h1>{offer.name}</h1>
      <p className="sub">
        <span className="stage-chip">Estágio {offer.stage}: {stageName(offer.stage)}</span>{" "}
        <ScheduleBadge status={offer.schedule} />{" "}
        {!active && <span className="badge muted">{offer.status}</span>}{" "}
        Meta: {stageName(offer.targetStage)}{offer.dueDate ? ` até ${fmtDay(offer.dueDate)}` : ""} · nível {offer.level}{offer.wave ? ` · onda ${offer.wave}` : ""}
        {offer.priceNote ? ` · ${offer.priceNote}` : ""}
      </p>
      {!active && offer.statusReason && <div className="msg err">Oferta {offer.status}: {offer.statusReason}</div>}

      <div className="card">
        <StageBar stage={offer.stage} />
        {offer.missing.length > 0 && active && (
          <p className="sub" style={{ margin: "14px 0 0" }}>
            Para chegar a <b>{stageName(offer.stage + 1)}</b>, falta:{" "}
            {offer.missing.map((m) => gates.find((g) => g.key === m.key)?.label ?? m.key).join(" · ")}
            {offer.stage + 1 >= 5 && offer.salesCount < 1 && !offer.missing.some((m) => m.kind === "vendas") ? " · (e ao menos 1 venda registrada)" : ""}
          </p>
        )}
        {offer.stage === 7 && <p className="sub" style={{ margin: "14px 0 0" }}>Oferta em escala. 🎉</p>}
        {offer.pendingChecks > 0 && <p className="sub" style={{ margin: "10px 0 0" }}>⏳ {offer.pendingChecks} item(ns) aguardando confirmação da equipe.</p>}
      </div>

      <div className="card">
        <h2 className="h2">Ideia (estágio 1)</h2>
        <p><b>Problema:</b> {offer.problem}</p>
        <p style={{ margin: 0 }}><b>Público:</b> {offer.audience}</p>
      </div>

      {STAGES.filter((s) => s.n >= 2).map((st) => {
        const list = gates.filter((g) => g.stage === st.n);
        const reached = offer.stage >= st.n;
        return (
          <div key={st.n} className={`card stage-card${reached ? " reached" : ""}${offer.stage + 1 === st.n ? " current" : ""}`}>
            <h3>
              {st.n}. {st.name} <span className="badge muted">{st.phase}</span>{" "}
              {reached ? <span className="stage-chip sch-cumprida">alcançado</span> : offer.stage + 1 === st.n ? <span className="stage-chip">próximo</span> : null}
            </h3>
            {list.length === 0 ? (
              <p className="empty">Nenhum portão configurado para este estágio.</p>
            ) : (
              list.map((g) => {
                const c = byKey.get(g.key);
                return (
                  <GateItem
                    key={g.key}
                    offerId={offer.id}
                    gate={{ key: g.key, label: g.label, kind: g.kind, threshold: g.threshold, required: g.required }}
                    check={c ? { state: c.state, evidence: c.evidence, by: name(c.checkedBy), confirmedBy: name(c.confirmedBy), at: fmtDateTime(c.checkedAt.toISOString()) } : null}
                    salesCount={offer.salesCount}
                    canStaff={canEdit}
                    canPropose={canPropose}
                    offerActive={active}
                  />
                );
              })
            )}
          </div>
        );
      })}

      <div className="card">
        <h2 className="h2">Vendas ({sales.length})</h2>
        {sales.length === 0 ? (
          <p className="empty">Nenhuma venda registrada. A <b>Primeira venda</b> (estágio 5) só existe com uma venda lançada.</p>
        ) : (
          <table>
            <thead><tr><th>Data</th><th>Cliente</th><th>Valor</th><th>Canal</th><th>Origem do lead</th>{canEdit && <th>Registrada por</th>}<th></th></tr></thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDay(s.soldAt)}</td><td>{s.clientName}</td><td>{fmtBRL(s.valueCents)}</td><td>{s.channel ?? "—"}</td>
                  <td>{originName(s.originOfferId) ?? "—"}</td>
                  {canEdit && <td>{name(s.createdBy) ?? "—"}</td>}
                  <td>{canDeleteRecords(ctx) && <RemoveSaleButton offerId={offer.id} saleId={s.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canEdit && active && (
        <div className="card">
          <h2 className="h2">Registrar venda</h2>
          <SaleForm offerId={offer.id} siblings={siblings.filter((s) => s.id !== offer.id)} today={todayBR()} />
        </div>
      )}

      {canEdit && (
        <>
          <div className="card">
            <h2 className="h2">Editar oferta</h2>
            <OfferEditForm
              offerId={offer.id}
              initial={{ name: offer.name, problem: offer.problem, audience: offer.audience, priceNote: offer.priceNote, level: offer.level, wave: offer.wave, dueDate: offer.dueDate, targetStage: offer.targetStage }}
            />
          </div>
          <div className="card">
            <h2 className="h2">Pausar, descartar ou reativar</h2>
            <p className="sub">Nada é apagado: o motivo fica no histórico e a oferta pode ser reativada.</p>
            <StatusForm offerId={offer.id} status={offer.status} />
          </div>
        </>
      )}
    </>
  );
}
