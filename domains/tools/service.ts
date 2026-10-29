import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { type AuthContext, ForbiddenError, canEditProgram, canManageTemplates, canViewMentee } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import type { Tool, ToolField } from "@/lib/db/schema";
import { ValidationError } from "@/lib/errors";
import { toRef } from "@/domains/mentees/service";
import { checkGate, confirmGate } from "@/domains/offers/service";
import { loadProgram } from "@/domains/programs/service";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELD_KEY = /^[a-z][a-z0-9_]*$/;
const PHASES = ["levantamento", "prototipacao", "lancamento", "transversal"] as const;
const TYPES = ["text", "textarea", "number", "url", "select", "checklist"] as const;
const isHttp = (s: string) => /^https?:\/\/[^\s]+$/i.test(s);

/** Valida a definição dos campos de uma ferramenta declarativa. */
export function validateFields(fields: unknown): ToolField[] {
  if (!Array.isArray(fields) || fields.length === 0) throw new ValidationError("Uma ferramenta declarativa precisa de ao menos um campo.");
  if (fields.length > 40) throw new ValidationError("Máximo de 40 campos por ferramenta.");
  const seen = new Set<string>();
  return fields.map((raw, i) => {
    const f = raw as Partial<ToolField>;
    const where = `Campo ${i + 1}`;
    if (!f || typeof f !== "object") throw new ValidationError(`${where}: formato inválido.`);
    if (typeof f.key !== "string" || !FIELD_KEY.test(f.key)) throw new ValidationError(`${where}: identificador inválido (minúsculas, números e _; começa com letra).`);
    if (seen.has(f.key)) throw new ValidationError(`${where}: identificador repetido (${f.key}).`);
    seen.add(f.key);
    if (typeof f.label !== "string" || !f.label.trim()) throw new ValidationError(`${where}: informe o rótulo.`);
    if (!TYPES.includes(f.type as (typeof TYPES)[number])) throw new ValidationError(`${where}: tipo inválido.`);
    let options: string[] | undefined;
    if (f.type === "select" || f.type === "checklist") {
      if (!Array.isArray(f.options) || f.options.length === 0 || f.options.some((o) => typeof o !== "string" || !o.trim())) throw new ValidationError(`${where}: informe as opções.`);
      options = f.options.map((o) => o.trim());
    }
    return { key: f.key, label: f.label.trim(), type: f.type!, required: !!f.required, ...(options ? { options } : {}), ...(f.help ? { help: String(f.help) } : {}) };
  });
}

/** Valida e normaliza os dados preenchidos contra a definição dos campos. `conclude` exige os obrigatórios. */
export function validateEntryData(fields: ToolField[], data: Record<string, unknown>, conclude: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = data[f.key];
    let v: unknown = null;
    if (f.type === "checklist") {
      const arr = Array.isArray(raw) ? raw.map(String) : [];
      if (arr.some((x) => !f.options!.includes(x))) throw new ValidationError(`${f.label}: opção inválida.`);
      v = arr.length ? arr : null;
    } else if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      const s = String(raw).trim();
      if (f.type === "number") {
        const n = Number(s.replace(",", "."));
        if (!Number.isFinite(n)) throw new ValidationError(`${f.label}: informe um número.`);
        v = n;
      } else if (f.type === "url") {
        if (!isHttp(s)) throw new ValidationError(`${f.label}: informe um link começando com http:// ou https://.`);
        v = s;
      } else if (f.type === "select") {
        if (!f.options!.includes(s)) throw new ValidationError(`${f.label}: opção inválida.`);
        v = s;
      } else {
        if (s.length > (f.type === "textarea" ? 8000 : 500)) throw new ValidationError(`${f.label}: texto longo demais.`);
        v = s;
      }
    }
    if (conclude && f.required && v === null) throw new ValidationError(`Preencha: ${f.label}.`);
    if (v !== null) out[f.key] = v;
  }
  return out;
}

export interface ToolInput {
  slug: string;
  name: string;
  phase: (typeof PHASES)[number];
  kind: "declarativa" | "externa";
  description?: string;
  fields?: unknown;
  externalUrl?: string;
  strategic?: boolean;
  weight?: number;
  active?: boolean;
  gateKeys?: string[];
}

