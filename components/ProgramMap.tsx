import Link from "next/link";
import type { OfferView } from "@/domains/offers/service";
import { STAGES } from "@/lib/stages";

type Source = { id: string; slug: string; name: string; level: number; isMotor: boolean };
type Level = { level: number; name: string };

const SHORT = ["Ideia", "Protótipo", "Pronta", "Prospecção", "1ª venda", "Validada", "Escala"];

/** Medidores da meta: estruturadas (≥ Oferta pronta), validadas (≥ Validada), em escala e receitas cobertas. */
export function Meters({ sources, offers }: { sources: Source[]; offers: OfferView[] }) {
  const active = offers.filter((o) => o.status === "ativa");
  const covered = new Set(active.map((o) => o.revenueSlug)).size;
  const m = [
    { n: active.length, l: "ofertas ativas" },
    { n: active.filter((o) => o.stage >= 3).length, l: "estruturadas (≥ Oferta pronta)" },
    { n: active.filter((o) => o.stage >= 6).length, l: "validadas (≥ Validada)" },
    { n: active.filter((o) => o.stage >= 7).length, l: "em escala" },
    { n: `${covered}/${sources.length}`, l: "receitas com oferta" },
  ];
  return (
    <div className="meters">
      {m.map((x) => (
        <div key={x.l} className="meter"><b>{x.n}</b><span>{x.l}</span></div>
      ))}
    </div>
  );
}

/** Mapa das receitas (linhas, agrupadas por nível da Escala) × 7 estágios (colunas): onde está cada oferta. */
export function ProgramMap({ sources, levels, offers }: { sources: Source[]; levels: Level[]; offers: OfferView[] }) {
  const order = [...levels].sort((a, b) => b.level - a.level);
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="map">
        <thead>
          <tr>
            <th className="l">Receita</th>
            {STAGES.map((s, i) => <th key={s.n} title={`${s.n}. ${s.name} — ${s.phase}`}>{SHORT[i].toUpperCase()}</th>)}
          </tr>
        </thead>
        <tbody>
          {order.map((lv) => {
            const here = sources.filter((s) => s.level === lv.level);
            if (!here.length) return null;
            return [
              <tr key={`l${lv.level}`} className="lvl"><td colSpan={8}>Nível {lv.level} · {lv.name}</td></tr>,
              ...here.map((s) => {
                const mine = offers.filter((o) => o.revenueSlug === s.slug);
                return (
                  <tr key={s.id}>
                    <td className="l">{s.name}{s.isMotor ? " ★" : ""}</td>
                    {STAGES.map((st) => (
                      <td key={st.n} className="cell">
                        {mine.filter((o) => o.stage === st.n).map((o) => (
                          <Link key={o.id} href={`/app/ofertas/${o.id}`} className={`oc${o.status !== "ativa" ? " paused" : ""}${o.schedule === "atrasada" && o.status === "ativa" ? " late" : ""}`} title={o.status !== "ativa" ? `${o.status}: ${o.statusReason ?? ""}` : o.name}>
                            {o.name}
                          </Link>
                        ))}
                        {st.n === 1 && mine.length === 0 && <span className="opt" style={{ color: "var(--idl-text-muted)", fontSize: 10 }}>sem oferta</span>}
                      </td>
                    ))}
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
