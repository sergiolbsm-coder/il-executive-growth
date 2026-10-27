import Link from "next/link";
import { listSalesForActor } from "@/domains/offers/service";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtBRL, fmtDay } from "@/lib/format";

type Row = Awaited<ReturnType<typeof listSalesForActor>>[number];

function group<T extends string>(rows: Row[], key: (r: Row) => T) {
  const m = new Map<T, { n: number; cents: number }>();
  for (const r of rows) {
    const k = key(r);
    const v = m.get(k) ?? { n: 0, cents: 0 };
    v.n += 1;
    v.cents += r.valueCents;
    m.set(k, v);
  }
  return [...m.entries()].sort((a, b) => b[1].cents - a[1].cents);
}

export default async function CommercialPage() {
  const user = await requireUser();
  const rows = await listSalesForActor(toContext(user));
  const total = rows.reduce((a, r) => a + r.valueCents, 0);
  const clients = new Set(rows.map((r) => `${r.programId}:${r.clientName.trim().toLowerCase()}`)).size;
  const byMonth = group(rows, (r) => r.soldAt.slice(0, 7)).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const byChannel = group(rows, (r) => r.channel?.trim() || "(sem canal)");
  const byOffer = group(rows, (r) => `${r.offerId}|${r.offerName}`);
  // "Puxa →": oferta que originou o lead → oferta vendida
  const pulls = group(rows.filter((r) => r.originOfferId), (r) => `${r.originName} → ${r.offerName}`);
  const monthLabel = (ym: string) => `${ym.slice(5)}/${ym.slice(0, 4)}`;
  return (
    <>
      <h1>Comercial</h1>
      <p className="sub">Vendas registradas nas ofertas: receita, canais e quais ofertas puxam as outras.</p>
      <div className="grid">
        <div className="card kpi"><b>{fmtBRL(total)}</b><span>receita realizada</span></div>
        <div className="card kpi"><b>{rows.length}</b><span>vendas</span></div>
        <div className="card kpi"><b>{clients}</b><span>clientes</span></div>
        <div className="card kpi"><b>{rows.length ? fmtBRL(Math.round(total / rows.length)) : "—"}</b><span>ticket médio</span></div>
      </div>

      {rows.length === 0 ? (
        <div className="card"><p className="empty">Nenhuma venda registrada ainda. As vendas são lançadas na página de cada oferta.</p></div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <div className="card">
              <h2 className="h2">Por mês</h2>
              <table><thead><tr><th>Mês</th><th>Vendas</th><th>Receita</th></tr></thead>
                <tbody>{byMonth.map(([k, v]) => <tr key={k}><td>{monthLabel(k)}</td><td>{v.n}</td><td>{fmtBRL(v.cents)}</td></tr>)}</tbody></table>
            </div>
            <div className="card">
              <h2 className="h2">Por canal</h2>
              <table><thead><tr><th>Canal</th><th>Vendas</th><th>Receita</th></tr></thead>
                <tbody>{byChannel.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.n}</td><td>{fmtBRL(v.cents)}</td></tr>)}</tbody></table>
            </div>
            <div className="card">
              <h2 className="h2">Por oferta</h2>
              <table><thead><tr><th>Oferta</th><th>Vendas</th><th>Receita</th></tr></thead>
                <tbody>{byOffer.map(([k, v]) => { const [id, name] = k.split("|"); return <tr key={k}><td><Link href={`/app/ofertas/${id}`}>{name}</Link></td><td>{v.n}</td><td>{fmtBRL(v.cents)}</td></tr>; })}</tbody></table>
            </div>
          </div>

          <div className="card">
            <h2 className="h2">Quem puxa quem</h2>
            <p className="sub">Oferta que originou o lead → oferta vendida (o encadeamento palestra → diagnóstico → projeto → advisory, na prática).</p>
            {pulls.length === 0 ? (
              <p className="empty">Nenhuma venda com origem informada. Ao registrar uma venda, indique a oferta que originou o lead.</p>
            ) : (
              <table><thead><tr><th>Origem → Venda</th><th>Vendas</th><th>Receita</th></tr></thead>
                <tbody>{pulls.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.n}</td><td>{fmtBRL(v.cents)}</td></tr>)}</tbody></table>
            )}
          </div>

          <div className="card">
            <h2 className="h2">Todas as vendas</h2>
            <table>
              <thead><tr><th>Data</th><th>Cliente</th><th>Oferta</th><th>Programa</th><th>Valor</th><th>Canal</th><th>Origem</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDay(r.soldAt)}</td><td>{r.clientName}</td>
                    <td><Link href={`/app/ofertas/${r.offerId}`}>{r.offerName}</Link></td>
                    <td>{r.programName}<br /><span className="opt">{r.menteeName}</span></td>
                    <td>{fmtBRL(r.valueCents)}</td><td>{r.channel ?? "—"}</td><td>{r.originName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
