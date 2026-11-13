import { and, desc, eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import type { ToolField } from "@/lib/db/schema";
import { ValidationError } from "@/lib/errors";
import { GATE_GUIDES, STAGE_GUIDES, guideFor } from "@/lib/stage-guides";
import { stageName } from "@/lib/stages";
import { createEntry, listProgramTools, saveEntry, validateEntryData } from "@/domains/tools/service";
import { checkGate, getOffer } from "./service";

/**
 * "Completar com a minha IA": gera UM prompt com tudo que falta na oferta (ferramentas + itens do checklist) e importa a resposta
 * de uma vez. Tudo que entra fica PENDENTE (inclusive quando a equipe importa): o mentor revisa e confirma.
 */

type Pack = {
  offer: Awaited<ReturnType<typeof getOffer>>["offer"];
  sourceName: string;
  tools: { slug: string; name: string; fields: ToolField[]; gateKeys: string[]; entryId: string | null; entryData: Record<string, unknown> }[];
  items: { key: string; label: string; stage: number }[];
};

const typeLabel = (f: ToolField) =>
  f.type === "textarea" ? "texto longo" : f.type === "text" ? "texto curto" : f.type === "number" ? "número" : f.type === "url" ? "link (https://…)"
    : f.type === "select" ? `uma destas opções: ${f.options!.map((o) => `"${o}"`).join(", ")}` : `lista com algumas destas opções: ${f.options!.map((o) => `"${o}"`).join(", ")}`;

/** O que ainda falta: ferramentas ligadas a portões e ainda não concluídas + itens manuais sem ferramenta e sem marcação. */
async function pending(actor: AuthContext, offerId: string): Promise<Pack> {
  const d = await getOffer(actor, offerId);
  const { offer, program, gates, checks, sources } = d;
  const pt = await listProgramTools(actor, program.id);
  const checked = new Set(checks.map((c) => c.gateKey));
  const gateKeys = new Set(gates.map((g) => g.key));
  const db = await getDb();
  const tools: Pack["tools"] = [];
  const covered = new Set<string>();
  for (const t of pt.tools) {
    if (t.kind !== "declarativa") continue;
    const keys = t.gateKeys.filter((k) => gateKeys.has(k));
    if (!keys.length) continue;
    keys.forEach((k) => covered.add(k));
    const mine = await db.select().from(schema.toolEntries).where(and(eq(schema.toolEntries.programId, program.id), eq(schema.toolEntries.toolSlug, t.slug), eq(schema.toolEntries.offerId, offerId))).orderBy(desc(schema.toolEntries.updatedAt));
    if (mine.some((e) => e.status === "concluida")) continue;
    const draft = mine[0] ?? null;
    tools.push({ slug: t.slug, name: t.name, fields: t.fields, gateKeys: keys, entryId: draft?.id ?? null, entryData: draft?.data ?? {} });
  }
  const items = gates.filter((g) => g.kind === "manual" && !covered.has(g.key) && !checked.has(g.key)).map((g) => ({ key: g.key, label: g.label, stage: g.stage }));
  return { offer, sourceName: sources.find((s) => s.slug === offer.revenueSlug)?.name ?? offer.revenueSlug, tools, items };
}

export async function buildOfferPrompt(actor: AuthContext, offerId: string): Promise<string> {
  const p = await pending(actor, offerId);
  const o = p.offer;
  if (!p.tools.length && !p.items.length) throw new ValidationError("Esta oferta não tem nada pendente para preencher com a IA.");
  const L: string[] = [];
  L.push("Você vai me ajudar a completar o plano de lançamento de UMA oferta do meu negócio, usando o que já sabe sobre mim e o meu negócio (nossas conversas, meus documentos, anotações e materiais).");
  L.push("");
  L.push("REGRAS");
  L.push("1. Use SOMENTE informações que eu já te passei ou que estejam nos meus documentos. Se não souber, deixe o campo de fora do JSON. Não invente preços, números, resultados, depoimentos ou nomes.");
  L.push("2. Não inclua nomes, e-mails, telefones ou dados pessoais de clientes. Descreva perfis (ex.: \"diretor de escola de médio porte\").");
  L.push("3. Escreva em português, de forma objetiva e pronta para uso.");
  L.push("4. Se alguma informação faltar, liste ao final (fora do JSON) o que eu preciso te responder para completar.");
  L.push("5. Entregue a resposta em UM bloco JSON, no formato do final deste texto, para eu colar no sistema.");
  L.push("");
  L.push("OFERTA");
  L.push(`Nome: ${o.name}`);
  L.push(`Tipo (fonte de receita): ${p.sourceName}`);
  L.push(`Problema que resolve: ${o.problem}`);
  L.push(`Público: ${o.audience}`);
  if (o.priceNote) L.push(`Preço informado: ${o.priceNote}`);
  L.push(`Estágio atual: ${o.stage}. ${stageName(o.stage)} · Meta: ${stageName(o.targetStage)}`);
  L.push("");
  L.push("O QUE FALTA PREENCHER");
  const ex: { ferramentas: Record<string, Record<string, string>>; itens: Record<string, string> } = { ferramentas: {}, itens: {} };
  for (const t of p.tools) {
    L.push("");
    L.push(`## Ferramenta: ${t.name} (chave: ${t.slug})`);
    for (const k of t.gateKeys) {
      const g = guideFor(k, o.revenueSlug);
      if (g) L.push(`Como fazer: ${g.how.join(" ")}${g.example ? ` Exemplo: ${g.example}` : ""}`);
    }
    if (t.fields.some((f) => f.key === "cliente")) L.push("Atenção: no campo \"cliente\" escreva o PERFIL (ex.: \"diretora de escola privada de médio porte\"), nunca o nome; só preencha se o cliente já autorizou o uso.");
    L.push("Campos (use a chave exatamente como está):");
    ex.ferramentas[t.slug] = {};
    for (const f of t.fields) {
      const have = t.entryData[f.key] != null ? " [já preenchido — só complemente se tiver algo melhor]" : "";
      L.push(`- ${f.key} — ${f.label} (${typeLabel(f)}${f.required ? ", obrigatório" : ", opcional"})${have}`);
      if (Object.keys(ex.ferramentas[t.slug]).length < 2) ex.ferramentas[t.slug][f.key] = "...";
    }
  }
  if (p.items.length) {
    L.push("");
    L.push("## Itens do checklist (resposta em texto curto ou um link, a evidência de que o item está pronto)");
    for (const it of p.items) {
      const g = GATE_GUIDES[it.key];
      L.push(`- ${it.key} — ${it.label} (etapa ${it.stage}. ${stageName(it.stage)})${g ? `. Como fazer: ${g.how.join(" ").replace(/\.$/, "")}. Evidência: ${g.evidence}` : ""}`);
      if (Object.keys(ex.itens).length < 2) ex.itens[it.key] = "...";
    }
  }
  const stages = [...new Set([...p.items.map((i) => i.stage)])].filter((n) => STAGE_GUIDES[n]);
  if (stages.length) {
    L.push("");
    L.push("CONTEXTO DAS ETAPAS");
    for (const n of stages) L.push(`- ${n}. ${stageName(n)}: ${STAGE_GUIDES[n].goal}`);
  }
  L.push("");
  L.push("FORMATO DA RESPOSTA (apenas os campos que você tiver certeza; omita o resto)");
  L.push("```json");
  L.push(JSON.stringify({ versao: 1, oferta: o.name, ferramentas: ex.ferramentas, itens: ex.itens }, null, 2));
  L.push("```");
  return L.join("\n");
}

/** Extrai o JSON da resposta da IA (com ou sem cerca ```json e texto em volta). */
function extractJson(text: string): Record<string, unknown> {
  const t = (text ?? "").trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  const body = fence ? fence[1] : t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1);
  if (!body || !body.includes("{")) throw new ValidationError("Não encontrei o bloco JSON. Cole a resposta completa da sua IA (do { até o }).");
  try {
    const v = JSON.parse(body);
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v as Record<string, unknown>;
  } catch {
    throw new ValidationError("O JSON está com defeito (vírgula, aspas ou chave faltando). Peça à sua IA: \"reenvie só o bloco JSON válido\".");
  }
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export async function importOfferAnswers(actor: AuthContext, offerId: string, text: string, apply: boolean) {
  const raw = extractJson(text);
  const p = await pending(actor, offerId);
  if (norm(String(raw.oferta ?? "")) !== norm(p.offer.name)) {
    throw new ValidationError(`Esta resposta é da oferta "${String(raw.oferta ?? "(sem nome)")}", e esta página é de "${p.offer.name}". Confira se colou a resposta certa.`);
  }
  if (p.offer.status !== "ativa") throw new ValidationError("Reative a oferta antes de importar.");
  const errors: string[] = [];
  const report: string[] = [];
  const plan: { tool: Pack["tools"][number]; data: Record<string, unknown>; conclude: boolean }[] = [];
  const itemPlan: { key: string; evidence: string }[] = [];

  const ferr = raw.ferramentas;
  if (ferr !== undefined && (typeof ferr !== "object" || ferr === null || Array.isArray(ferr))) errors.push('"ferramentas" deve ser um objeto.');
  for (const [slug, vals] of Object.entries((ferr && typeof ferr === "object" && !Array.isArray(ferr) ? ferr : {}) as Record<string, unknown>)) {
    const tool = p.tools.find((t) => t.slug === slug);
    if (!tool) { report.push(`Ferramenta "${slug}": ignorada (já concluída ou não faz parte desta oferta).`); continue; }
    if (!vals || typeof vals !== "object" || Array.isArray(vals)) { errors.push(`${tool.name}: formato inválido.`); continue; }
    const given: Record<string, unknown> = {};
    const unknown: string[] = [];
    for (const [k, v] of Object.entries(vals as Record<string, unknown>)) {
      const f = tool.fields.find((x) => x.key === k);
      if (!f) { unknown.push(k); continue; }
      if (v === null || v === undefined || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length)) continue;
      given[k] = f.type === "checklist" ? (Array.isArray(v) ? v.map(String) : [String(v)]) : typeof v === "object" ? JSON.stringify(v) : String(v);
    }
    const merged = { ...tool.entryData, ...given };
    if (!Object.keys(given).length) { report.push(`${tool.name}: nada novo para preencher.`); continue; }
    try {
      validateEntryData(tool.fields, merged, false);
    } catch (e) {
      if (e instanceof ValidationError) { errors.push(`${tool.name}: ${e.message}`); continue; }
      throw e;
    }
    let conclude = true;
    let missing = "";
    try { validateEntryData(tool.fields, merged, true); } catch (e) { if (e instanceof ValidationError) { conclude = false; missing = e.message.replace(/^Preencha:\s*/, "").replace(/\.$/, ""); } else throw e; }
    plan.push({ tool, data: merged, conclude });
    report.push(`${tool.name}: ${Object.keys(given).length} campo(s) — ${conclude ? "campos obrigatórios completos, será concluída e o item entra como PENDENTE de confirmação" : `fica como rascunho (falta: ${missing})`}${unknown.length ? `; campos desconhecidos ignorados: ${unknown.join(", ")}` : ""}.`);
  }

  const itens = raw.itens;
  if (itens !== undefined && (typeof itens !== "object" || itens === null || Array.isArray(itens))) errors.push('"itens" deve ser um objeto.');
  for (const [key, v] of Object.entries((itens && typeof itens === "object" && !Array.isArray(itens) ? itens : {}) as Record<string, unknown>)) {
    const it = p.items.find((i) => i.key === key);
    const ev = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
    if (!it) { report.push(`Item "${key}": ignorado (não existe, já está marcado ou é coberto por uma ferramenta).`); continue; }
    if (ev.length < 3) continue;
    itemPlan.push({ key, evidence: `Resposta da IA do assessorado: ${ev}`.slice(0, 1900) });
    report.push(`Item "${it.label}": entra como PENDENTE de confirmação.`);
  }

  if (errors.length) throw new ValidationError(`Nada foi importado. Corrija:\n${errors.slice(0, 8).join("\n")}`);
  if (!plan.length && !itemPlan.length) throw new ValidationError(`Nada para importar neste JSON.${report.length ? `\n${report.slice(0, 5).join("\n")}` : ""}`);

  if (apply) {
    for (const x of plan) {
      const id = x.tool.entryId ?? (await createEntry(actor, p.offer.programId, x.tool.slug, { offerId })).id;
      await saveEntry(actor, id, x.data, x.conclude, { pending: true });
    }
    for (const it of itemPlan) await checkGate(actor, offerId, it.key, it.evidence, { pending: true });
    await audit({ actorId: actor.userId, entityType: "offer", entityId: offerId, action: "offer.import_answers", after: { tools: plan.map((x) => x.tool.slug), items: itemPlan.map((i) => i.key) } });
  }
  return { applied: apply, tools: plan.length, items: itemPlan.length, report };
}
