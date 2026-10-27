import { and, asc, eq, sql } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { type AuthContext, ForbiddenError, canManageTemplates, isStaff } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import { ValidationError } from "@/lib/errors";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function listTemplates(actor: AuthContext) {
  if (!isStaff(actor)) throw new ForbiddenError();
  const db = await getDb();
  return db
    .select({
      id: schema.programTemplates.id,
      name: schema.programTemplates.name,
      segment: schema.programTemplates.segment,
      model: schema.programTemplates.model,
      version: schema.programTemplates.version,
      active: schema.programTemplates.active,
      sources: sql<number>`(SELECT count(*)::int FROM template_revenue_sources s WHERE s.template_id = ${schema.programTemplates.id})`,
    })
    .from(schema.programTemplates)
    .orderBy(asc(schema.programTemplates.segment), asc(schema.programTemplates.model), asc(schema.programTemplates.name));
}

export async function getTemplate(actor: AuthContext, id: string) {
  if (!isStaff(actor)) throw new ForbiddenError();
  const db = await getDb();
  // Três consultas independentes em paralelo (banco remoto: 1 ida e volta em vez de 3).
  const [[template], sources, levels] = await Promise.all([
    db.select().from(schema.programTemplates).where(eq(schema.programTemplates.id, id)).limit(1),
    db.select().from(schema.templateRevenueSources).where(eq(schema.templateRevenueSources.templateId, id)).orderBy(asc(schema.templateRevenueSources.sort)),
    db.select().from(schema.templatePyramidLevels).where(eq(schema.templatePyramidLevels.templateId, id)).orderBy(asc(schema.templatePyramidLevels.level)),
  ]);
  if (!template) throw new ValidationError("Template não encontrado.");
  return { template, sources, levels };
}

/** Deriva um template (segmento/modelo) a partir de outro: copia catálogo e pirâmide. Programas existentes não são afetados. */
export async function deriveTemplate(
  actor: AuthContext,
  fromId: string,
  input: { name: string; segment: string; model: string; notes?: string },
) {
  if (!canManageTemplates(actor)) throw new ForbiddenError();
  const name = input.name.trim();
  if (!name) throw new ValidationError("Informe o nome do template.");
  const segment = input.segment.trim().toLowerCase() || "geral";
  const model = input.model.trim().toLowerCase() || "base";
  const src = await getTemplate(actor, fromId);
  const db = await getDb();
  const dup = await db.select({ id: schema.programTemplates.id }).from(schema.programTemplates).where(eq(schema.programTemplates.name, name)).limit(1);
  if (dup.length) throw new ValidationError("Já existe um template com este nome.");

  const created = await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(schema.programTemplates)
      .values({ name, segment, model, notes: input.notes ?? `Derivado de "${src.template.name}" v${src.template.version}.` })
      .returning();
    if (src.sources.length)
      await tx.insert(schema.templateRevenueSources).values(
        src.sources.map((s) => ({ templateId: t.id, slug: s.slug, name: s.name, level: s.level, sort: s.sort, role: s.role, isMotor: s.isMotor })),
      );
    if (src.levels.length)
      await tx.insert(schema.templatePyramidLevels).values(
        src.levels.map((l) => ({ templateId: t.id, level: l.level, name: l.name, volume: l.volume, ticket: l.ticket, effort: l.effort, role: l.role })),
      );
    return t;
  });
  await audit({ actorId: actor.userId, entityType: "template", entityId: created.id, action: "template.derive", after: { from: fromId, name, segment, model } });
  return created;
}

async function bump(templateId: string) {
  const db = await getDb();
  await db
    .update(schema.programTemplates)
    .set({ version: sql`${schema.programTemplates.version} + 1`, updatedAt: new Date() })
    .where(eq(schema.programTemplates.id, templateId));
}

export interface LevelPatch {
  name?: string;
  volume?: string;
  ticket?: string;
  effort?: string;
  role?: string;
}

