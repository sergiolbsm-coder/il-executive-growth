import Link from "next/link";
import { listMentees } from "@/domains/mentees/service";
import { listPrograms } from "@/domains/programs/service";
import { requireUser, toContext } from "@/lib/auth/session";
import { NAV } from "@/lib/nav";

export default async function DashboardPage() {
  const user = await requireUser();
  const ctx = toContext(user);
  const mentees = await listMentees(ctx);
  const programs = await listPrograms(ctx, mentees);
  const active = programs.filter((p) => p.status === "ativo");
  const staff = user.role !== "mentorado";
  const soon = NAV.filter((i) => i.status === "soon" && i.roles.includes(user.role));
  return (
    <>
      <h1>Olá, {user.name.split(" ")[0]}</h1>
      <p className="sub">IL Executive Growth — acompanhamento de mentoria e lançamento de ofertas.</p>
      <div className="grid">
        <div className="card kpi"><b>{mentees.length}</b><span>{staff ? "mentorados na sua carteira" : "seu cadastro"}</span></div>
        <div className="card kpi"><b>{active.length}</b><span>programas ativos</span></div>
        <div className="card kpi"><b>{programs.length}</b><span>programas no total</span></div>
      </div>
      {staff ? (
        <div className="card">
          <h2 className="h2">Comece por aqui</h2>
          <p className="empty">Cadastre um mentorado, abra um programa a partir de um template e ajuste a Escala do Negócio.</p>
          <div className="row"><Link href="/app/mentorados" className="btn sec">Ver mentorados</Link></div>
        </div>
      ) : (
        <div className="card">
          <h2 className="h2">Seu plano</h2>
          <div className="row"><Link href="/app/mentorados" className="btn sec">Abrir meu plano</Link></div>
        </div>
      )}
      <div className="card">
        <h2 className="h2">Próximos módulos</h2>
        <p className="empty">{soon.map((i) => i.label).join(" · ")}</p>
      </div>
    </>
  );
}
