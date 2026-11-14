import type { Metadata } from "next";
import Link from "next/link";
import { dashboardSummary } from "@/domains/dashboard/service";
import { ScheduleBadge } from "@/components/StageBar";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDay, fmtNum } from "@/lib/format";
import { stageName } from "@/lib/stages";

export const metadata: Metadata = { title: "Painel" };

function Section({ title, count, href, linkLabel, children }: { title: string; count: number; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <section className="attn">
      <div className="attn-head">
        <h3>{title}</h3>
        <span className={`attn-count${count ? " on" : ""}`} aria-label={`${count} pendente(s)`}>{count}</span>
      </div>
      {count === 0 ? <p className="attn-ok">Nada aqui. ✓</p> : children}
      <Link href={href} className="attn-link">{linkLabel} →</Link>
    </section>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const d = await dashboardSummary(toContext(user));
  const first = user.name.split(" ")[0];

  if (d.kind === "staff") {
    const total = d.pending.count + d.late.count + d.tickets.count + d.overdue.count;
    return (
      <>
        <h1>Olá, {first}</h1>
        <p className="sub">{total ? `Você tem ${total} ponto(s) de atenção na sua carteira.` : "Tudo em dia na sua carteira."}</p>
        <div className="grid kpis">
          <div className="card kpi"><b>{d.menteeCount}</b><span>mentorados</span></div>
          <div className="card kpi"><b>{d.programCount}</b><span>programas ativos</span></div>
          <div className="card kpi"><b>{d.late.count}</b><span>ofertas com prazo em risco</span></div>
        </div>
        {d.menteeCount === 0 && (
          <div className="card">
            <h2 className="h2">Comece por aqui</h2>
            <p className="empty">Cadastre um mentorado, abra um programa a partir de um template e ajuste a Escala do Negócio.</p>
            <div className="row"><Link href="/app/mentorados" className="btn" style={{ marginTop: 0, textDecoration: "none" }}>Cadastrar mentorado</Link></div>
          </div>
        )}
        <div className="grid cols-2">
          <div className="card">
            <Section title="Itens aguardando sua confirmação" count={d.pending.count} href="/app/portoes" linkLabel="Ver todos">
              <ul className="attn-list">{d.pending.items.map((r) => <li key={`${r.offerId}:${r.gateKey}`}><Link href={`/app/ofertas/${r.offerId}`}>{r.gateLabel}</Link><span>{r.menteeName} · {r.offerName}</span></li>)}</ul>
            </Section>
          </div>
          <div className="card">
            <Section title="Ofertas atrasadas ou em risco" count={d.late.count} href="/app/ofertas" linkLabel="Ver ofertas">
              <ul className="attn-list">{d.late.items.map((o) => <li key={o.id}><Link href={`/app/ofertas/${o.id}`}>{o.name}</Link><span>{o.menteeName} · {o.stage}. {stageName(o.stage)} <ScheduleBadge status={o.schedule} /></span></li>)}</ul>
            </Section>
          </div>
          <div className="card">
            <Section title="Chamados abertos" count={d.tickets.count} href="/app/chamados" linkLabel="Abrir chamados">
              <ul className="attn-list">{d.tickets.items.map((t) => <li key={t.id}><Link href={`/app/chamados/${t.id}`}>{t.title}</Link><span>{t.menteeName}</span></li>)}</ul>
            </Section>
          </div>
          <div className="card">
            <Section title="Tarefas vencidas" count={d.overdue.count} href="/app/sessoes" linkLabel="Ver tarefas">
              <ul className="attn-list">{d.overdue.items.map((t) => <li key={t.id}><Link href="/app/sessoes">{t.title}</Link><span>{t.menteeName}{t.dueDate ? ` · venceu em ${fmtDay(t.dueDate)}` : ""}</span></li>)}</ul>
            </Section>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Olá, {first}</h1>
      <p className="sub">{d.program ? d.program.name : "Seu plano ainda não foi aberto. Fale com o seu mentor."}</p>
      {d.program && (
        <>
          <div className="card">
            <h2 className="h2">Seu próximo passo</h2>
            {d.steps.length === 0 ? (
              <p className="empty">Você está em dia com o plano. Veja o Score de Alavancagem para os próximos ganhos.</p>
            ) : (
              <>
                <p style={{ margin: "0 0 8px", fontSize: 16 }}><b>{d.steps[0].label}:</b> {d.steps[0].text}</p>
                <p className="sub" style={{ margin: "0 0 12px" }}>Vale até +{fmtNum(d.steps[0].upTo)} pontos no seu Score.</p>
                <div className="row"><Link href="/app/ferramentas" className="btn" style={{ marginTop: 0, textDecoration: "none" }}>Ir para o Começar</Link><Link href="/app/score" className="btn sec">Ver meu Score</Link></div>
                {d.steps.length > 1 && <ul className="attn-list" style={{ marginTop: 14 }}>{d.steps.slice(1).map((s) => <li key={s.key}><span><b>Depois:</b> {s.label} — {s.text}</span></li>)}</ul>}
              </>
            )}
          </div>
          <div className="grid cols-2">
            <div className="card">
              <Section title="Suas tarefas" count={d.tasks.count} href="/app/sessoes" linkLabel="Ver tarefas">
                <ul className="attn-list">{d.tasks.items.map((t) => <li key={t.id}><Link href="/app/sessoes">{t.title}</Link><span>{t.dueDate ? `até ${fmtDay(t.dueDate)}` : "sem prazo"}{d.tasks.overdue && t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10) ? " · vencida" : ""}</span></li>)}</ul>
              </Section>
            </div>
            <div className="card">
              <Section title="Suas ofertas" count={d.offers.length} href="/app/ofertas" linkLabel="Ver ofertas">
                <ul className="attn-list">{d.offers.map((o) => <li key={o.id}><Link href={`/app/ofertas/${o.id}`}>{o.name}</Link><span>{o.stage}. {stageName(o.stage)} <ScheduleBadge status={o.schedule} /></span></li>)}</ul>
              </Section>
            </div>
          </div>
          {d.awaiting > 0 && <p className="sub">⏳ {d.awaiting} item(ns) seu(s) aguardando a confirmação do mentor.</p>}
        </>
      )}
    </>
  );
}
