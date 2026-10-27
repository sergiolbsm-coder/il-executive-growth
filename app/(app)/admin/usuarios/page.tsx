import { notFound } from "next/navigation";
import { listUsers } from "@/domains/users/service";
import { canManageUsers } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDateTimeFull } from "@/lib/format";
import { NewUserForm, RowActions } from "./form";

const ROLE_LABEL: Record<string, string> = { admin: "Administração", direcao: "Direção", mentor: "Mentor", mentorado: "Mentorado" };

export default async function UsersPage() {
  const user = await requireUser();
  if (!canManageUsers(toContext(user))) notFound();
  const users = await listUsers(toContext(user));
  return (
    <>
      <h1>Usuários</h1>
      <p className="sub">Liberação de acesso, redefinição de senha e ativação.</p>
      <div className="card">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Último login</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td><span className="badge">{ROLE_LABEL[u.role] ?? u.role}</span></td>
                <td>{u.active ? (u.mustChangePassword ? "aguarda 1º acesso" : "ativo") : <span className="badge muted">inativo</span>}</td>
                <td>{u.lastLoginAt ? fmtDateTimeFull(u.lastLoginAt.toISOString()) : "—"}</td>
                <td><RowActions id={u.id} active={u.active} self={u.id === user.id} role={u.role} scope={u.mentorScope} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NewUserForm />
    </>
  );
}