/** Cria ou atualiza uma ferramenta do catálogo (administração e direção). O identificador (slug) não muda depois de criado. */
export async function saveTool(actor: AuthContext, input: ToolInput) {
  if (!canManageTemplates(actor)) throw new ForbiddenError();
  if (!SLUG.test(input.slug)) throw new ValidationError("Identificador inválido (minúsculas, números e hífen).");
  if (!input.name.trim()) throw new ValidationError("Informe o nome da ferramenta.");
  if (!PHASES.includes(input.phase)) throw new ValidationError("Fase inválida.");
  if (!["declarativa", "externa"].includes(input.kind)) throw new ValidationError("Tipo inválido.");
  const weight = input.weight ?? 1;
  if (!Number.isInteger(weight) || weight < 1 || weight > 10) throw new ValidationError("O peso deve ser de 1 a 10.");
  let fields: ToolField[] = [];
  let externalUrl: string | null = null;
  if (input.kind === "declarativa") fields = validateFields(input.fields);
  else {
    if (!input.externalUrl || !isHttp(input.externalUrl.trim())) throw new ValidationError("Informe o link da ferramenta externa (http:// ou https://).");
    externalUrl = input.externalUrl.trim();
  }
  const gateKeys = [...new Set((input.gateKeys ?? []).map((g) => g.trim()).filter(Boolean))];
  if (gateKeys.some((g) => !SLUG.test(g))) throw new ValidationError("Item de portão inválido.");
  if (input.kind === "externa" && gateKeys.length) throw new ValidationError("Ferramentas externas não comprovam portões.");

  const db = await getDb();
  const [existing] = await db.select().from(schema.tools).where(eq(schema.tools.slug, input.slug)).limit(1);
  if (existing && existing.kind !== input.kind) throw new ValidationError("O tipo de uma ferramenta existente não pode mudar.");
  const values = {
    name: input.name.trim(), phase: input.phase, kind: input.kind, description: input.description?.trim() || null, fields, externalUrl,
    strategic: !!input.strategic, weight, active: input.active ?? true, updatedAt: new Date(),
  };
  await db.transaction(async (tx) => {
    if (existing) await tx.update(schema.tools).set(values).where(eq(schema.tools.slug, input.slug));
    else {
      const [{ n }] = await tx.select({ n: sql<number>`coalesce(max(${schema.tools.sort}), 0)::int` }).from(schema.tools);
      await tx.insert(schema.tools).values({ slug: input.slug, ...values, sort: n + 1 });
    }
    await tx.delete(schema.toolGateLinks).where(eq(schema.toolGateLinks.toolSlug, input.slug));
    if (gateKeys.length) await tx.insert(schema.toolGateLinks).values(gateKeys.map((gateKey) => ({ toolSlug: input.slug, gateKey })));
  });
  await audit({ actorId: actor.userId, entityType: "tool", entityId: input.slug, action: existing ? "tool.update" : "tool.create", before: existing ? { name: existing.name, strategic: existing.strategic, weight: existing.weight, active: existing.active } : null, after: { name: values.name, strategic: values.strategic, weight, active: values.active, gateKeys } });
}

/** Catálogo completo (administração/direção), com itens de portão comprovados e templates que a incluem. */
export async function listToolsAdmin(actor: AuthContext) {
  if (!canManageTemplates(actor)) throw new ForbiddenError();
  const db = await getDb();
  const [tools, links, tpls, tt] = await Promise.all([
    db.select().from(schema.tools).orderBy(asc(schema.tools.sort)),
    db.select().from(schema.toolGateLinks),
    db.select({ id: schema.programTemplates.id, name: schema.programTemplates.name }).from(schema.programTemplates).orderBy(asc(schema.programTemplates.name)),
    db.select().from(schema.templateTools),
  ]);
  return {
    templates: tpls,
    tools: tools.map((t) => ({ ...t, gateKeys: links.filter((l) => l.toolSlug === t.slug).map((l) => l.gateKey), templateIds: tt.filter((x) => x.toolSlug === t.slug).map((x) => x.templateId) })),
  };
}

