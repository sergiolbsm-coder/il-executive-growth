import { count, desc, eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { type AuthContext, ForbiddenError, canEditProgram, canViewMentee } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { currentWeek } from "@/lib/week";
import { recentCadence } from "@/domains/cadence/service";
import { toRef } from "@/domains/mentees/service";
import { listOffers } from "@/domains/offers/service";
import { loadProgram } from "@/domains/programs/service";
import { listProgramTools } from "@/domains/tools/service";
import { SCORE_KEYS, type ScoreResult, computeScore, normalizeWeights } from "./compute";

async function viewable(actor: AuthContext, programId: string) {
  const { program, mentee } = await loadProgram(programId);
  if (!canViewMentee(actor, toRef(mentee))) throw new ForbiddenError();
  return { program, mentee };
}

/** Calcula o Score de Alavancagem do programa na hora (nada é gravado). */
export async function getScore(actor: AuthContext, programId: string): Promise<ScoreResult & { canEdit: boolean }> {
  const { program, mentee } = await viewable(actor, programId);
  const db = await getDb();
  const [offers, toolsData, sources, [{ n: sessionsCount }], sales, cadence] = await Promise.all([
    listOffers(actor, programId),
    listProgramTools(actor, programId),
    db.select().from(schema.programRevenueSources).where(eq(schema.programRevenueSources.programId, programId)),
    db.select({ n: count() }).from(schema.mentoringSessions).where(eq(schema.mentoringSessions.programId, programId)),
    db.select({ origin: schema.sales.originOfferId }).from(schema.sales).innerJoin(schema.offers, eq(schema.offers.id, schema.sales.offerId)).where(eq(schema.offers.programId, programId)),
    recentCadence(programId, 4),
  ]);
  const result = computeScore(
    {
      program: { purpose: program.purpose, weeklyHours: program.weeklyHours, startDate: program.startDate, endDate: program.endDate },
      sessionsCount,
      sources: sources.map((s) => ({ slug: s.slug, name: s.name, level: s.level })),
      offers: offers.map((o) => ({ name: o.name, level: o.level, stage: o.stage, status: o.status, priceNote: o.priceNote, dueDate: o.dueDate, wave: o.wave, problem: o.problem, audience: o.audience, revenueSlug: o.revenueSlug })),
      tools: toolsData.tools.filter((t) => t.kind === "declarativa").map((t) => ({ slug: t.slug, name: t.name, weight: t.weight, strategic: t.strategic, credit: t.best })),
      sales: sales.map((s) => ({ hasOrigin: !!s.origin })),
      cadence,
    },
    program.scoreWeights,
  );
  return { ...result, canEdit: canEditProgram(actor, toRef(mentee)) };
}

/** Grava (ou atualiza) o retrato do score da semana atual, para o histórico. */
export async function recordSnapshot(actor: AuthContext, programId: string) {
  const s = await getScore(actor, programId);
  const week = currentWeek();
  const db = await getDb();
  const components = Object.fromEntries(s.components.map((c) => [c.key, c.points]));
  await db
    .insert(schema.scoreSnapshots)
    .values({ programId, weekStart: week, total: s.total, components, weights: s.weights })
    .onConflictDoUpdate({ target: [schema.scoreSnapshots.programId, schema.scoreSnapshots.weekStart], set: { total: s.total, components, weights: s.weights, createdAt: new Date() } });
  return { weekStart: week, total: s.total };
}

export async function listSnapshots(actor: AuthContext, programId: string, limit = 12) {
  await viewable(actor, programId);
  const db = await getDb();
  return (await db.select().from(schema.scoreSnapshots).where(eq(schema.scoreSnapshots.programId, programId)).orderBy(desc(schema.scoreSnapshots.weekStart)).limit(limit)).reverse();
}

/** Edita os pesos do score DO PROGRAMA (normalizados para somar 100). Somente equipe. */
export async function updateScoreWeights(actor: AuthContext, programId: string, weights: Partial<Record<string, number>>) {
  const { program, mentee } = await loadProgram(programId);
  if (!canEditProgram(actor, toRef(mentee))) throw new ForbiddenError();
  for (const [k, v] of Object.entries(weights)) {
    if (!(SCORE_KEYS as readonly string[]).includes(k)) throw new ValidationError(`Componente desconhecido: ${k}.`);
    if (!Number.isFinite(v) || (v as number) < 0 || (v as number) > 100) throw new ValidationError("Cada peso deve estar entre 0 e 100.");
  }
  if (!SCORE_KEYS.some((k) => (weights[k] ?? 0) > 0)) throw new ValidationError("Ao menos um peso deve ser maior que zero.");
  const normalized = normalizeWeights(weights);
  const db = await getDb();
  await db.update(schema.programs).set({ scoreWeights: normalized, updatedAt: new Date() }).where(eq(schema.programs.id, programId));
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "program.score_weights", before: program.scoreWeights, after: normalized });
  return normalized;
}

