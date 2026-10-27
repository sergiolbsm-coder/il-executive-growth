import { listMentees } from "@/domains/mentees/service";
import { listPrograms } from "@/domains/programs/service";
import { SCORE_HELP, SCORE_KEYS } from "@/domains/score/compute";
import { getScore, listSnapshots } from "@/domains/score/service";
import { requireUser, toContext } from "@/lib/auth/session";
import { weekLabel } from "@/lib/week";
import { ProgramPicker, pickProgram } from "@/components/ProgramPicker";
import { SnapshotButton, WeightsForm } from "./forms";

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
          <div className="score-big">{score.total.toFixed(1)}<small> / 100</small></div>
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
            <p key={s.key} style={{ margin: "8px 0" }}><b>{s.label}:</b> {s.text} <span className="badge">até +{s.upTo.toFixed(1)} pts</span></p>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="h2">Composição</h2>
        <table>
          <thead><tr><th>Componente</th><th style={{ width: 220 }}>Preenchimento</th><th>Pontos</th><th>O que falta</th></tr></thead>
          <tbody>
            {score.components.map((c) => (
              <tr key={c.key}>
                <td><b>{c.label}</b><br /><span className="opt" style={{ fontSize: 11 }}>{SCORE_HELP[c.key]}</span></td>
                <td><div className="bar"><i style={{ width: `${Math.round(c.ratio * 100)}%` }} /></div><span className="opt">{Math.round(c.ratio * 100)}%</span></td>
                <td>{c.points.toFixed(1)} / {c.weight}</td>
                <td>{c.hints.length === 0 ? <span className="tl tl-verde">completo</span> : <ul style={{ margin: 0, paddingLeft: 18 }}>{c.hints.slice(0, 3).map((h) => <li key={h} style={{ fontSize: 13 }}>{h}</li>)}</ul>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="h2">Evolução</h2>
        {snaps.length === 0 ? <p className="empty">Ainda sem histórico. O retrato da semana é gravado ao salvar o check-in, ou pelo botão abaixo.</p> : (
          <table>
            <thead><tr><th>Semana</th><th>Score</th><th style={{ width: 240 }}></th></tr></thead>
            <tbody>{snaps.map((s) => <tr key={s.id}><td>{weekLabel(s.weekStart)}</td><td>{s.total.toFixed(1)}</td><td><div className="bar"><i style={{ width: `${s.total}%` }} /></div></td></tr>)}</tbody>
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
