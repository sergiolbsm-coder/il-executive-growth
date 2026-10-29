import Link from "next/link";
import { listMentees } from "@/domains/mentees/service";
import { isStaff } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { areaFromPath } from "@/lib/support";
import { NewTicketForm } from "../forms";

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const user = await requireUser();
  const ctx = toContext(user);
  const mentees = isStaff(ctx) ? (await listMentees(ctx)).map((m) => ({ id: m.id, name: m.fullName })) : [];
  const path = from && /^\/[\w\-/[\]?=&.]*$/.test(from) ? from : "";
  return (
    <>
      <p className="sub"><Link href="/app/chamados">← Chamados</Link></p>
      <h1>Abrir chamado</h1>
      <p className="sub">Conte qual funcionalidade e o que você precisa. Quanto mais específico, mais rápida a resposta.</p>
      <NewTicketForm mentees={mentees} defaultArea={areaFromPath(path)} pagePath={path} />
    </>
  );
}
