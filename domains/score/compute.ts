// Score de Alavancagem — regras PURAS (sem banco). Índice de PRONTIDÃO para alavancar o negócio (0–100), não previsão de receita.
// Pesos e limiares são hipóteses iniciais, editáveis por template e programa, a calibrar com os pilotos.

export const SCORE_KEYS = ["informacao", "ferramentas", "ofertas", "estrutura", "tracao"] as const;
export type ScoreKey = (typeof SCORE_KEYS)[number];
export type Weights = Record<ScoreKey, number>;

export const DEFAULT_WEIGHTS: Weights = { informacao: 20, ferramentas: 20, ofertas: 25, estrutura: 15, tracao: 20 };

export const SCORE_LABEL: Record<ScoreKey, string> = {
  informacao: "Informação",
  ferramentas: "Ferramentas estratégicas",
  ofertas: "Ofertas",
  estrutura: "Estrutura",
  tracao: "Tração",
};

export const SCORE_HELP: Record<ScoreKey, string> = {
  informacao: "Quanto do plano está preenchido (propósito, horas, datas, e preço/prazo/onda/problema/público de cada oferta).",
  ferramentas: "Ferramentas do programa concluídas, ponderadas pelo peso de cada uma (as estratégicas pesam o dobro). Revisada pelo mentor vale 100%; concluída sem revisão, 60%; rascunho, 0%.",
  ofertas: "Estágio das ofertas ativas (1–7), ponderado pelo nível da Escala do Negócio: oferta madura num nível alto vale mais.",
  estrutura: "Receitas com oferta (40%), base × topo da pirâmide equilibrados (30%) e vendas com a oferta de origem informada (30%).",
  tracao: "Vendas (40%, teto em 5), atingimento dos KPIs nas últimas 4 semanas (40%) e check-ins feitos (20%).",
};

/** Normaliza pesos arbitrários para somar exatamente 100 (maior resto). Chaves ausentes ou inválidas viram 0. */
export function normalizeWeights(input: Partial<Record<string, number>> | null | undefined): Weights {
  const raw = SCORE_KEYS.map((k) => {
    const v = Number(input?.[k]);
    return Number.isFinite(v) && v > 0 ? v : 0;
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  const exact = raw.map((v) => (v / sum) * 100);
  const floor = exact.map(Math.floor);
  let rest = 100 - floor.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, frac: e - floor[i] })).sort((a, b) => b.frac - a.frac);
  for (const o of order) {
    if (rest <= 0) break;
    floor[o.i] += 1;
    rest -= 1;
  }
  return Object.fromEntries(SCORE_KEYS.map((k, i) => [k, floor[i]])) as Weights;
}

export interface ScoreInput {
  program: { purpose: string | null; weeklyHours: number | null; startDate: string | null; endDate: string | null };
  sessionsCount: number;
  sources: { slug: string; name: string; level: number }[];
  offers: { name: string; level: number; stage: number; status: string; priceNote: string | null; dueDate: string | null; wave: number | null; problem: string; audience: string; revenueSlug: string }[];
  tools: { slug: string; name: string; weight: number; strategic: boolean; credit: "revisada" | "concluida" | "rascunho" | null }[];
  sales: { hasOrigin: boolean }[];
  cadence: { attainment: number | null; checkinWeeks: number; weeks: number };
}

export interface ScoreComponent {
  key: ScoreKey;
  label: string;
  /** 0–1 */
  ratio: number;
  weight: number;
  points: number;
  /** Pontos que ainda podem ser ganhos neste componente. */
  potential: number;
  hints: string[];
}

