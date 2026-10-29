import Link from "next/link";
import { notFound } from "next/navigation";
import { getTicket } from "@/domains/support/service";
import { ForbiddenError, isStaff } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDateTimeFull } from "@/lib/format";
import { TICKET_AREAS, TICKET_KINDS, TICKET_STATUS, type TicketArea } from "@/lib/support";
import { ReplyForm, ResolveForm, TicketButtons } from "../forms";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ctx = toContext(user);
  let data;
  try {
    data = await getTicket(ctx, id);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  const { ticket: t, menteeName, assigneeName, messages } = data;
  const staff = isStaff(ctx);
  return (
    <>
      <p className="sub"><Link href="/app/chamados">← Chamados</Link></p>
      <h1>#{t.number} · {t.title}</h1>
      <p className="sub">
        {TICKET_KINDS[t.kind]} · {TICKET_AREAS[t.area as TicketArea]?.label ?? t.area} · <span className={`badge${t.status === "resolvido" ? " muted" : ""}`}>{TICKET_STATUS[t.status]}</span>
        {staff && <> · {menteeName}</>}
        {assigneeName && <> · atendido por {assigneeName}</>} · aberto em {fmtDateTimeFull(t.createdAt.toISOString())}
        {staff && t.pagePath && <> · tela: <Link href={t.pagePath}>{t.pagePath}</Link></>}
      </p>

      <div className="card">
        {t.description ? <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{t.description}</p> : <p className="empty">Sem detalhes.</p>}
      </div>

      {t.solution && (
        <div className="card">
          <h2 className="h2">✅ Solução</h2>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{t.solution}</p>
        </div>
      )}

      <div className="card">
        <h2 className="h2">Conversa</h2>
        {messages.length === 0 && <p className="empty">Nenhuma mensagem ainda.</p>}
        {messages.map((m) => (
          <div key={m.id} className="msg-bubble" style={m.internal ? { background: "rgba(255,200,0,.14)" } : undefined}>
            <b>{m.authorName ?? "—"}</b> <span className="sub">{fmtDateTimeFull(m.createdAt.toISOString())}{m.internal ? " · nota interna" : ""}</span>
            <p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{m.body}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <TicketButtons ticketId={t.id} status={t.status} staff={staff} />
      </div>
      {t.status !== "resolvido" && (
        <div className="card"><ReplyForm ticketId={t.id} staff={staff} /></div>
      )}
      {staff && t.status !== "resolvido" && (
        <div className="card"><h2 className="h2">Resolver</h2><ResolveForm ticketId={t.id} /></div>
      )}
    </>
  );
}
