// Resumo do calendário editorial — regras PURAS (sem banco).
import { addDays } from "@/lib/week";

export const CHANNELS = ["linkedin", "instagram", "newsletter", "artigo", "blog", "youtube", "palestra", "evento", "outro"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin: "LinkedIn (post)", instagram: "Instagram", newsletter: "Newsletter", artigo: "Artigo", blog: "Blog",
  youtube: "YouTube / vídeo", palestra: "Palestra", evento: "Evento", outro: "Outro",
};
export const STATUSES = ["ideia", "rascunho", "agendada", "publicada", "descartada"] as const;
export type ContentStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<ContentStatus, string> = { ideia: "Ideia", rascunho: "Rascunho", agendada: "Agendada", publicada: "Publicada", descartada: "Descartada" };

export interface SummaryItem {
  id: string; axisId: string | null; weekStart: string; status: ContentStatus; title: string;
  engagement: number | null; leads: number | null;
}

export interface Summary {
  byStatus: Record<ContentStatus, number>;
  /** Últimas 4 semanas (incluindo a atual): planejadas (rascunho/agendada/publicada) × publicadas. */
  pace: { planned: number; published: number; ratio: number | null };
  /** Equilíbrio dos eixos: itens ativos de 8 semanas atrás a 4 à frente; `gap` = eixo sem nenhum item na janela (só quando há 2+ eixos). */
  axes: { axisId: string; count: number; published: number; gap: boolean }[];
  top: SummaryItem[];
  totals: { engagement: number; leads: number };
}

export function summarize(items: SummaryItem[], axes: { id: string }[], currentWeek: string): Summary {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<ContentStatus, number>;
  for (const i of items) byStatus[i.status] += 1;

  const paceFrom = addDays(currentWeek, -21);
  const inPace = items.filter((i) => i.weekStart >= paceFrom && i.weekStart <= currentWeek);
  const planned = inPace.filter((i) => ["rascunho", "agendada", "publicada"].includes(i.status)).length;
  const published = inPace.filter((i) => i.status === "publicada").length;

  const from = addDays(currentWeek, -56);
  const to = addDays(currentWeek, 28);
  const win = items.filter((i) => i.status !== "descartada" && i.weekStart >= from && i.weekStart <= to);
  const axisRows = axes.map((a) => {
    const mine = win.filter((i) => i.axisId === a.id);
    return { axisId: a.id, count: mine.length, published: mine.filter((i) => i.status === "publicada").length, gap: axes.length >= 2 && mine.length === 0 };
  });

  const pub = items.filter((i) => i.status === "publicada");
  return {
    byStatus,
    pace: { planned, published, ratio: planned > 0 ? published / planned : null },
    axes: axisRows,
    top: [...pub].filter((i) => (i.engagement ?? 0) > 0).sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0)).slice(0, 3),
    totals: { engagement: pub.reduce((a, i) => a + (i.engagement ?? 0), 0), leads: pub.reduce((a, i) => a + (i.leads ?? 0), 0) },
  };
}
