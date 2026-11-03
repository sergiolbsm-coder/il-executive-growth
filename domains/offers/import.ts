import type { NewOffer } from "./service";

/** Ordem das 9 receitas do template-base: "Receita N" no texto colado = N-ésimo slug. */
const SLUGS = ["autoridade", "workshops", "digitais", "cursos", "recorrencia", "instituicoes", "alto-valor", "parcerias", "conselhos"];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const STAGES: Record<string, number> = {
  ideia: 1, prototipada: 2, prototipacao: 2, "oferta pronta": 3, "em prospeccao": 4, "primeira venda": 5, validada: 6, escala: 7,
};
const WAVES: Record<string, number> = { "vender e validar": 1, "aumentar ticket": 2, recorrencia: 3 };
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface ParsedOffer extends NewOffer {
  line: number;
}

/** "Mar/27" → último dia do mês (2027-03-31). */
function monthEnd(s: string): string | null {
  // O Excel pode converter "Mar/27" em data: aceita também 2027-03-01 e 01/03/2027.
  const iso = /^(\d{4})-(\d{2})-\d{2}/.exec(s.trim()) ?? /^\d{1,2}\/(\d{1,2})\/(\d{4})/.exec(s.trim());
  if (iso) {
    const [y, mo] = iso[0].includes("-") ? [Number(iso[1]), Number(iso[2])] : [Number(iso[2]), Number(iso[1])];
    if (mo >= 1 && mo <= 12) return `${y}-${String(mo).padStart(2, "0")}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`;
  }
  const m = /^([a-zç]{3})\/(\d{2}|\d{4})$/i.exec(s.trim());
  if (!m) return null;
  const mi = MONTHS.indexOf(norm(m[1]));
  if (mi < 0) return null;
  const y = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  const day = new Date(Date.UTC(y, mi + 1, 0)).getUTCDate();
  return `${y}-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Lê a tabela colada (colunas separadas por TAB): Nome · Problema. Público · Meta de estágio · Prazo · Onda · Preço,
 * agrupada por títulos "Receita N — Nome (Nível X)". Linhas de objetivo, cabeçalho e notas (*) são ignoradas.
 * O texto "Problema. Público" é separado no ÚLTIMO ponto seguido de espaço.
 */
export function parseOfferTable(text: string): { offers: ParsedOffer[]; errors: string[] } {
  const offers: ParsedOffer[] = [];
  const errors: string[] = [];
  const lines = text.replace(/\r/g, "").replace(/(Receita\s+\d+\s*[—–-])/g, "\n$1").split("\n");
  let slug: string | null = null;
  let flat = false;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const n = i + 1;
    if (!line) return;
    // Tabela simples (a da planilha): Receita · Nome · Problema · Público · Meta · Prazo · Onda · Preço
    if (/^receita\t+nome\b/i.test(line)) { flat = true; return; }
    if (flat) {
      const f = raw.split("\t").map((x) => x.trim());
      if (f.length < 7) { errors.push(`Linha ${n}: esperadas as colunas Receita, Nome, Problema, Público, Meta, Prazo, Onda, Preço.`); return; }
      const [rec, name, problem, audience, meta, prazo, onda, preco] = f;
      const rn = /^\d+/.exec(rec);
      const fslug = rn ? SLUGS[Number(rn[0]) - 1] : SLUGS.find((x) => norm(rec).includes(x)) ?? null;
      const stage = STAGES[norm(meta.replace(/\*+$/, ""))];
      const wave = WAVES[norm(onda)];
      const due = monthEnd(prazo);
      const bad: string[] = [];
      if (!fslug) bad.push(`receita "${rec}"`);
      if (!name) bad.push("nome");
      if (!problem || !audience) bad.push("problema/público");
      if (!stage) bad.push(`meta "${meta}"`);
      if (!due) bad.push(`prazo "${prazo}"`);
      if (!wave) bad.push(`onda "${onda}"`);
      if (bad.length) { errors.push(`Linha ${n} (${name || "sem nome"}): corrija ${bad.join(", ")}.`); return; }
      offers.push({ line: n, revenueSlug: fslug!, name, problem, audience, targetStage: stage, dueDate: due, wave, priceNote: preco && preco !== "—" ? preco : undefined });
      return;
    }
    const h = /^Receita\s+(\d+)\s*[—–-]/.exec(line);
    if (h) {
      slug = SLUGS[Number(h[1]) - 1] ?? null;
      if (!slug) errors.push(`Linha ${n}: receita ${h[1]} não existe (use 1 a 9).`);
      return;
    }
    if (/^objetivo\s*:/i.test(line) || /^nome da oferta/i.test(line) || line.startsWith("*")) return;
    const c = raw.split("\t").map((x) => x.trim());
    if (c.length < 5) {
      errors.push(`Linha ${n}: não parece uma oferta (esperadas colunas separadas por TAB): "${line.slice(0, 50)}"`);
      return;
    }
    if (!slug) {
      errors.push(`Linha ${n}: oferta antes de um título "Receita N —".`);
      return;
    }
    const [name, pp, meta, prazo, onda, preco] = c;
    const cut = pp.lastIndexOf(". ");
    const problem = (cut > 0 ? pp.slice(0, cut) : pp).trim();
    const audience = (cut > 0 ? pp.slice(cut + 2) : "").replace(/\.$/, "").trim();
    const stage = STAGES[norm(meta.replace(/\*+$/, ""))];
    const wave = WAVES[norm(onda)];
    const due = monthEnd(prazo);
    const bad: string[] = [];
    if (!name) bad.push("nome");
    if (!problem || !audience) bad.push('"Problema. Público"');
    if (!stage) bad.push(`meta "${meta}"`);
    if (!due) bad.push(`prazo "${prazo}"`);
    if (!wave) bad.push(`onda "${onda}"`);
    if (bad.length) {
      errors.push(`Linha ${n} (${name || "sem nome"}): corrija ${bad.join(", ")}.`);
      return;
    }
    offers.push({ line: n, revenueSlug: slug, name, problem, audience, targetStage: stage, dueDate: due, wave, priceNote: preco && preco !== "—" ? preco : undefined });
  });
  return { offers, errors };
}
