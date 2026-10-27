import Link from "next/link";
import { redirect } from "next/navigation";
import { listMentees, listMentors } from "@/domains/mentees/service";
import { listPrograms } from "@/domains/programs/service";
import { canCreateMentee } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { NewMenteeForm } from "./forms";

export default async function MenteesPage() {
  const user = await requireUser();
  const ctx = toContext(user);
  const mentees = await listMentees(ctx);
  if (user.role === "mentorado" && mentees.length === 1) redirect(`/app/mentorados/${mentees[0].id}`);
  const [programs, mentors] = await Promise.all([listPrograms(ctx, mentees), canCreateMentee(ctx) ? listMentors(ctx) : Promise.resolve([])]);
  return (
    <>
      <h1>{user.role === "mentorado" ? "Meu plano" : "Mentorados"}</h1>
      <p className="sub">Carteira de mentorias e seus programas.</p>
      <div className="card">
        {mentees.length === 0 ? (
          <p className="empty">Nenhum mentorado por aqui ainda.</p>
        ) : (
          <table>
            <thead><tr><th>Nome</th><th>Segmento</th><th>Programas</th><th>Mentores</th><th>Acesso</th></tr></thead>
            <tbody>
              {mentees.map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/app/mentorados/${m.id}`}>{m.fullName}</Link></td>
                  <td>{m.segment ?? "—"}</td>
                  <td>{programs.filter((p) => p.menteeId === m.id).length}</td>
                  <td>{m.mentorIds.length}</td>
                  <td>{m.userId ? <span className="badge">com acesso</span> : <span className="badge muted">pré-cadastro</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {canCreateMentee(ctx) && <NewMenteeForm mentors={mentors} />}
    </>
  );
}
