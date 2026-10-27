import Link from "next/link";
import { notFound } from "next/navigation";
import { listPendingGates } from "@/domains/offers/service";
import { isStaff } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";
import { ConfirmButtons } from "./confirm";

export default async function PendingGatesPage() {
  const user = await requireUser();
  const ctx = toContext(user);
  if (!isStaff(ctx)) notFound();
  const rows = await listPendingGates(ctx);
  return (
    <>
      <h1>Portões a confirmar</h1>
      <p className="sub">Itens que o mentorado marcou com evidência. Só contam para o estágio da oferta depois da sua confirmação.</p>
      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">Nada aguardando confirmação. 🎉</p>
        ) : (
          <table>
            <thead><tr><th>Mentorado</th><th>Oferta</th><th>Item</th><th>Evidência</th><th>Marcado</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.offerId}:${r.gateKey}`}>
                  <td>{r.menteeName}</td>
                  <td><Link href={`/app/ofertas/${r.offerId}`}>{r.offerName}</Link>{r.offerStatus !== "ativa" && <> <span className="badge muted">{r.offerStatus}</span></>}</td>
                  <td>{r.gateLabel}</td>
                  <td style={{ maxWidth: 320, wordBreak: "break-word" }}>{r.evidence}</td>
                  <td>{fmtDateTime(r.checkedAt.toISOString())}{r.checkedByName ? <><br /><span className="opt">{r.checkedByName}</span></> : null}</td>
                  <td><ConfirmButtons offerId={r.offerId} gateKey={r.gateKey} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
