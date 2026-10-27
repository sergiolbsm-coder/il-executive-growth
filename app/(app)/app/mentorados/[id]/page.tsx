import Link from "next/link";
import { notFound } from "next/navigation";
import { getMentee, listMentors } from "@/domains/mentees/service";
import { listTemplates } from "@/domains/templates/service";
import { ForbiddenError, canCreateMentee } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDay } from "@/lib/format";
import { AssignMentorsForm, NewProgramForm } from "../forms";

export default async function MenteePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ctx = toContext(user);
  let data;
  try {
    data = await getMentee(ctx, id);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  const { mentee, mentors, programs } = data;
  const manage = canCreateMentee(ctx);
  const [allMentors, allTemplates] = await Promise.all([manage ? listMentors(ctx) : Promise.resolve([]), manage ? listTemplates(ctx) : Promise.resolve([])]);
  const templates = allTemplates.filter((t) => t.active);
  return (
    <>
      <p className="sub"><Link href="/app/mentorados">← Mentorados</Link></p>
      <h1>{mentee.fullName}</h1>
      <p className="sub">
        {mentee.segment ?? "Segmento não informado"} · {mentee.userId ? "com acesso ao sistema" : "pré-cadastro (sem acesso)"}
        {user.role !== "mentorado" && <> · Mentores: {mentors.length ? mentors.map((m) => m.name).join(", ") : "nenhum"}</>}
      </p>

      <div className="card">
        <h2 className="h2">Programas</h2>
        {programs.length === 0 ? (
          <p className="empty">Nenhum programa aberto.</p>
        ) : (
          <table>
            <thead><tr><th>Programa</th><th>Modelo</th><th>Início</th><th>Término</th><th>Situação</th></tr></thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/app/programas/${p.id}`}>{p.name}</Link></td>
                  <td>{p.model ?? "—"}</td>
                  <td>{fmtDay(p.startDate)}</td>
                  <td>{fmtDay(p.endDate)}</td>
                  <td><span className={`badge${p.status === "ativo" ? "" : " muted"}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {manage && (
        <>
          <div className="card">
            <h2 className="h2">Mentores atribuídos</h2>
            <AssignMentorsForm menteeId={mentee.id} mentors={allMentors} selected={mentee.mentorIds} />
          </div>
          {templates.length > 0 && <NewProgramForm menteeId={mentee.id} templates={templates} />}
        </>
      )}
    </>
  );
}
