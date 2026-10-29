import Link from "next/link";
import { notFound } from "next/navigation";
import { listOffers } from "@/domains/offers/service";
import { getProgram } from "@/domains/programs/service";
import { ForbiddenError } from "@/lib/authorization";
import { ValidationError } from "@/lib/errors";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDay } from "@/lib/format";
import { Meters, ProgramMap } from "@/components/ProgramMap";
import { ScheduleBadge, StageBar } from "@/components/StageBar";
import { stageName } from "@/lib/stages";
import { NewOfferForm } from "../../ofertas/forms";
import { LoadDefaultsButton, ProgramForm } from "./form";

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  let data;
  let offers;
  try {
    [data, offers] = await Promise.all([getProgram(toContext(user), id), listOffers(toContext(user), id)]);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof ValidationError) notFound();
    throw e;
  }
  const { program, mentee, sources, levels, canEdit } = data;
  const top = [...levels].sort((a, b) => b.level - a.level);
  return (
    <>
      <p className="sub"><Link href={`/app/mentorados/${mentee.id}`}>← {mentee.fullName}</Link></p>
      <h1>{program.name}</h1>
      {canEdit && <p className="sub"><a href="#editar">✏️ Renomear / editar programa</a></p>}
      <p className="sub">
        {program.model ?? "sem modelo"} · {fmtDay(program.startDate)} → {fmtDay(program.endDate)} · {program.weeklyHours ?? "—"} h/semana ·
        snapshot do template v{program.templateVersion ?? "—"} · <span className={`badge${program.status === "ativo" ? "" : " muted"}`}>{program.status}</span>
      </p>

      <div className="row" style={{ marginBottom: 16 }}>
        <Link href={`/app/cadencia?p=${program.id}`} className="btn sec">🗓️ Cadência</Link>
        <Link href={`/app/score?p=${program.id}`} className="btn sec">🚀 Score</Link>
        <Link href={`/app/ferramentas?p=${program.id}`} className="btn sec">🧰 Ferramentas</Link>
        <Link href={`/app/conteudo?p=${program.id}`} className="btn sec">✍️ Conteúdo</Link>
        <Link href="/app/sessoes" className="btn sec">✅ Sessões e tarefas</Link>
      </div>

      <div className="card">
        <h2 className="h2">Propósito</h2>
        <p style={{ fontSize: 18, margin: 0 }}>{program.purpose ?? <span className="empty">Ainda não definido.</span>}</p>
      </div>

      <div className="card">
        <h2 className="h2">Mapa das receitas</h2>
        <p className="sub">Cada oferta na coluna do seu estágio; receitas sem oferta aparecem como lacuna. Meta de abril: 9 estruturadas, 4–5 validadas, 2–3 em escala.</p>
        <Meters sources={sources} offers={offers} />
        <ProgramMap sources={sources} levels={levels} offers={offers} />
      </div>

      <div className="card">
        <h2 className="h2">Ofertas ({offers.length})</h2>
        {offers.length === 0 ? (
          <p className="empty">Nenhuma oferta ainda.{canEdit ? " Crie a primeira abaixo." : ""}</p>
        ) : (
          <table>
            <thead><tr><th>Oferta</th><th>Receita</th><th style={{ width: 180 }}>Ciclo</th><th>Estágio</th><th>Meta / prazo</th><th>Vendas</th></tr></thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} style={o.status !== "ativa" ? { opacity: 0.6 } : undefined}>
                  <td><Link href={`/app/ofertas/${o.id}`}>{o.name}</Link>{o.status !== "ativa" && <> <span className="badge muted">{o.status}</span></>}</td>
                  <td>{sources.find((x) => x.slug === o.revenueSlug)?.name ?? o.revenueSlug}</td>
                  <td><StageBar stage={o.stage} compact /></td>
                  <td>{o.stage}. {stageName(o.stage)}</td>
                  <td>{stageName(o.targetStage)}{o.dueDate ? ` · ${fmtDay(o.dueDate)}` : ""} <ScheduleBadge status={o.schedule} /></td>
                  <td>{o.salesCount}{o.pendingChecks > 0 && <> <span className="badge" title="itens aguardando confirmação">⏳ {o.pendingChecks}</span></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canEdit && (
        <div className="card">
          <h2 className="h2">Nova oferta</h2>
          <NewOfferForm programId={program.id} sources={sources.map((x) => ({ slug: x.slug, name: x.name, level: x.level }))} />
        </div>
      )}

      <div className="card">
        <h2 className="h2">Escala do Negócio</h2>
        <p className="sub">Do topo (menor volume, maior ticket) à base (maior volume, menor ticket).</p>
        <table>
          <thead><tr><th>Nível</th><th>Volume</th><th>Ticket</th><th>Esforço</th><th>Papel</th><th>Receitas</th></tr></thead>
          <tbody>
            {top.map((l) => {
              const here = sources.filter((s) => s.level === l.level);
              return (
                <tr key={l.id}>
                  <td><b>{l.level}</b> · {l.name}</td>
                  <td>{l.volume}</td>
                  <td>{l.ticket}</td>
                  <td>{l.effort}</td>
                  <td>{l.role}</td>
                  <td>
                    {here.length === 0 ? <span className="empty">—</span> : here.map((s) => (
                      <span key={s.id} className={`badge${s.isMotor ? "" : " muted"}`} style={{ marginRight: 6 }} title={s.isMotor ? "motor comercial" : undefined}>{s.name}{s.isMotor ? " ★" : ""}</span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="h2">Catálogo de receitas ({sources.length})</h2>
        <table>
          <thead><tr><th>#</th><th>Receita</th><th>Nível</th><th>Papel</th><th>Motor</th></tr></thead>
          <tbody>
            {sources.map((s, i) => (
              <tr key={s.id}><td>{i + 1}</td><td>{s.name}<br /><code className="pw">{s.slug}</code></td><td>{s.level}</td><td>{s.role ?? "—"}</td><td>{s.isMotor ? "★" : "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="card">
          <h2 className="h2">Padrões do template</h2>
          <p className="sub">Completa este programa com portões, KPIs, ferramentas e pesos do score que o template tem e o programa ainda não (não altera nada que já exista).</p>
          <LoadDefaultsButton programId={program.id} />
        </div>
      )}

      {canEdit && (
        <div className="card" id="editar">
          <h2 className="h2">Editar programa (nome, propósito, datas)</h2>
          <ProgramForm
            programId={program.id}
            initial={{ name: program.name, purpose: program.purpose, weeklyHours: program.weeklyHours, startDate: program.startDate, endDate: program.endDate, status: program.status }}
          />
        </div>
      )}
    </>
  );
}
