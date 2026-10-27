import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { type AuthContext, ForbiddenError, canEditProgram, canViewMentee } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { addDays, currentWeek, isMonday, mondaysOfMonth } from "@/lib/week";
import { toRef } from "@/domains/mentees/service";
import { loadProgram } from "@/domains/programs/service";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TRAFFIC = ["verde", "amarelo", "vermelho"] as const;
const MAX_TEXT = 3000;

async function viewable(actor: AuthContext, programId: string) {
  const { program, mentee } = await loadProgram(programId);
  if (!canViewMentee(actor, toRef(mentee))) throw new ForbiddenError();
  return { program, mentee };
}

function checkWeek(weekStart: string, opts: { allowFuture?: boolean } = {}) {
  if (!isMonday(weekStart)) throw new ValidationError("A semana deve começar numa segunda-feira (AAAA-MM-DD).");
  if (!opts.allowFuture && weekStart > currentWeek()) throw new ValidationError("Não é possível registrar semanas futuras.");
}

export async function listKpis(programId: string) {
  const db = await getDb();
  return db.select().from(schema.programKpis).where(eq(schema.programKpis.programId, programId)).orderBy(asc(schema.programKpis.sort));
}

/** Dados de uma semana: KPIs com meta, valores lançados e check-in. Quem vê o mentorado pode lançar (equipe ou o próprio). */
export async function getWeek(actor: AuthContext, programId: string, weekStart: string) {
  const { program, mentee } = await viewable(actor, programId);
  checkWeek(weekStart, { allowFuture: true });
  const db = await getDb();
  const [kpis, entries, [checkin]] = await Promise.all([
    listKpis(programId),
    db.select().from(schema.kpiEntries).where(and(eq(schema.kpiEntries.programId, programId), eq(schema.kpiEntries.weekStart, weekStart))),
    db.select().from(schema.weeklyCheckins).where(and(eq(schema.weeklyCheckins.programId, programId), eq(schema.weeklyCheckins.weekStart, weekStart))).limit(1),
  ]);
  return {
    program, mentee, kpis, checkin: checkin ?? null, future: weekStart > currentWeek(),
    actuals: Object.fromEntries(entries.map((e) => [e.kpiKey, e.actual])) as Record<string, number>,
    canConfigure: canEditProgram(actor, toRef(mentee)),
  };
}

/** Lança (ou limpa, com null/vazio) os valores realizados dos KPIs da semana. */
export async function saveKpiEntries(actor: AuthContext, programId: string, weekStart: string, values: Record<string, number | null>) {
  await viewable(actor, programId);
  checkWeek(weekStart);
  const kpis = await listKpis(programId);
  const known = new Set(kpis.map((k) => k.key));
  for (const [k, v] of Object.entries(values)) {
    if (!known.has(k)) throw new ValidationError(`KPI desconhecido: ${k}.`);
    if (v !== null && (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1_000_000)) throw new ValidationError("Os valores devem ser números maiores ou iguais a zero.");
  }
  const db = await getDb();
  const keys = Object.keys(values);
  const before = keys.length ? await db.select().from(schema.kpiEntries).where(and(eq(schema.kpiEntries.programId, programId), eq(schema.kpiEntries.weekStart, weekStart), inArray(schema.kpiEntries.kpiKey, keys))) : [];
  for (const [k, v] of Object.entries(values)) {
    if (v === null) {
      await db.delete(schema.kpiEntries).where(and(eq(schema.kpiEntries.programId, programId), eq(schema.kpiEntries.weekStart, weekStart), eq(schema.kpiEntries.kpiKey, k)));
    } else {
      await db
        .insert(schema.kpiEntries)
        .values({ programId, weekStart, kpiKey: k, actual: v, updatedBy: actor.userId })
        .onConflictDoUpdate({ target: [schema.kpiEntries.programId, schema.kpiEntries.weekStart, schema.kpiEntries.kpiKey], set: { actual: v, updatedBy: actor.userId, updatedAt: new Date() } });
    }
  }
  await audit({
    actorId: actor.userId, entityType: "program", entityId: programId, action: "cadence.kpis",
    before: Object.fromEntries(before.map((b) => [b.kpiKey, b.actual])), after: { weekStart, ...values },
  });
}

