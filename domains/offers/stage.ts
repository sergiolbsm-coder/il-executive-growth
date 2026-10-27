// Regras PURAS do ciclo de oferta (sem banco): estágio derivado dos portões e situação do prazo.

export interface GateDef {
  key: string;
  stage: number;
  kind: "manual" | "vendas";
  threshold: number | null;
  required: boolean;
}

export interface StageResult {
  /** Estágio alcançado (1–7). */
  stage: number;
  /** Itens obrigatórios ainda não cumpridos do PRÓXIMO estágio (vazio no estágio 7). */
  missing: GateDef[];
}

/** Um portão está cumprido: manual = marcado e confirmado; vendas = nº de vendas ≥ limiar. */
export function gateMet(g: GateDef, confirmed: ReadonlySet<string>, salesCount: number): boolean {
  return g.kind === "vendas" ? salesCount >= (g.threshold ?? 1) : confirmed.has(g.key);
}

/**
 * Estágio = o maior k tal que TODOS os portões obrigatórios dos estágios 2..k estão cumpridos (sequencial).
 * Todo oferta nasce em Ideia (1): problema e público são exigidos na criação.
 * Invariante: estágios 5+ exigem ao menos 1 venda registrada, qualquer que seja a configuração dos portões.
 */
export function computeStage(gates: readonly GateDef[], confirmed: ReadonlySet<string>, salesCount: number): StageResult {
  let stage = 1;
  for (let k = 2; k <= 7; k++) {
    const need = gates.filter((g) => g.stage === k && g.required);
    if (k >= 5 && salesCount < 1) break;
    if (!need.every((g) => gateMet(g, confirmed, salesCount))) break;
    stage = k;
  }
  const next = stage < 7 ? gates.filter((g) => g.stage === stage + 1 && g.required && !gateMet(g, confirmed, salesCount)) : [];
  // Se o próximo estágio só está bloqueado pela invariante de vendas, sinaliza a falta de venda.
  return { stage, missing: next };
}

export type ScheduleStatus = "sem-prazo" | "cumprida" | "no-prazo" | "em-risco" | "atrasada";

/** Compara o estágio real com a meta no prazo. `today` e `due` em AAAA-MM-DD. "Em risco" = faltam ≤ 14 dias. */
export function scheduleStatus(stage: number, targetStage: number, due: string | null, today: string): ScheduleStatus {
  if (stage >= targetStage) return "cumprida";
  if (!due) return "sem-prazo";
  if (due < today) return "atrasada";
  const days = Math.round((Date.parse(due + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86_400_000);
  return days <= 14 ? "em-risco" : "no-prazo";
}

export const SCHEDULE_LABEL: Record<ScheduleStatus, string> = {
  "sem-prazo": "sem prazo",
  cumprida: "meta cumprida",
  "no-prazo": "no prazo",
  "em-risco": "em risco",
  atrasada: "atrasada",
};

/** Data de hoje no fuso de Brasília (AAAA-MM-DD). */
export const todayBR = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
