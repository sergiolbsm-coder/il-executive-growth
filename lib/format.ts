// Utilitários de apresentação compartilhados entre componentes de servidor e de cliente.
export interface AuthorshipView { byName: string | null; byRole: string | null; at: string }

const ROLE_LABEL: Record<string, string> = {
  consultora: "Jobhunter", admin: "Administração", direcao: "Direção", assessorado: "Assessorado",
};

export const fmtAuthorship = (a?: AuthorshipView) =>
  a
    ? `${a.byName ?? "usuário removido"}${a.byRole ? ` (${ROLE_LABEL[a.byRole] ?? a.byRole})` : ""} · ${new Date(a.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
    : "";

/** "2026-10-09" → "09/10/2026" (sem fuso: é uma data de calendário). */
export const fmtDay = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
export const fmtDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
/** Data e hora completas (com segundos) em Brasília. */
export const fmtDateTimeFull = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
/** Horas → "5,5 h" ou "2,3 dias". */
export function fmtHours(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return "menos de 1 h";
  if (h < 48) return `${h.toFixed(1).replace(".", ",")} h`;
  return `${(h / 24).toFixed(1).replace(".", ",")} dias`;
}

/** Centavos → "R$ 2.500,00". */
export const fmtBRL = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Texto digitado pelo usuário → centavos. Aceita "2500", "2.500,00", "2500,5", "R$ 2.500", "2500.50".
 * Devolve null se não for um valor válido.
 */
export function parseBRLToCents(input: string): number | null {
  let s = input.replace(/R\$|\s/g, "");
  if (!s || !/^[\d.,]+$/.test(s)) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // 2.500 = dois mil e quinhentos
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || !/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(n * 100);
}