/** Define quais ferramentas o template inclui (programas novos recebem uma cópia; os existentes não mudam). */
export async function setTemplateTools(actor: AuthContext, templateId: string, slugs: string[]) {
  if (!canManageTemplates(actor)) throw new ForbiddenError();
  const db = await getDb();
  const [tpl] = await db.select().from(schema.programTemplates).where(eq(schema.programTemplates.id, templateId)).limit(1);
  if (!tpl) throw new ValidationError("Template não encontrado.");
  const uniq = [...new Set(slugs)];
  if (uniq.length) {
    const ok = await db.select({ slug: schema.tools.slug }).from(schema.tools).where(inArray(schema.tools.slug, uniq));
    if (ok.length !== uniq.length) throw new ValidationError("Ferramenta inválida na seleção.");
  }
  const before = (await db.select().from(schema.templateTools).where(eq(schema.templateTools.templateId, templateId))).map((x) => x.toolSlug);
  await db.transaction(async (tx) => {
    await tx.delete(schema.templateTools).where(eq(schema.templateTools.templateId, templateId));
    if (uniq.length) await tx.insert(schema.templateTools).values(uniq.map((toolSlug) => ({ templateId, toolSlug })));
    await tx.update(schema.programTemplates).set({ version: sql`${schema.programTemplates.version} + 1`, updatedAt: new Date() }).where(eq(schema.programTemplates.id, templateId));
  });
  await audit({ actorId: actor.userId, entityType: "template", entityId: templateId, action: "template.set_tools", before: { tools: before }, after: { tools: uniq } });
}

async function viewable(actor: AuthContext, programId: string) {
  const { program, mentee } = await loadProgram(programId);
  if (!canViewMentee(actor, toRef(mentee))) throw new ForbiddenError();
  return { program, mentee };
}

export type EntryCredit = "revisada" | "concluida" | "rascunho" | null;

/** Ferramentas do programa (ativas) com as entradas de cada uma e a melhor situação. */
export async function listProgramTools(actor: AuthContext, programId: string) {
  const { program, mentee } = await viewable(actor, programId);
  const db = await getDb();
  const [tools, links, entries] = await Promise.all([
    db.select({ t: schema.tools }).from(schema.programTools).innerJoin(schema.tools, eq(schema.tools.slug, schema.programTools.toolSlug)).where(and(eq(schema.programTools.programId, programId), eq(schema.tools.active, true))).orderBy(asc(schema.tools.sort)),
    db.select().from(schema.toolGateLinks),
    db.select().from(schema.toolEntries).where(eq(schema.toolEntries.programId, programId)),
  ]);
  const offerIds = [...new Set(entries.map((e) => e.offerId).filter((x): x is string => !!x))];
  const offerNames = new Map<string, string>();
  if (offerIds.length) for (const o of await db.select({ id: schema.offers.id, name: schema.offers.name }).from(schema.offers).where(inArray(schema.offers.id, offerIds))) offerNames.set(o.id, o.name);
  return {
    program, mentee, canEdit: canEditProgram(actor, toRef(mentee)),
    tools: tools.map(({ t }) => {
      const mine = entries.filter((e) => e.toolSlug === t.slug);
      const best: EntryCredit = mine.some((e) => e.status === "concluida" && e.reviewedAt) ? "revisada" : mine.some((e) => e.status === "concluida") ? "concluida" : mine.length ? "rascunho" : null;
      return { ...t, gateKeys: links.filter((l) => l.toolSlug === t.slug).map((l) => l.gateKey), entries: mine.map((e) => ({ id: e.id, offerId: e.offerId, title: e.title, status: e.status, reviewed: !!e.reviewedAt, offerName: e.offerId ? (offerNames.get(e.offerId) ?? null) : null, updatedAt: e.updatedAt })), best };
    }),
  };
}

/** Abre uma entrada em branco. Ferramentas que comprovam portões exigem escolher a oferta. Equipe ou o próprio mentorado. */
export async function createEntry(actor: AuthContext, programId: string, slug: string, opts: { offerId?: string | null; title?: string } = {}) {
  await viewable(actor, programId);
  const db = await getDb();
  const [inProgram] = await db.select().from(schema.programTools).innerJoin(schema.tools, eq(schema.tools.slug, schema.programTools.toolSlug)).where(and(eq(schema.programTools.programId, programId), eq(schema.programTools.toolSlug, slug), eq(schema.tools.active, true))).limit(1);
  if (!inProgram) throw new ValidationError("Esta ferramenta não faz parte do programa.");
  if (inProgram.tools.kind !== "declarativa") throw new ValidationError("Ferramentas externas abrem em outra aba e não têm entradas.");
  const links = await db.select().from(schema.toolGateLinks).where(eq(schema.toolGateLinks.toolSlug, slug));
  if (links.length && !opts.offerId) throw new ValidationError("Escolha a oferta: esta ferramenta comprova itens do portão dela.");
  if (opts.offerId) {
    const [o] = await db.select().from(schema.offers).where(and(eq(schema.offers.id, opts.offerId), eq(schema.offers.programId, programId))).limit(1);
    if (!o) throw new ValidationError("Oferta inválida (precisa ser do mesmo programa).");
  }
  const [e] = await db.insert(schema.toolEntries).values({ programId, toolSlug: slug, offerId: opts.offerId || null, title: opts.title?.trim() || null, createdBy: actor.userId, updatedBy: actor.userId }).returning();
  await audit({ actorId: actor.userId, entityType: "tool_entry", entityId: e.id, action: "tool_entry.create", after: { programId, slug, offerId: e.offerId } });
  return e;
}