export interface CheckinInput {
  plan?: string; done?: string; result?: string; adjust?: string; objection?: string; bestContent?: string; blocker?: string;
  traffic?: "verde" | "amarelo" | "vermelho" | null;
}

/** Check-in semanal (PDCA): um por programa e semana; salvar de novo atualiza. */
export async function saveCheckin(actor: AuthContext, programId: string, weekStart: string, input: CheckinInput) {
  await viewable(actor, programId);
  checkWeek(weekStart);
  if (input.traffic != null && !TRAFFIC.includes(input.traffic)) throw new ValidationError("Semáforo inválido.");
  const clip = (s?: string) => {
    const v = (s ?? "").trim();
    if (v.length > MAX_TEXT) throw new ValidationError(`Texto longo demais (máx. ${MAX_TEXT} caracteres).`);
    return v || null;
  };
  const values = {
    plan: clip(input.plan), done: clip(input.done), result: clip(input.result), adjust: clip(input.adjust),
    objection: clip(input.objection), bestContent: clip(input.bestContent), blocker: clip(input.blocker), traffic: input.traffic ?? null,
  };
  const db = await getDb();
  const [before] = await db.select().from(schema.weeklyCheckins).where(and(eq(schema.weeklyCheckins.programId, programId), eq(schema.weeklyCheckins.weekStart, weekStart))).limit(1);
  await db
    .insert(schema.weeklyCheckins)
    .values({ programId, weekStart, ...values, updatedBy: actor.userId })
    .onConflictDoUpdate({ target: [schema.weeklyCheckins.programId, schema.weeklyCheckins.weekStart], set: { ...values, updatedBy: actor.userId, updatedAt: new Date() } });
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "cadence.checkin", before: before ? { weekStart, traffic: before.traffic } : null, after: { weekStart, traffic: values.traffic } });
}

export type Attainment = "verde" | "amarelo" | "vermelho" | "sem-meta";

export interface KpiMonthRow {
  key: string; label: string; grp: string; weeklyTarget: number | null;
  target: number | null; actual: number; pct: number | null; status: Attainment;
}

/** Resumo do mês (AAAA-MM): meta (semanal × semanas já decorridas) × realizado, com semáforo (≥100% verde, ≥70% amarelo). */
export async function monthSummary(actor: AuthContext, programId: string, ym: string) {
  await viewable(actor, programId);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) throw new ValidationError("Mês inválido (AAAA-MM).");
  const weeks = mondaysOfMonth(ym).filter((w) => w <= currentWeek());
  const kpis = await listKpis(programId);
  const db = await getDb();
  const entries = weeks.length
    ? await db.select().from(schema.kpiEntries).where(and(eq(schema.kpiEntries.programId, programId), gte(schema.kpiEntries.weekStart, weeks[0]), lte(schema.kpiEntries.weekStart, weeks[weeks.length - 1])))
    : [];
  const rows: KpiMonthRow[] = kpis.map((k) => {
    const actual = entries.filter((e) => e.kpiKey === k.key).reduce((a, e) => a + e.actual, 0);
    const target = k.weeklyTarget == null ? null : k.weeklyTarget * weeks.length;
    const pct = target != null && target > 0 ? actual / target : null;
    const status: Attainment = pct == null ? "sem-meta" : pct >= 1 ? "verde" : pct >= 0.7 ? "amarelo" : "vermelho";
    return { key: k.key, label: k.label, grp: k.grp, weeklyTarget: k.weeklyTarget, target, actual, pct, status };
  });
  // Conversão contatos → reuniões, sem #DIV/0!: se não há contatos, não há taxa.
  const sum = (key: string) => rows.find((r) => r.key === key)?.actual ?? 0;
  const contacts = sum("conexoes") + sum("contatos-diretos");
  const conversion = contacts > 0 ? sum("reunioes-realizadas") / contacts : null;
  return { month: ym, weeks, rows, conversion };
}

/** Semanas recentes com check-in (do mais novo ao mais antigo). */
export async function listCheckins(actor: AuthContext, programId: string, limit = 8) {
  await viewable(actor, programId);
  const db = await getDb();
  return db.select().from(schema.weeklyCheckins).where(eq(schema.weeklyCheckins.programId, programId)).orderBy(desc(schema.weeklyCheckins.weekStart)).limit(limit);
}

