import Link from "next/link";
import { listMentees } from "@/domains/mentees/service";
import { listOffers, salesByLevel } from "@/domains/offers/service";
import { getProgram, listPrograms } from "@/domains/programs/service";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtBRL } from "@/lib/format";

// Cores do topo (nível 5) à base (nível 1) e larguras que desenham a pirâmide.
const COLOR: Record<number, string> = { 5: "#261062", 4: "#391694", 3: "#4D1DBF", 2: "#7A4FE0", 1: "#00A9A3" };
const WIDTH: Record<number, number> = { 5: 38, 4: 52, 3: 66, 2: 80, 1: 94 };

export default async function ScalePage() {
  const user = await requireUser();
  const ctx = toContext(user);
  const mentees = await listMentees(ctx);
  const programs = (await listPrograms(ctx, mentees)).filter((p) => p.status !== "encerrado");
  const data = await Promise.all(
    programs.map(async (p) => {
      const [g, offers, sold] = await Promise.all([getProgram(ctx, p.id), listOffers(ctx, p.id), salesByLevel(ctx, p.id)]);
      return { p, g, offers: offers.filter((o) => o.status === "ativa"), sold };
    }),
  );
  return (
    <>
      <h1>Escala do Negócio</h1>
      <p className="sub">A pirâmide do modelo de negócio: base com volume e autoridade, topo com poucos clientes e ticket alto. Cada nível mostra as ofertas ativas e a receita já realizada.</p>
      {data.length === 0 && <div className="card"><p className="empty">Nenhum programa ativo por aqui ainda.</p></div>}
      {data.map(({ p, g, offers, sold }) => {
        const byLevel = (n: number) => offers.filter((o) => o.level === n);
        const base = byLevel(1).length + byLevel(2).length;
        const top = byLevel(3).length + byLevel(4).length + byLevel(5).length;
        const total = [...sold.values()].reduce((a, v) => a + v.cents, 0);
        const thin = offers.length >= 3 && base < top;
        return (
          <div key={p.id} className="card">
            <h2 className="h2"><Link href={`/app/programas/${p.id}`}>{p.name}</Link> <span className="badge muted">{g.mentee.fullName}</span></h2>
            <div className="card" style={{ background: "var(--idl-background-soft)", marginBottom: 14 }}>
              <span className="opt">PROPÓSITO</span>
              <p style={{ margin: "4px 0 0", fontSize: 16 }}>{p.purpose ?? <span className="empty">Defina o propósito na página do programa.</span>}</p>
            </div>
            <div className="pyr">
              {[5, 4, 3, 2, 1].map((n) => {
                const lv = g.levels.find((l) => l.level === n);
                const mine = byLevel(n);
                const sv = sold.get(n);
                return (
                  <div key={n} className="pyr-row" style={{ width: `${WIDTH[n]}%`, background: COLOR[n] }}>
                    <b>{n} · {lv?.name ?? `Nível ${n}`}</b>
                    <span>{mine.length} oferta(s) ativa(s){sv && sv.cents > 0 ? ` · ${fmtBRL(sv.cents)} realizados` : ""}</span>
                  </div>
                );
              })}
            </div>
            {thin && <div className="msg err">Base fina: {base} oferta(s) de volume (níveis 1–2) para {top} de ticket alto (níveis 3–5). Falta alcance para sustentar o topo.</div>}
            <p className="sub" style={{ margin: "12px 0" }}>Receita realizada no programa: <b>{fmtBRL(total)}</b></p>
            <table>
              <thead><tr><th>Nível</th><th>Volume</th><th>Ticket</th><th>Esforço</th><th>Papel</th><th>Ofertas</th><th>Vendas</th></tr></thead>
              <tbody>
                {[5, 4, 3, 2, 1].map((n) => {
                  const lv = g.levels.find((l) => l.level === n);
                  const sv = sold.get(n);
                  return (
                    <tr key={n}>
                      <td><b>{n}</b> · {lv?.name}</td><td>{lv?.volume}</td><td>{lv?.ticket}</td><td>{lv?.effort}</td><td>{lv?.role}</td>
                      <td>{byLevel(n).map((o) => <Link key={o.id} href={`/app/ofertas/${o.id}`} className="badge muted" style={{ marginRight: 4 }}>{o.name}</Link>)}{byLevel(n).length === 0 && "—"}</td>
                      <td>{sv ? `${sv.sales} · ${fmtBRL(sv.cents)}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