const clean = (p: LevelPatch) => {
  const out: LevelPatch = {};
  for (const k of ["name", "volume", "ticket", "effort", "role"] as const) {
    if (p[k] === undefined) continue;
    const v = p[k]!.trim();
    if (!v) throw new ValidationError("Campos da pirâmide não podem ficar vazios.");
    out[k] = v;
  }
  return out;
};

/** Edita um nível da pirâmide do template (incrementa a versão; programas já criados não mudam). */
export async function updateTemplateLevel(actor: AuthContext, templateId: string, level: number, patch: LevelPatch) {
  if (!canManageTemplates(actor)) throw new ForbiddenError();
  const set = clean(patch);
  if (!Object.keys(set).length) return;
  const db = await getDb();
  const [before] = await db
    .select()
    .from(schema.templatePyramidLevels)
    .where(and(eq(schema.templatePyramidLevels.templateId, templateId), eq(schema.templatePyramidLevels.level, level)))
    .limit(1);
  if (!before) throw new ValidationError("Nível não encontrado.");
  await db
    .update(schema.templatePyramidLevels)
    .set(set)
    .where(and(eq(schema.templatePyramidLevels.templateId, templateId), eq(schema.templatePyramidLevels.level, level)));
  await bump(templateId);
  await audit({ actorId: actor.userId, entityType: "template", entityId: templateId, action: "template.update_level", before, after: set });
}

export interface SourcePatch {
  name?: string;
  level?: number;
  role?: string | null;
  isMotor?: boolean;
}

/** Edita uma receita do catálogo do template (nome, nível sugerido, papel, motor). */
export async function updateTemplateSource(actor: AuthContext, templateId: string, slug: string, patch: SourcePatch) {
  if (!canManageTemplates(actor)) throw new ForbiddenError();
  if (patch.level !== undefined && !(Number.isInteger(patch.level) && patch.level >= 1 && patch.level <= 5))
    throw new ValidationError("O nível deve ser de 1 a 5.");
  if (patch.name !== undefined && !patch.name.trim()) throw new ValidationError("O nome não pode ficar vazio.");
  const db = await getDb();
  const [before] = await db
    .select()
    .from(schema.templateRevenueSources)
    .where(and(eq(schema.templateRevenueSources.templateId, templateId), eq(schema.templateRevenueSources.slug, slug)))
    .limit(1);
  if (!before) throw new ValidationError("Receita não encontrada.");
  const set = { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) };
  await db
    .update(schema.templateRevenueSources)
    .set(set)
    .where(and(eq(schema.templateRevenueSources.templateId, templateId), eq(schema.templateRevenueSources.slug, slug)));
  await bump(templateId);
  await audit({ actorId: actor.userId, entityType: "template", entityId: templateId, action: "template.update_source", before, after: { slug, ...set } });
}

/** Acrescenta receita ao catálogo do template (ex.: linha de serviço própria de um segmento). */
export async function addTemplateSource(
  actor: AuthContext,
  templateId: string,
  input: { slug: string; name: string; level: number; role?: string; isMotor?: boolean },
) {
  if (!canManageTemplates(actor)) throw new ForbiddenError();
  if (!SLUG.test(input.slug)) throw new ValidationError("Identificador inválido (use minúsculas, números e hífen).");
  if (!input.name.trim()) throw new ValidationError("Informe o nome da receita.");
  if (!(Number.isInteger(input.level) && input.level >= 1 && input.level <= 5)) throw new ValidationError("O nível deve ser de 1 a 5.");
  const db = await getDb();
  const existing = await db.select().from(schema.templateRevenueSources).where(eq(schema.templateRevenueSources.templateId, templateId));
  if (existing.some((s) => s.slug === input.slug)) throw new ValidationError("Já existe uma receita com este identificador.");
  await db.insert(schema.templateRevenueSources).values({
    templateId, slug: input.slug, name: input.name.trim(), level: input.level,
    sort: Math.max(0, ...existing.map((s) => s.sort)) + 1, role: input.role?.trim() || null, isMotor: input.isMotor ?? false,
  });
  await bump(templateId);
  await audit({ actorId: actor.userId, entityType: "template", entityId: templateId, action: "template.add_source", after: input });
}
