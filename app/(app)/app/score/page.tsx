import type { Metadata } from "next";
import { listMentees } from "@/domains/mentees/service";
import { listPrograms } from "@/domains/programs/service";
import { SCORE_HELP, SCORE_KEYS } from "@/domains/score/compute";
import { getScore, listSnapshots } from "@/domains/score/service";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtNum } from "@/lib/format";
import { weekLabel } from "@/lib/week";
import { ProgramPicker, pickProgram } from "@/components/ProgramPicker";
import { SnapshotButton, WeightsForm } from "./forms";


export const metadata: Metadata = { title: "Score de Alavancagem" };

export default async function ScorePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = toContext(user);
  const mentees = await listMentees(ctx);
  const programs = (await listPrograms(ctx, mentees)).filter((p) => p.status !== "encerrado").map((p) => ({ ...p, menteeName: mentees.find((m) => m.id === p.menteeId)?.fullName }));
  const prog = pickProgram(programs, sp.p);
  if (!prog) return (<><h1>Score de Alavancagem</h1><div className="card"><p className="empty">Nenhum programa ativo por aqui ainda.</p></div></>);
  const [score, snaps] = await Promise.all([getScore(ctx, prog.id), listSnapshots(ctx, prog.id, 12)]);
  const labels = Object.fromEntries(score.components.map((c) => [c.key, c.label]));
  return (
    <>
      <h1>Score de Alavancagem</h1>
      <p className="sub">Quanto o negócio está preparado para alavancar: mais informação registrada e mais ferramentas estratégicas usadas elevam o score. É um índice de <b>prontidão</b>, não uma previsão de receita.</p>
      <ProgramPicker programs={programs} current={prog.id} base="/app/score" />

      <div className="card">
        <div className="row" style={{ alignItems: "center", gap: 24 }}>
          <div className="score-big">{fmtNum(score.total)}<small> / 100</small></div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="bar" style={{ height: 14 }}><i style={{ width: `${score.total}%` }} /></div>
            <p className="sub" style={{ margin: "8px 0 0" }}>{prog.menteeName} · {prog.name}</p>
          </div>
        </div>
      </div>

      {score.steps.length > 0 && (
        <div className="card">
          <h2 className="h2">Próximo melhor passo</h2>
          <p className="sub">Onde há mais pontos a ganhar agora.</p>
          {score.steps.map((s) => (
            <p key={s.key} style={{ margin: "8px 0" }}><b>{s.label}:</b> {s.text} <span className="badge">até +{fmtNum(s.upTo)} pts</span></p>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="h2">Composição</h2>
        <p className="sub">O score soma {score.components.length} componentes. Cada um vale um número máximo de pontos (o “peso”); quanto mais completo, mais pontos.</p>
        <div className="score-comps">
          {score.components.map((c) => (
            <section key={c.key} className="score-comp" aria-label={c.label}>
              <div className="score-comp-head">
                <h3>{c.label}</h3>
                <span className="score-comp-pts">{fmtNum(c.points)} <small>/ {c.weight} pts</small></span>
              </div>
              <p className="score-comp-help">{SCORE_HELP[c.key]}</p>
              <div className="bar" role="img" aria-label={`${Math.round(c.ratio * 100)}% preenchido`}><i style={{ width: `${Math.round(c.ratio * 100)}%` }} /></div>
              <div className="score-comp-miss">
                {c.hints.length === 0 ? <span className="tl tl-verde">completo</span> : (
                  <>
                    <b>O que falta:</b>
                    <ul>{c.hints.slice(0, 3).map((h) => <li key={h}>{h}</li>)}</ul>
                  </>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="h2">Evolução</h2>
        {snaps.length === 0 ? <p className="empty">Ainda sem histórico. O retrato da semana é gravado ao salvar o check-in, ou pelo botão abaixo.</p> : (
          <table>
            <thead><tr><th>Semana</th><th>Score</th><th style={{ width: 240 }}></th></tr></thead>
            <tbody>{snaps.map((s) => <tr key={s.id}><td>{weekLabel(s.weekStart)}</td><td>{fmtNum(s.total)}</td><td><div className="bar"><i style={{ width: `${s.total}%` }} /></div></td></tr>)}</tbody>
          </table>
        )}
        <div style={{ marginTop: 12 }}><SnapshotButton programId={prog.id} /></div>
      </div>

      {score.canEdit && (
        <div className="card">
          <h2 className="h2">Pesos deste programa</h2>
          <p className="sub">Hipóteses iniciais, a calibrar com os pilotos. Os valores são normalizados para somar 100; o template não muda.</p>
          <WeightsForm programId={prog.id} weights={score.weights} labels={Object.fromEntries(SCORE_KEYS.map((k) => [k, labels[k]]))} />
        </div>
      )}
    </>
  );
}
