import Link from "next/link";
import { listTickets, supportPanel } from "@/domains/support/service";
import { isStaff } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDateTimeFull } from "@/lib/format";
import { TICKET_AREAS, TICKET_KINDS, TICKET_STATUS, type TicketArea, type TicketStatus } from "@/lib/support";

const STATUSES = Object.keys(TICKET_STATUS) as TicketStatus[];

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const user = await requireUser();
  const ctx = toContext(user);
  const staff = isStaff(ctx);
  const filter = STATUSES.find((s) => s === status);
  const [tickets, panel] = await Promise.all([listTickets(ctx, { status: filter }), staff ? supportPanel(ctx) : Promise.resolve(null)]);
  const areaLabel = (a: string) => TICKET_AREAS[a as TicketArea]?.label ?? a;

  return (
    <>
      <h1>{staff ? "Chamados e dúvidas" : "Pedir ajuda"}</h1>
      <p className="sub">
        {staff ? "Pedidos de ajuda dos mentorados sobre as funcionalidades, com o painel das dúvidas mais frequentes e das soluções já registradas." : "Abra um chamado quando precisar de ajuda com alguma funcionalidade. A equipe responde por aqui."}
      </p>
      <div className="row" style={{ marginBottom: 16 }}>
        <Link href="/app/chamados/novo" className="btn">➕ Abrir chamado</Link>
      </div>

      {panel && (
        <>
          <div className="grid">
            <div className="card kpi"><b>{panel.byStatus.aberto}</b><span>abertos (aguardando a equipe)</span></div>
            <div className="card kpi"><b>{panel.byStatus.em_andamento}</b><span>em andamento</span></div>
            <div className="card kpi"><b>{panel.byStatus.resolvido}</b><span>resolvidos</span></div>
            <div className="card kpi"><b>{panel.avgHours === null ? "—" : `${panel.avgHours} h`}</b><span>tempo médio até resolver</span></div>
          </div>

          <div className="card">
            <h2 className="h2">Onde estão as dúvidas</h2>
            {panel.areas.length === 0 ? (
              <p className="empty">Nenhum chamado ainda.</p>
            ) : (
              <table>
                <thead><tr><th>Funcionalidade</th><th>Chamados</th><th>Ainda abertos</th></tr></thead>
                <tbody>
                  {panel.areas.map((a) => (
                    <tr key={a.area}>
                      <td>{areaLabel(a.area)}</td>
                      <td>
                        <span className="bar-cell"><span className="bar-fill" style={{ width: `${Math.round((a.total / panel.areas[0].total) * 100)}%` }} /></span> {a.total}
                      </td>
                      <td>{a.abertos ? <span className="badge">{a.abertos}</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <Link href="/app/chamados" className={`btn ${filter ? "sec" : ""}`}>Todos</Link>
          {STATUSES.map((s) => (
            <Link key={s} href={`/app/chamados?status=${s}`} className={`btn ${filter === s ? "" : "sec"}`}>{TICKET_STATUS[s]}</Link>
          ))}
        </div>
        {tickets.length === 0 ? (
          <p className="empty">Nenhum chamado{filter ? ` ${TICKET_STATUS[filter].toLowerCase()}` : ""}.</p>
        ) : (
          <table>
            <thead><tr><th>#</th><th>Assunto</th>{staff && <th>Mentorado</th>}<th>Funcionalidade</th><th>Situação</th><th>Aberto em</th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>{t.number}</td>
                  <td><Link href={`/app/chamados/${t.id}`}>{t.title}</Link><br /><span className="sub">{TICKET_KINDS[t.kind]}{t.assigneeName ? ` · ${t.assigneeName}` : ""}</span></td>
                  {staff && <td>{t.menteeName}</td>}
                  <td>{areaLabel(t.area)}</td>
                  <td><span className={`badge${t.status === "resolvido" ? " muted" : ""}`}>{TICKET_STATUS[t.status]}</span></td>
                  <td>{fmtDateTimeFull(t.createdAt.toISOString())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {panel && panel.solutions.length > 0 && (
        <div className="card">
          <h2 className="h2">Soluções registradas</h2>
          <p className="sub">Respostas já dadas — consulte antes de responder uma dúvida repetida.</p>
          {panel.solutions.slice(0, 30).map((t) => (
            <details key={t.id} style={{ marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>{t.title} <span className="badge muted">{areaLabel(t.area)}</span></summary>
              <p style={{ whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{t.solution}</p>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
