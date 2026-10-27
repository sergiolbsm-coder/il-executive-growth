import { and, asc, eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { type AuthContext, ForbiddenError, canCreateMentee, canEditProgram, canViewMentee } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { type GatePatch, type NewGate, cleanGatePatch, cleanNewGate } from "@/domains/offers/gate-input";
import { type MenteeRow, toRef } from "@/domains/mentees/service";
import { getTemplate, type LevelPatch, type SourcePatch } from "@/domains/templates/service";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isLevel = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;
const isDate = (s?: string | null) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);

async function menteeOf(menteeId: string): Promise<MenteeRow> {
  const db = await getDb();
  const [[m], links] = await Promise.all([
    db.select().from(schema.mentees).where(eq(schema.mentees.id, menteeId)).limit(1),
    db.select().from(schema.mentorAssignments).where(eq(schema.mentorAssignments.menteeId, menteeId)),
  ]);
  if (!m) throw new ValidationError("Mentorado não encontrado.");
  return { id: m.id, fullName: m.fullName, email: m.email, segment: m.segment, active: m.active, userId: m.userId, mentorIds: links.map((l) => l.mentorId) };
}

/**
 * Abre um programa a partir de um template, COPIANDO (snapshot) catálogo e pirâmide: editar o template depois
 * não altera este programa. Somente admin/direção.
 */
export async function createProgram(
  actor: AuthContext,
  input: {
    menteeId: string; templateId: string; name: string; model?: string; purpose?: string;
    weeklyHours?: number | null; startDate?: string; endDate?: string;
  },
) {
  if (!canCreateMentee(actor)) throw new ForbiddenError();
  const name = input.name.trim();
  if (!name) throw new ValidationError("Informe o nome do programa.");
  if (!isDate(input.startDate) || !isDate(input.endDate)) throw new ValidationError("Data inválida.");
  if (input.startDate && input.endDate && input.endDate < input.startDate) throw new ValidationError("O término não pode ser anterior ao início.");
  if (input.weeklyHours != null && !(Number.isInteger(input.weeklyHours) && input.weeklyHours >= 0 && input.weeklyHours <= 168))
    throw new ValidationError("Horas por semana inválidas.");
  await menteeOf(input.menteeId);
  const t = await getTemplate(actor, input.templateId);
  if (!t.template.active) throw new ValidationError("Template inativo.");

  const db = await getDb();
  const program = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(schema.programs)
      .values({
        menteeId: input.menteeId, templateId: t.template.id, templateVersion: t.template.version, name,
        model: input.model?.trim() || t.template.model, purpose: input.purpose?.trim() || null,
        weeklyHours: input.weeklyHours ?? null, startDate: input.startDate || null, endDate: input.endDate || null,
        createdBy: actor.userId,
      })
      .returning();
    if (t.sources.length)
      await tx.insert(schema.programRevenueSources).values(
        t.sources.map((s) => ({ programId: p.id, slug: s.slug, name: s.name, level: s.level, sort: s.sort, role: s.role, isMotor: s.isMotor })),
      );
    if (t.levels.length)
      await tx.insert(schema.programPyramidLevels).values(
        t.levels.map((l) => ({ programId: p.id, level: l.level, name: l.name, volume: l.volume, ticket: l.ticket, effort: l.effort, role: l.role })),
      );
    if (t.gates.length)
      await tx.insert(schema.programGates).values(
        t.gates.map((g) => ({ programId: p.id, stage: g.stage, key: g.key, label: g.label, kind: g.kind, threshold: g.threshold, required: g.required, sort: g.sort })),
      );
    return p;
  });
  await audit({ actorId: actor.userId, entityType: "program", entityId: program.id, action: "program.create", after: { menteeId: input.menteeId, templateId: t.template.id, templateVersion: t.template.version } });
  return program;
}

export async function loadProgram(programId: string) {
  const db = await getDb();
  const [program] = await db.select().from(schema.programs).where(eq(schema.programs.id, programId)).limit(1);
  if (!program) throw new ValidationError("Programa não encontrado.");
  return { program, mentee: await menteeOf(program.menteeId) };
}

