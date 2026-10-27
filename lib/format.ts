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
