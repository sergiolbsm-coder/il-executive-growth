// Semanas começam na segunda-feira. Datas como AAAA-MM-DD (fuso de Brasília para "hoje").
import { todayBR } from "@/domains/offers/stage";

const MS = 86_400_000;
const parse = (iso: string) => Date.parse(iso + "T00:00:00Z");
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const isIsoDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Segunda-feira da semana que contém `iso`. */
export function mondayOf(iso: string): string {
  const d = new Date(parse(iso)).getUTCDay(); // 0 = domingo
  return fmt(parse(iso) - ((d + 6) % 7) * MS);
}

export const isMonday = (iso: string) => isIsoDate(iso) && new Date(parse(iso)).getUTCDay() === 1;
export const addDays = (iso: string, n: number) => fmt(parse(iso) + n * MS);
export const currentWeek = () => mondayOf(todayBR());

/** Segundas-feiras cujo mês é `ym` (AAAA-MM): a semana pertence ao mês da sua segunda-feira. */
export function mondaysOfMonth(ym: string): string[] {
  const out: string[] = [];
  let d = mondayOf(ym + "-01");
  if (d < ym + "-01") d = addDays(d, 7);
  while (d.startsWith(ym)) {
    out.push(d);
    d = addDays(d, 7);
  }
  return out;
}

export const weekLabel = (monday: string) => `${monday.split("-").reverse().slice(0, 2).join("/")} a ${addDays(monday, 6).split("-").reverse().slice(0, 2).join("/")}`;