/** Atingimento médio das metas (0–1, teto 1) nas últimas `n` semanas fechadas + atual; e quantas semanas tiveram check-in. Usado pelo score. */
export async function recentCadence(programId: string, n = 4) {
  const weeks = Array.from({ length: n }, (_, i) => addDays(currentWeek(), -7 * i));
  const kpis = (await listKpis(programId)).filter((k) => k.weeklyTarget != null && k.weeklyTarget > 0);
  const db = await getDb();
  const [entries, checkins] = await Promise.all([
    db.select().from(schema.kpiEntries).where(and(eq(schema.kpiEntries.programId, programId), inArray(schema.kpiEntries.weekStart, weeks))),
    db.select().from(schema.weeklyCheckins).where(and(eq(schema.weeklyCheckins.programId, programId), inArray(schema.weeklyCheckins.weekStart, weeks))),
  ]);
  let attainment: number | null = null;
  if (kpis.length) {
    let tot = 0;
    for (const k of kpis) {
      const got = entries.filter((e) => e.kpiKey === k.key).reduce((a, e) => a + e.actual, 0);
      tot += Math.min(1, got / (k.weeklyTarget! * n));
    }
    attainment = tot / kpis.length;
  }
  return { attainment, checkinWeeks: checkins.length, weeks: n };
}

export interface KpiPatch { label?: string; grp?: string; weeklyTarget?: number | null }

/** Edita um KPI DO PROGRAMA (rótulo, grupo, meta semanal). Somente equipe. */
export async function updateProgramKpi(actor: AuthContext, programId: string, key: string, patch: KpiPatch) {
  const { mentee } = await loadProgram(programId);
  if (!canEditProgram(actor, toRef(mentee))) throw new ForbiddenError();
  const set: { label?: string; grp?: string; weeklyTarget?: number | null } = {};
  if (patch.label !== undefined) {
    if (!patch.label.trim()) throw new ValidationError("O rótulo não pode ficar vazio.");
    set.label = patch.label.trim();
  }
  if (patch.grp !== undefined) {
    if (!patch.grp.trim()) throw new ValidationError("O grupo não pode ficar vazio.");
    set.grp = patch.grp.trim();
  }
  if (patch.weeklyTarget !== undefined) {
    if (patch.weeklyTarget !== null && !(Number.isFinite(patch.weeklyTarget) && patch.weeklyTarget >= 0 && patch.weeklyTarget <= 1_000_000)) throw new ValidationError("A meta semanal deve ser um número maior ou igual a zero.");
    set.weeklyTarget = patch.weeklyTarget;
  }
  const db = await getDb();
  const w = and(eq(schema.programKpis.programId, programId), eq(schema.programKpis.key, key));
  const [before] = await db.select().from(schema.programKpis).where(w).limit(1);
  if (!before) throw new ValidationError("KPI não encontrado.");
  if (!Object.keys(set).length) return;
  await db.update(schema.programKpis).set(set).where(w);
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "program.update_kpi", before, after: { key, ...set } });
}

export async function addProgramKpi(actor: AuthContext, programId: string, input: { key: string; label: string; grp?: string; weeklyTarget?: number | null }) {
  const { mentee } = await loadProgram(programId);
  if (!canEditProgram(actor, toRef(mentee))) throw new ForbiddenError();
  if (!SLUG.test(input.key)) throw new ValidationError("Identificador inválido (use minúsculas, números e hífen).");
  if (!input.label.trim()) throw new ValidationError("Informe o rótulo do KPI.");
  if (input.weeklyTarget != null && !(Number.isFinite(input.weeklyTarget) && input.weeklyTarget >= 0)) throw new ValidationError("A meta semanal deve ser um número maior ou igual a zero.");
  const existing = await listKpis(programId);
  if (existing.some((k) => k.key === input.key)) throw new ValidationError("Já existe um KPI com este identificador.");
  const db = await getDb();
  await db.insert(schema.programKpis).values({ programId, key: input.key, label: input.label.trim(), grp: input.grp?.trim() || "Prospecção", weeklyTarget: input.weeklyTarget ?? null, sort: Math.max(0, ...existing.map((k) => k.sort)) + 1 });
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "program.add_kpi", after: input });
}
