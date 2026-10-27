import Link from "next/link";
import { getWeek, listCheckins, monthSummary } from "@/domains/cadence/service";
import { listMentees } from "@/domains/mentees/service";
import { listPrograms } from "@/domains/programs/service";
import { requireUser, toContext } from "@/lib/auth/session";
import { addDays, currentWeek, isIsoDate, mondayOf, weekLabel } from "@/lib/week";
import { ProgramPicker, pickProgram } from "@/components/ProgramPicker";
import { AddKpiForm, CheckinForm, KpiForm, TargetsForm } from "./forms";

const TL: Record<string, string> = { verde: "🟢 verde", amarelo: "🟡 amarelo", vermelho: "🔴 vermelho" };

export default async function CadencePage({ searchParams }: { searchParams: Promise<{ p?: string; w?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = toContext(user);
  const mentees = await listMentees(ctx);
  const programs = (await listPrograms(ctx, mentees)).filter((p) => p.status !== "encerrado").map((p) => ({ ...p, menteeName: mentees.find((m) => m.id === p.menteeId)?.fullName }));
  const prog = pickProgram(programs, sp.p);
  if (!prog) return (<><h1>Cadência</h1><div className="card"><p className="empty">Nenhum programa ativo por aqui ainda.</p></div></>);

  const now = currentWeek();
  const week = sp.w && isIsoDate(sp.w) && mondayOf(sp.w) <= now ? mondayOf(sp.w) : now;
  const ym = week.slice(0, 7);
  const [data, month, history] = await Promise.all([getWeek(ctx, prog.id, week), monthSummary(ctx, prog.id, ym), listCheckins(ctx, prog.id, 8)]);
  const link = (w: string) => `/app/cadencia?${new URLSearchParams({ p: prog.id, w }).toString()}`;
  const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);
  const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const groups = [...new Set(month.rows.map((r) => r.grp))];

  return (
    <>
      <h1>Cadência</h1>
      <p className="sub">Check-in semanal (PDCA) e KPIs meta × realizado — {prog.menteeName} · {prog.name}</p>
      <ProgramPicker programs={programs} current={prog.id} base="/app/cadencia" extra={{ w: week }} />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Link href={link(addDays(week, -7))} className="btn sec">← Semana anterior</Link>
          <div style={{ textAlign: "center" }}>
            <b style={{ fontSize: 16 }}>Semana de {weekLabel(week)}</b>
            {week === now && <span className="badge" style={{ marginLeft: 8 }}>esta semana</span>}
          </div>
          {week < now ? <Link href={link(addDays(week, 7))} className="btn sec">Próxima semana →</Link> : <span className="btn sec" style={{ opacity: 0.4 }}>Próxima semana →</span>}
        </div>
        {week !== now && <p className="sub" style={{ margin: "10px 0 0", textAlign: "center" }}><Link href={link(now)}>Ir para esta semana</Link></p>}
      </div>

      <div className="card">
        <h2 className="h2">KPIs da semana</h2>
        {data.kpis.length === 0 ? (
          <p className="empty">Este programa não tem KPIs. {data.canConfigure ? "Abra o programa e use “Carregar padrões do template”." : "Peça à equipe para configurá-los."}</p>
        ) : (
          <KpiForm programId={prog.id} weekStart={week} kpis={data.kpis.map((k) => ({ key: k.key, label: k.label, grp: k.grp, weeklyTarget: k.weeklyTarget }))} actuals={data.actuals} disabled={false} />
        )}
      </div>

      <div className="card">
        <h2 className="h2">Check-in da semana</h2>
        <CheckinForm programId={prog.id} weekStart={week} checkin={data.checkin} disabled={false} />
      </div>

      <div className="card">
        <h2 className="h2">Resumo de {ym.slice(5)}/{ym.slice(0, 4)}</h2>
        <p className="sub">Meta = meta semanal × semanas já decorridas no mês ({month.weeks.length}). Verde ≥ 100% · amarelo ≥ 70% · vermelho abaixo.</p>
        {month.rows.length === 0 ? <p className="empty">Sem KPIs configurados.</p> : (
          <table>
            <thead><tr><th>KPI</th><th>Realizado</th><th>Meta</th><th>% da meta</th><th></th></tr></thead>
            <tbody>
              {groups.map((g) => [
                <tr key={`g${g}`} className="lvl"><td colSpan={5} style={{ background: "var(--idl-background-soft)", font: "700 10px 'JetBrains Mono', monospace", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--idl-purple)" }}>{g}</td></tr>,
                ...month.rows.filter((r) => r.grp === g).map((r) => (
                  <tr key={r.key}><td>{r.label}</td><td>{num(r.actual)}</td><td>{r.target == null ? "—" : num(r.target)}</td><td>{pct(r.pct)}</td><td><span className={`tl tl-${r.status}`}>{r.status === "sem-meta" ? "sem meta" : r.status}</span></td></tr>
                )),
              ])}
            </tbody>
          </table>
        )}
        <p className="sub" style={{ margin: "12px 0 0" }}>Conversão contatos → reuniões realizadas: <b>{month.conversion == null ? "— (sem contatos no mês)" : pct(month.conversion)}</b></p>
      </div>

      {history.length > 0 && (
        <div className="card">
          <h2 className="h2">Check-ins anteriores</h2>
          {history.map((c) => (
            <details key={c.id} style={{ borderBottom: "1px solid var(--idl-border)", padding: "8px 0" }}>
              <summary style={{ cursor: "pointer" }}><b>{weekLabel(c.weekStart)}</b> {c.traffic ? <span className={`tl tl-${c.traffic}`}>{TL[c.traffic]}</span> : null} <Link href={link(c.weekStart)} style={{ marginLeft: 8, fontSize: 12 }}>abrir semana</Link></summary>
              <div style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 14 }}>
                {c.plan && <p><b>P:</b> {c.plan}</p>}{c.done && <p><b>D:</b> {c.done}</p>}{c.result && <p><b>C:</b> {c.result}</p>}{c.adjust && <p><b>A:</b> {c.adjust}</p>}
                {c.objection && <p className="opt">Objeção: {c.objection}</p>}{c.blocker && <p className="opt">Travou: {c.blocker}</p>}{c.bestContent && <p className="opt">Conteúdo que engajou: {c.bestContent}</p>}
              </div>
            </details>
          ))}
        </div>
      )}

      {data.canConfigure && data.kpis.length > 0 && (
        <>
          <div className="card"><h2 className="h2">Metas semanais deste programa</h2><p className="sub">Editáveis por programa; o template não muda. Vazio = sem meta.</p><TargetsForm programId={prog.id} kpis={data.kpis.map((k) => ({ key: k.key, label: k.label, grp: k.grp, weeklyTarget: k.weeklyTarget }))} /></div>
          <div className="card"><h2 className="h2">Acrescentar KPI</h2><AddKpiForm programId={prog.id} /></div>
        </>
      )}
    </>
  );
}
