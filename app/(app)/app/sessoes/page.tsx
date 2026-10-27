import { listMentees } from "@/domains/mentees/service";
import { listPrograms } from "@/domains/programs/service";
import { listSessions, listTasks } from "@/domains/sessions/service";
import { todayBR } from "@/domains/offers/stage";
import { isStaff } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDay } from "@/lib/format";
import { NewSessionForm, NewTaskForm, TaskStatusButtons } from "./forms";

export default async function SessionsPage() {
  const user = await requireUser();
  const ctx = toContext(user);
  const staff = isStaff(ctx);
  const mentees = await listMentees(ctx);
  const [programs, sessions, tasks] = await Promise.all([listPrograms(ctx, mentees), listSessions(ctx), listTasks(ctx)]);
  const label = (p: { name: string; menteeId: string }) => `${p.name} — ${mentees.find((m) => m.id === p.menteeId)?.fullName ?? ""}`;
  const progOptions = programs.filter((p) => p.status !== "encerrado").map((p) => ({ id: p.id, label: label(p) }));
  const today = todayBR();
  const open = tasks.filter((t) => t.status === "aberta");
  const closed = tasks.filter((t) => t.status !== "aberta");
  const late = open.filter((t) => t.dueDate && t.dueDate < today).length;
  const mine = (t: { assignee: string }) => (staff ? true : t.assignee === "mentorado");
  return (
    <>
      <h1>Sessões e tarefas</h1>
      <p className="sub">Atas, decisões e o que ficou combinado entre uma sessão e outra.</p>
      <div className="grid">
        <div className="card kpi"><b>{open.length}</b><span>tarefas abertas</span></div>
        <div className="card kpi"><b style={late ? { color: "#B0003F" } : undefined}>{late}</b><span>atrasadas</span></div>
        <div className="card kpi"><b>{sessions.length}</b><span>sessões registradas</span></div>
      </div>

      <div className="card">
        <h2 className="h2">Tarefas abertas</h2>
        {open.length === 0 ? <p className="empty">Nenhuma tarefa aberta. 🎉</p> : open.map((t) => (
          <div key={t.id} className="task">
            <div className="t">
              <b>{t.title}</b>
              <div className="opt">
                {t.menteeName} · {t.programName} · {t.assignee === "mentor" ? "Mentor" : "Mentorado"}
                {t.dueDate ? <> · prazo {fmtDay(t.dueDate)}{t.dueDate < today && <span className="tl tl-vermelho" style={{ marginLeft: 6 }}>atrasada</span>}</> : null}
                {t.offerName ? ` · ${t.offerName}` : ""}
              </div>
            </div>
            {(staff || mine(t)) && <TaskStatusButtons taskId={t.id} status={t.status} canCancel={staff} />}
          </div>
        ))}
        {closed.length > 0 && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Concluídas e canceladas ({closed.length})</summary>
            {closed.map((t) => (
              <div key={t.id} className="task done">
                <div className="t"><b>{t.title}</b><div className="opt">{t.menteeName} · {t.status}{t.completedAt ? ` em ${fmtDay(t.completedAt.toISOString().slice(0, 10))}` : ""}</div></div>
                {(staff || mine(t)) && <TaskStatusButtons taskId={t.id} status={t.status} canCancel={staff} />}
              </div>
            ))}
          </details>
        )}
      </div>

      {staff && progOptions.length > 0 && (
        <div className="card">
          <h2 className="h2">Nova tarefa</h2>
          <NewTaskForm programs={progOptions} sessions={sessions.map((x) => ({ id: x.id, programId: x.programId, label: `${fmtDay(x.heldOn)} · ${x.title}` }))} />
        </div>
      )}

      <div className="card">
        <h2 className="h2">Sessões</h2>
        {sessions.length === 0 ? <p className="empty">Nenhuma sessão registrada ainda.</p> : sessions.map((x) => (
          <details key={x.id} style={{ borderBottom: "1px solid var(--idl-border)", padding: "10px 0" }}>
            <summary style={{ cursor: "pointer" }}><b>{fmtDay(x.heldOn)}</b> · {x.title} <span className="badge muted">{x.menteeName}</span></summary>
            <div style={{ marginTop: 10 }}>
              {x.summary && <p style={{ whiteSpace: "pre-wrap" }}><b>Ata:</b> {x.summary}</p>}
              {x.decisions && <p style={{ whiteSpace: "pre-wrap" }}><b>Decisões:</b> {x.decisions}</p>}
              {staff && x.internalNotes && <p style={{ whiteSpace: "pre-wrap", background: "var(--idl-background-soft)", padding: 10, borderRadius: 8 }}><b>🔒 Notas internas:</b> {x.internalNotes}</p>}
              {!x.summary && !x.decisions && <p className="empty">Sem ata registrada.</p>}
              {tasks.filter((t) => t.sessionId === x.id).length > 0 && (
                <p className="opt">Tarefas desta sessão: {tasks.filter((t) => t.sessionId === x.id).map((t) => `${t.status === "concluida" ? "✓" : t.status === "cancelada" ? "✕" : "○"} ${t.title}`).join(" · ")}</p>
              )}
            </div>
          </details>
        ))}
      </div>

      {staff && progOptions.length > 0 && (
        <div className="card">
          <h2 className="h2">Registrar sessão</h2>
          <NewSessionForm programs={progOptions} today={today} />
        </div>
      )}
    </>
  );
}