export interface ScoreResult {
  total: number;
  weights: Weights;
  components: ScoreComponent[];
  /** "Próximo melhor passo": componentes com mais pontos a ganhar, com a dica principal de cada um. */
  steps: { key: ScoreKey; label: string; text: string; upTo: number }[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const CREDIT = { revisada: 1, concluida: 0.6, rascunho: 0 } as const;

function informacao(i: ScoreInput) {
  const items: { ok: boolean; hint: string }[] = [
    { ok: (i.program.purpose ?? "").trim().length >= 20, hint: "Defina o propósito do programa (pelo menos uma frase completa)." },
    { ok: i.program.weeklyHours != null, hint: "Informe as horas por semana disponíveis." },
    { ok: !!(i.program.startDate && i.program.endDate), hint: "Informe as datas de início e término do programa." },
    { ok: i.sessionsCount >= 1, hint: "Registre a primeira sessão de mentoria." },
  ];
  for (const o of i.offers.filter((x) => x.status === "ativa")) {
    items.push(
      { ok: !!o.priceNote?.trim(), hint: `Informe o preço de referência de "${o.name}".` },
      { ok: !!o.dueDate, hint: `Defina o prazo da meta de "${o.name}".` },
      { ok: o.wave != null, hint: `Defina a onda de "${o.name}".` },
      { ok: o.problem.trim().length >= 20, hint: `Detalhe o problema que "${o.name}" resolve.` },
      { ok: o.audience.trim().length >= 20, hint: `Detalhe o público de "${o.name}".` },
    );
  }
  return { ratio: items.filter((x) => x.ok).length / items.length, hints: items.filter((x) => !x.ok).map((x) => x.hint) };
}

function ferramentas(i: ScoreInput) {
  const list = i.tools;
  if (!list.length) return { ratio: 0, hints: ["Nenhuma ferramenta no programa. Carregue as ferramentas do template."] };
  const w = (t: (typeof list)[number]) => t.weight * (t.strategic ? 2 : 1);
  const total = list.reduce((a, t) => a + w(t), 0);
  const got = list.reduce((a, t) => a + w(t) * (t.credit ? CREDIT[t.credit] : 0), 0);
  const hints = list
    .filter((t) => t.credit !== "revisada")
    .sort((a, b) => w(b) * (1 - (b.credit ? CREDIT[b.credit] : 0)) - w(a) * (1 - (a.credit ? CREDIT[a.credit] : 0)))
    .slice(0, 3)
    .map((t) => (t.credit === "concluida" ? `Peça a revisão do mentor para "${t.name}" (conta 100%).` : t.credit === "rascunho" ? `Conclua "${t.name}".` : `Use a ferramenta "${t.name}"${t.strategic ? " (estratégica)" : ""}.`));
  return { ratio: clamp01(got / total), hints };
}

function ofertas(i: ScoreInput) {
  const act = i.offers.filter((o) => o.status === "ativa");
  if (!act.length) return { ratio: 0, hints: ["Crie a primeira oferta do programa."] };
  const den = act.reduce((a, o) => a + o.level, 0);
  const num = act.reduce((a, o) => a + o.level * (o.stage / 7), 0);
  const hints = [...act].sort((a, b) => b.level * (1 - b.stage / 7) - a.level * (1 - a.stage / 7)).slice(0, 2).filter((o) => o.stage < 7).map((o) => `Avance "${o.name}" (nível ${o.level}, hoje no estágio ${o.stage}/7).`);
  return { ratio: clamp01(num / den), hints };
}

function estrutura(i: ScoreInput) {
  const act = i.offers.filter((o) => o.status === "ativa");
  const covered = new Set(act.map((o) => o.revenueSlug));
  const cov = i.sources.length ? covered.size / i.sources.length : 0;
  const base = act.filter((o) => o.level <= 2).length;
  const top = act.filter((o) => o.level >= 3).length;
  const shape = base + top === 0 ? 0 : top === 0 ? 1 : Math.min(1, base / top);
  const pull = i.sales.length ? i.sales.filter((s) => s.hasOrigin).length / i.sales.length : 0;
  const hints: string[] = [];
  const gaps = i.sources.filter((s) => !covered.has(s.slug));
  if (gaps.length) hints.push(`Receitas sem oferta: ${gaps.slice(0, 3).map((g) => g.name).join(", ")}${gaps.length > 3 ? "…" : ""}.`);
  if (shape < 1 && base + top > 0) hints.push("Base fina: crie ofertas de volume (níveis 1–2) para sustentar as de ticket alto.");
  if (pull < 1) hints.push(i.sales.length ? "Informe a oferta de origem nas vendas (quem puxa quem)." : "Registre vendas informando a oferta que originou o lead.");
  return { ratio: clamp01(0.4 * cov + 0.3 * shape + 0.3 * pull), hints };
}

function tracao(i: ScoreInput) {
  const vendas = clamp01(i.sales.length / 5);
  const kpi = i.cadence.attainment ?? 0;
  const chk = clamp01(i.cadence.checkinWeeks / i.cadence.weeks);
  const hints: string[] = [];
  if (i.sales.length < 5) hints.push(i.sales.length === 0 ? "Registre a primeira venda." : "Registre as próximas vendas (teto em 5).");
  if (i.cadence.attainment == null) hints.push("Configure metas semanais de KPI e lance os valores.");
  else if (kpi < 1) hints.push("Lance os KPIs da semana e aproxime-se das metas.");
  if (i.cadence.checkinWeeks < i.cadence.weeks) hints.push("Faça o check-in semanal (PDCA).");
  return { ratio: clamp01(0.4 * vendas + 0.4 * kpi + 0.2 * chk), hints };
}

export function computeScore(input: ScoreInput, weightsIn?: Partial<Record<string, number>> | null): ScoreResult {
  const weights = normalizeWeights(weightsIn ?? DEFAULT_WEIGHTS);
  const parts: Record<ScoreKey, { ratio: number; hints: string[] }> = {
    informacao: informacao(input), ferramentas: ferramentas(input), ofertas: ofertas(input), estrutura: estrutura(input), tracao: tracao(input),
  };
  const components: ScoreComponent[] = SCORE_KEYS.map((key) => {
    const { ratio, hints } = parts[key];
    const points = ratio * weights[key];
    return { key, label: SCORE_LABEL[key], ratio, weight: weights[key], points: round1(points), potential: round1(weights[key] - points), hints };
  });
  const steps = [...components]
    .filter((c) => c.potential > 0.05 && c.hints.length)
    .sort((a, b) => b.potential - a.potential)
    .slice(0, 3)
    .map((c) => ({ key: c.key, label: c.label, text: c.hints[0], upTo: c.potential }));
  return { total: round1(components.reduce((a, c) => a + c.ratio * c.weight, 0)), weights, components, steps };
}