export async function getProgram(actor: AuthContext, programId: string) {
  const { program, mentee } = await loadProgram(programId);
  if (!canViewMentee(actor, toRef(mentee))) throw new ForbiddenError();
  const db = await getDb();
  const [sources, levels, gates] = await Promise.all([
    db.select().from(schema.programRevenueSources).where(eq(schema.programRevenueSources.programId, programId)).orderBy(asc(schema.programRevenueSources.sort)),
    db.select().from(schema.programPyramidLevels).where(eq(schema.programPyramidLevels.programId, programId)).orderBy(asc(schema.programPyramidLevels.level)),
    db.select().from(schema.programGates).where(eq(schema.programGates.programId, programId)).orderBy(asc(schema.programGates.stage), asc(schema.programGates.sort)),
  ]);
  return { program, mentee, sources, levels, gates, canEdit: canEditProgram(actor, toRef(mentee)) };
}

async function editable(actor: AuthContext, programId: string) {
  const { program, mentee } = await loadProgram(programId);
  if (!canEditProgram(actor, toRef(mentee))) throw new ForbiddenError();
  return program;
}

export async function updateProgram(
  actor: AuthContext,
  programId: string,
  patch: { name?: string; purpose?: string | null; weeklyHours?: number | null; startDate?: string | null; endDate?: string | null; status?: string },
) {
  const before = await editable(actor, programId);
  if (patch.name !== undefined && !patch.name.trim()) throw new ValidationError("O nome não pode ficar vazio.");
  if (!isDate(patch.startDate) || !isDate(patch.endDate)) throw new ValidationError("Data inválida.");
  if (patch.weeklyHours != null && !(Number.isInteger(patch.weeklyHours) && patch.weeklyHours >= 0 && patch.weeklyHours <= 168))
    throw new ValidationError("Horas por semana inválidas.");
  if (patch.status !== undefined && !["ativo", "pausado", "encerrado"].includes(patch.status)) throw new ValidationError("Situação inválida.");
  const set = {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.purpose !== undefined ? { purpose: patch.purpose?.trim() || null } : {}),
    ...(patch.weeklyHours !== undefined ? { weeklyHours: patch.weeklyHours } : {}),
    ...(patch.startDate !== undefined ? { startDate: patch.startDate || null } : {}),
    ...(patch.endDate !== undefined ? { endDate: patch.endDate || null } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
  };
  const sd = (set.startDate !== undefined ? set.startDate : before.startDate) ?? null;
  const ed = (set.endDate !== undefined ? set.endDate : before.endDate) ?? null;
  if (sd && ed && ed < sd) throw new ValidationError("O término não pode ser anterior ao início.");
  if (!Object.keys(set).length) return before;
  const db = await getDb();
  const [after] = await db.update(schema.programs).set({ ...set, updatedAt: new Date() }).where(eq(schema.programs.id, programId)).returning();
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "program.update", before: { ...set, ...Object.fromEntries(Object.keys(set).map((k) => [k, (before as Record<string, unknown>)[k]])) }, after: set });
  return after;
}

/** Edita um nível da Escala do Negócio DO PROGRAMA (o template não muda). */
export async function updateProgramLevel(actor: AuthContext, programId: string, level: number, patch: LevelPatch) {
  await editable(actor, programId);
  if (!isLevel(level)) throw new ValidationError("O nível deve ser de 1 a 5.");
  const set: LevelPatch = {};
  for (const k of ["name", "volume", "ticket", "effort", "role"] as const) {
    if (patch[k] === undefined) continue;
    const v = patch[k]!.trim();
    if (!v) throw new ValidationError("Campos da pirâmide não podem ficar vazios.");
    set[k] = v;
  }
  if (!Object.keys(set).length) return;
  const db = await getDb();
  const w = and(eq(schema.programPyramidLevels.programId, programId), eq(schema.programPyramidLevels.level, level));
  const [before] = await db.select().from(schema.programPyramidLevels).where(w).limit(1);
  if (!before) throw new ValidationError("Nível não encontrado.");
  await db.update(schema.programPyramidLevels).set(set).where(w);
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "program.update_level", before, after: set });
}