export async function getEntry(actor: AuthContext, entryId: string) {
  const db = await getDb();
  const [entry] = await db.select().from(schema.toolEntries).where(eq(schema.toolEntries.id, entryId)).limit(1);
  if (!entry) throw new ValidationError("Entrada não encontrada.");
  const { program, mentee } = await viewable(actor, entry.programId);
  const [[tool], links, [offer], gates] = await Promise.all([
    db.select().from(schema.tools).where(eq(schema.tools.slug, entry.toolSlug)).limit(1),
    db.select().from(schema.toolGateLinks).where(eq(schema.toolGateLinks.toolSlug, entry.toolSlug)),
    entry.offerId ? db.select().from(schema.offers).where(eq(schema.offers.id, entry.offerId)).limit(1) : Promise.resolve([] as (typeof schema.offers.$inferSelect)[]),
    db.select().from(schema.programGates).where(eq(schema.programGates.programId, entry.programId)),
  ]);
  return {
    entry, tool, program, mentee, offer: offer ?? null, canReview: canEditProgram(actor, toRef(mentee)),
    linkedGates: links.map((l) => ({ key: l.gateKey, label: gates.find((g) => g.key === l.gateKey)?.label ?? l.gateKey })),
  };
}

export interface SaveResult { status: "rascunho" | "concluida"; marked: string[]; warnings: string[] }

/**
 * Salva a entrada. Com `conclude`, exige os campos obrigatórios e COMPROVA os itens de portão ligados à ferramenta na oferta
 * (equipe: confirmado; mentorado: pendente). Qualquer alteração limpa a revisão anterior.
 */
export async function saveEntry(actor: AuthContext, entryId: string, data: Record<string, unknown>, conclude: boolean): Promise<SaveResult> {
  const { entry, tool, linkedGates } = await getEntry(actor, entryId);
  if (tool.kind !== "declarativa") throw new ValidationError("Ferramenta externa não tem entradas.");
  const clean = validateEntryData(tool.fields, data, conclude);
  const db = await getDb();
  await db.update(schema.toolEntries).set({ data: clean, status: conclude ? "concluida" : "rascunho", reviewedBy: null, reviewedAt: null, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(schema.toolEntries.id, entryId));
  const marked: string[] = [];
  const warnings: string[] = [];
  if (conclude && entry.offerId) {
    for (const g of linkedGates) {
      try {
        await checkGate(actor, entry.offerId, g.key, `Ferramenta "${tool.name}" concluída (entrada ${entry.id}).`);
        marked.push(g.key);
      } catch (e) {
        if (e instanceof ValidationError) warnings.push(`${g.label}: ${e.message}`);
        else throw e;
      }
    }
  }
  await audit({ actorId: actor.userId, entityType: "tool_entry", entityId: entryId, action: conclude ? "tool_entry.conclude" : "tool_entry.save", after: { slug: tool.slug, marked } });
  return { status: conclude ? "concluida" : "rascunho", marked, warnings };
}

/** A equipe revisa uma entrada concluída: conta integralmente no score e confirma os itens de portão pendentes ligados a ela. */
export async function reviewEntry(actor: AuthContext, entryId: string) {
  const { entry, canReview, linkedGates } = await getEntry(actor, entryId);
  if (!canReview) throw new ForbiddenError();
  if (entry.status !== "concluida") throw new ValidationError("Só é possível revisar entradas concluídas.");
  const db = await getDb();
  await db.update(schema.toolEntries).set({ reviewedBy: actor.userId, reviewedAt: new Date() }).where(eq(schema.toolEntries.id, entryId));
  const confirmed: string[] = [];
  if (entry.offerId) {
    for (const g of linkedGates) {
      try {
        await confirmGate(actor, entry.offerId, g.key);
        confirmed.push(g.key);
      } catch (e) {
        if (!(e instanceof ValidationError)) throw e; // sem item pendente: segue
      }
    }
  }
  await audit({ actorId: actor.userId, entityType: "tool_entry", entityId: entryId, action: "tool_entry.review", after: { confirmed } });
  return { confirmed };
}

export type { Tool };
