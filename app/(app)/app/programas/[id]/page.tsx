import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgram } from "@/domains/programs/service";
import { ForbiddenError } from "@/lib/authorization";
import { ValidationError } from "@/lib/errors";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDay } from "@/lib/format";
import { ProgramForm } from "./form";

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  let data;
  try {
    data = await getProgram(toContext(user), id);
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
      <p className="sub">
        {program.model ?? "sem modelo"} · {fmtDay(program.startDate)} → {fmtDay(program.endDate)} · {program.weeklyHours ?? "—"} h/semana ·
        snapshot do template v{program.templateVersion ?? "—"} · <span className={`badge${program.status === "ativo" ? "" : " muted"}`}>{program.status}</span>
      </p>

      <div className="card">
        <h2 className="h2">Propósito</h2>
        <p style={{ fontSize: 18, margin: 0 }}>{program.purpose ?? <span className="empty">Ainda não definido.</span>}</p>
      </div>

      <div className="card">
        <h2 className="h2">Escala do Negócio</h2>
        <p className="sub">Do topo (menor volume, maior ticket) à base (maior volume, menor ticket). Ofertas entram nos próximos módulos.</p>
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
          <h2 className="h2">Editar programa</h2>
          <ProgramForm
            programId={program.id}
            initial={{ name: program.name, purpose: program.purpose, weeklyHours: program.weeklyHours, startDate: program.startDate, endDate: program.endDate, status: program.status }}
          />
        </div>
      )}
    </>
  );
}