/** Edita uma receita do catálogo DO PROGRAMA (nome, nível, papel, motor). */
export async function updateProgramSource(actor: AuthContext, programId: string, slug: string, patch: SourcePatch) {
  await editable(actor, programId);
  if (patch.level !== undefined && !isLevel(patch.level)) throw new ValidationError("O nível deve ser de 1 a 5.");
  if (patch.name !== undefined && !patch.name.trim()) throw new ValidationError("O nome não pode ficar vazio.");
  const db = await getDb();
  const w = and(eq(schema.programRevenueSources.programId, programId), eq(schema.programRevenueSources.slug, slug));
  const [before] = await db.select().from(schema.programRevenueSources).where(w).limit(1);
  if (!before) throw new ValidationError("Receita não encontrada.");
  const set = { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) };
  await db.update(schema.programRevenueSources).set(set).where(w);
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "program.update_source", before, after: { slug, ...set } });
}

/** Acrescenta uma receita própria ao catálogo do programa (ex.: linha de serviço específica do mentorado). */
export async function addProgramSource(
  actor: AuthContext,
  programId: string,
  input: { slug: string; name: string; level: number; role?: string; isMotor?: boolean },
) {
  await editable(actor, programId);
  if (!SLUG.test(input.slug)) throw new ValidationError("Identificador inválido (use minúsculas, números e hífen).");
  if (!input.name.trim()) throw new ValidationError("Informe o nome da receita.");
  if (!isLevel(input.level)) throw new ValidationError("O nível deve ser de 1 a 5.");
  const db = await getDb();
  const existing = await db.select().from(schema.programRevenueSources).where(eq(schema.programRevenueSources.programId, programId));
  if (existing.some((s) => s.slug === input.slug)) throw new ValidationError("Já existe uma receita com este identificador.");
  await db.insert(schema.programRevenueSources).values({
    programId, slug: input.slug, name: input.name.trim(), level: input.level,
    sort: Math.max(0, ...existing.map((s) => s.sort)) + 1, role: input.role?.trim() || null, isMotor: input.isMotor ?? false,
  });
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "program.add_source", after: input });
}

/** Programas dos mentorados que o usuário pode ver (para painel e listas). */
export async function listPrograms(actor: AuthContext, preloaded?: MenteeRow[]) {
  const { listMentees } = await import("@/domains/mentees/service");
  const visible = preloaded ?? (await listMentees(actor));
  if (!visible.length) return [];
  const db = await getDb();
  const rows = await db.select().from(schema.programs).orderBy(asc(schema.programs.createdAt));
  const ids = new Set(visible.map((m) => m.id));
  return rows.filter((p) => ids.has(p.menteeId));
}

/** Edita um portão DO PROGRAMA (o template não muda). Não afeta marcações já feitas, só o que passa a ser exigido. */
export async function updateProgramGate(actor: AuthContext, programId: string, key: string, patch: GatePatch) {
  await editable(actor, programId);
  const db = await getDb();
  const w = and(eq(schema.programGates.programId, programId), eq(schema.programGates.key, key));
  const [before] = await db.select().from(schema.programGates).where(w).limit(1);
  if (!before) throw new ValidationError("Portão não encontrado.");
  const set = cleanGatePatch(patch, before.kind);
  if (!Object.keys(set).length) return;
  await db.update(schema.programGates).set(set).where(w);
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "program.update_gate", before, after: { key, ...set } });
}

/** Acrescenta um portão próprio ao programa. */
export async function addProgramGate(actor: AuthContext, programId: string, input: NewGate) {
  await editable(actor, programId);
  const g = cleanNewGate(input);
  const db = await getDb();
  const existing = await db.select().from(schema.programGates).where(eq(schema.programGates.programId, programId));
  if (existing.some((x) => x.key === g.key)) throw new ValidationError("Já existe um portão com este identificador.");
  await db.insert(schema.programGates).values({ programId, ...g, sort: Math.max(0, ...existing.map((x) => x.sort)) + 1 });
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "program.add_gate", after: g });
}
