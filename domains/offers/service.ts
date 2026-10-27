import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { audit } from "@/lib/audit";
import { type AuthContext, ForbiddenError, canDeleteRecords, canEditProgram, canViewMentee, isStaff } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import type { Offer } from "@/lib/db/schema";
import { ValidationError } from "@/lib/errors";
import { listMentees, toRef } from "@/domains/mentees/service";
import { loadProgram } from "@/domains/programs/service";
import { type GateDef, type ScheduleStatus, computeStage, scheduleStatus, todayBR } from "./stage";

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isInt = (n: unknown, min: number, max: number): n is number => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;

export interface OfferView extends Offer {
  stage: number;
  missing: GateDef[];
  salesCount: number;
  schedule: ScheduleStatus;
  pendingChecks: number;
}

type GateRow = typeof schema.programGates.$inferSelect;
type CheckRow = typeof schema.offerGateChecks.$inferSelect;

const toGateDef = (g: GateRow): GateDef => ({ key: g.key, stage: g.stage, kind: g.kind, threshold: g.threshold, required: g.required });

function derive(offer: Offer, gates: GateRow[], checks: CheckRow[], salesCount: number, today: string): OfferView {
  const confirmed = new Set(checks.filter((c) => c.state === "confirmado").map((c) => c.gateKey));
  const { stage, missing } = computeStage(gates.map(toGateDef), confirmed, salesCount);
  return {
    ...offer,
    stage,
    missing,
    salesCount,
    schedule: scheduleStatus(stage, offer.targetStage, offer.dueDate, today),
    pendingChecks: checks.filter((c) => c.state === "pendente").length,
  };
}

/** Programa + mentorado, exigindo que o usuário possa VER. */
async function viewable(actor: AuthContext, programId: string) {
  const { program, mentee } = await loadProgram(programId);
  if (!canViewMentee(actor, toRef(mentee))) throw new ForbiddenError();
  return { program, mentee };
}

async function loadOffer(offerId: string) {
  const db = await getDb();
  const [offer] = await db.select().from(schema.offers).where(eq(schema.offers.id, offerId)).limit(1);
  if (!offer) throw new ValidationError("Oferta não encontrada.");
  const { program, mentee } = await loadProgram(offer.programId);
  return { offer, program, mentee };
}

/** Oferta que o usuário pode editar (equipe com acesso ao mentorado). */
async function editableOffer(actor: AuthContext, offerId: string) {
  const r = await loadOffer(offerId);
  if (!canEditProgram(actor, toRef(r.mentee))) throw new ForbiddenError();
  return r;
}

export async function listOffers(actor: AuthContext, programId: string): Promise<OfferView[]> {
  await viewable(actor, programId);
  const db = await getDb();
  const [gates, offers, checks, counts] = await Promise.all([
    db.select().from(schema.programGates).where(eq(schema.programGates.programId, programId)),
    db.select().from(schema.offers).where(eq(schema.offers.programId, programId)).orderBy(asc(schema.offers.createdAt)),
    db
      .select({ c: schema.offerGateChecks })
      .from(schema.offerGateChecks)
      .innerJoin(schema.offers, eq(schema.offers.id, schema.offerGateChecks.offerId))
      .where(eq(schema.offers.programId, programId)),
    db
      .select({ offerId: schema.sales.offerId, n: sql<number>`count(*)::int` })
      .from(schema.sales)
      .innerJoin(schema.offers, eq(schema.offers.id, schema.sales.offerId))
      .where(eq(schema.offers.programId, programId))
      .groupBy(schema.sales.offerId),
  ]);
  const today = todayBR();
  return offers.map((o) =>
    derive(o, gates, checks.map((x) => x.c).filter((c) => c.offerId === o.id), counts.find((c) => c.offerId === o.id)?.n ?? 0, today),
  );
}

export async function getOffer(actor: AuthContext, offerId: string) {
  const { offer, program, mentee } = await loadOffer(offerId);
  if (!canViewMentee(actor, toRef(mentee))) throw new ForbiddenError();
  const db = await getDb();
  const [gates, checks, sales, siblings] = await Promise.all([
    db.select().from(schema.programGates).where(eq(schema.programGates.programId, program.id)).orderBy(asc(schema.programGates.stage), asc(schema.programGates.sort)),
    db.select().from(schema.offerGateChecks).where(eq(schema.offerGateChecks.offerId, offerId)),
    db.select().from(schema.sales).where(eq(schema.sales.offerId, offerId)).orderBy(desc(schema.sales.soldAt)),
    db.select({ id: schema.offers.id, name: schema.offers.name }).from(schema.offers).where(eq(schema.offers.programId, program.id)).orderBy(asc(schema.offers.name)),
  ]);
  const view = derive(offer, gates, checks, sales.length, todayBR());
  const ids = [...new Set([...checks.flatMap((c) => [c.checkedBy, c.confirmedBy]), ...sales.map((s) => s.createdBy)].filter((x): x is string => !!x))];
  const people: Record<string, string> = {};
  if (ids.length) for (const u of await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, ids))) people[u.id] = u.name;
  return { offer: view, program, mentee, gates, checks, sales, siblings, people, canEdit: canEditProgram(actor, toRef(mentee)) };
}

export interface NewOffer {
  revenueSlug: string;
  name: string;
  problem: string;
  audience: string;
  level?: number;
  priceNote?: string;
  wave?: number | null;
  dueDate?: string | null;
  targetStage?: number;
}

function validateCommon(p: Partial<NewOffer>) {
  if (p.name !== undefined && !p.name.trim()) throw new ValidationError("Informe o nome da oferta.");
  if (p.problem !== undefined && !p.problem.trim()) throw new ValidationError("Informe o problema que a oferta resolve.");
  if (p.audience !== undefined && !p.audience.trim()) throw new ValidationError("Informe o público da oferta.");
  if (p.level !== undefined && !isInt(p.level, 1, 5)) throw new ValidationError("O nível deve ser de 1 a 5.");
  if (p.wave != null && !isInt(p.wave, 1, 3)) throw new ValidationError("A onda deve ser 1, 2 ou 3.");
  if (p.dueDate != null && p.dueDate !== "" && !isDate(p.dueDate)) throw new ValidationError("Data inválida.");
  if (p.targetStage !== undefined && !isInt(p.targetStage, 1, 7)) throw new ValidationError("A meta de estágio deve ser de 1 a 7.");
}

/** Cria a oferta em Ideia (1): exige receita, nome, problema e público. Somente equipe. */
export async function createOffer(actor: AuthContext, programId: string, input: NewOffer) {
  const { program, mentee } = await loadProgram(programId);
  if (!canEditProgram(actor, toRef(mentee))) throw new ForbiddenError();
  validateCommon(input);
  if (!input.name?.trim() || !input.problem?.trim() || !input.audience?.trim()) throw new ValidationError("Informe nome, problema e público.");
  const db = await getDb();
  const [src] = await db
    .select()
    .from(schema.programRevenueSources)
    .where(and(eq(schema.programRevenueSources.programId, programId), eq(schema.programRevenueSources.slug, input.revenueSlug)))
    .limit(1);
  if (!src) throw new ValidationError("Receita não encontrada neste programa.");
  const [o] = await db
    .insert(schema.offers)
    .values({
      programId, revenueSlug: src.slug, name: input.name.trim(), level: input.level ?? src.level,
      problem: input.problem.trim(), audience: input.audience.trim(), priceNote: input.priceNote?.trim() || null,
      wave: input.wave ?? null, dueDate: input.dueDate || null, targetStage: input.targetStage ?? 3, createdBy: actor.userId,
    })
    .returning();
  await audit({ actorId: actor.userId, entityType: "offer", entityId: o.id, action: "offer.create", after: { programId: program.id, revenueSlug: o.revenueSlug, name: o.name } });
  return o;
}

export type OfferPatch = Partial<Pick<NewOffer, "name" | "problem" | "audience" | "level" | "priceNote" | "wave" | "dueDate" | "targetStage">>;

export async function updateOffer(actor: AuthContext, offerId: string, patch: OfferPatch) {
  const { offer } = await editableOffer(actor, offerId);
  validateCommon(patch);
  const set: Partial<typeof schema.offers.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.problem !== undefined) set.problem = patch.problem.trim();
  if (patch.audience !== undefined) set.audience = patch.audience.trim();
  if (patch.level !== undefined) set.level = patch.level;
  if (patch.priceNote !== undefined) set.priceNote = patch.priceNote?.trim() || null;
  if (patch.wave !== undefined) set.wave = patch.wave;
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate || null;
  if (patch.targetStage !== undefined) set.targetStage = patch.targetStage;
  if (!Object.keys(set).length) return offer;
  const db = await getDb();
  const [after] = await db.update(schema.offers).set({ ...set, updatedAt: new Date() }).where(eq(schema.offers.id, offerId)).returning();
  await audit({
    actorId: actor.userId, entityType: "offer", entityId: offerId, action: "offer.update",
    before: Object.fromEntries(Object.keys(set).map((k) => [k, (offer as Record<string, unknown>)[k]])), after: set,
  });
  return after;
}

/** Pausar/descartar exige motivo (fica no histórico); reativar limpa o motivo. Nada é apagado. */
export async function setOfferStatus(actor: AuthContext, offerId: string, status: "ativa" | "pausada" | "descartada", reason?: string) {
  const { offer } = await editableOffer(actor, offerId);
  if (!["ativa", "pausada", "descartada"].includes(status)) throw new ValidationError("Situação inválida.");
  const why = reason?.trim() ?? "";
  if (status !== "ativa" && why.length < 3) throw new ValidationError("Informe o motivo para pausar ou descartar a oferta.");
  const db = await getDb();
  await db.update(schema.offers).set({ status, statusReason: status === "ativa" ? null : why, updatedAt: new Date() }).where(eq(schema.offers.id, offerId));
  await audit({ actorId: actor.userId, entityType: "offer", entityId: offerId, action: "offer.status", before: { status: offer.status, reason: offer.statusReason }, after: { status, reason: why || null } });
}

async function gateOf(programId: string, key: string) {
  const db = await getDb();
  const [g] = await db.select().from(schema.programGates).where(and(eq(schema.programGates.programId, programId), eq(schema.programGates.key, key))).limit(1);
  if (!g) throw new ValidationError("Portão não encontrado neste programa.");
  return g;
}

/**
 * Marca um item de portão com evidência. Equipe: já fica CONFIRMADO. Mentorado (o próprio): fica PENDENTE até a equipe confirmar.
 * Portões de vendas não se marcam: são calculados pelas vendas registradas.
 */
export async function checkGate(actor: AuthContext, offerId: string, gateKey: string, evidence: string) {
  const { offer, program, mentee } = await loadOffer(offerId);
  const staff = canEditProgram(actor, toRef(mentee));
  const own = actor.role === "mentorado" && canViewMentee(actor, toRef(mentee));
  if (!staff && !own) throw new ForbiddenError();
  if (offer.status !== "ativa") throw new ValidationError("Reative a oferta antes de marcar portões.");
  const gate = await gateOf(program.id, gateKey);
  if (gate.kind === "vendas") throw new ValidationError("Este portão é calculado pelas vendas registradas.");
  const ev = evidence.trim();
  if (ev.length < 3) throw new ValidationError("Informe a evidência (texto ou link).");
  if (ev.length > 2000) throw new ValidationError("A evidência é longa demais (máx. 2000 caracteres).");

  const db = await getDb();
  const [existing] = await db.select().from(schema.offerGateChecks).where(and(eq(schema.offerGateChecks.offerId, offerId), eq(schema.offerGateChecks.gateKey, gateKey))).limit(1);
  if (existing?.state === "confirmado" && !staff) throw new ValidationError("Este item já foi confirmado pela equipe.");
  const state = staff ? "confirmado" : "pendente";
  const values = {
    evidence: ev, state, checkedBy: actor.userId, checkedAt: new Date(),
    confirmedBy: staff ? actor.userId : null, confirmedAt: staff ? new Date() : null,
  } as const;
  if (existing) await db.update(schema.offerGateChecks).set(values).where(eq(schema.offerGateChecks.id, existing.id));
  else await db.insert(schema.offerGateChecks).values({ offerId, gateKey, ...values });
  await audit({ actorId: actor.userId, entityType: "offer", entityId: offerId, action: "offer.gate_check", before: existing ? { state: existing.state, evidence: existing.evidence } : null, after: { gateKey, state } });
  return state;
}

/** A equipe confirma um item que o mentorado marcou (pendente → confirmado). */
export async function confirmGate(actor: AuthContext, offerId: string, gateKey: string) {
  await editableOffer(actor, offerId);
  const db = await getDb();
  const [c] = await db.select().from(schema.offerGateChecks).where(and(eq(schema.offerGateChecks.offerId, offerId), eq(schema.offerGateChecks.gateKey, gateKey))).limit(1);
  if (!c || c.state !== "pendente") throw new ValidationError("Não há item pendente para confirmar.");
  await db.update(schema.offerGateChecks).set({ state: "confirmado", confirmedBy: actor.userId, confirmedAt: new Date() }).where(eq(schema.offerGateChecks.id, c.id));
  await audit({ actorId: actor.userId, entityType: "offer", entityId: offerId, action: "offer.gate_confirm", after: { gateKey } });
}

/** A equipe desmarca um item (o estágio pode voltar). Fica na auditoria com a evidência anterior. */
export async function uncheckGate(actor: AuthContext, offerId: string, gateKey: string) {
  await editableOffer(actor, offerId);
  const db = await getDb();
  const [c] = await db.select().from(schema.offerGateChecks).where(and(eq(schema.offerGateChecks.offerId, offerId), eq(schema.offerGateChecks.gateKey, gateKey))).limit(1);
  if (!c) throw new ValidationError("Este item não está marcado.");
  await db.delete(schema.offerGateChecks).where(eq(schema.offerGateChecks.id, c.id));
  await audit({ actorId: actor.userId, entityType: "offer", entityId: offerId, action: "offer.gate_uncheck", before: { gateKey, state: c.state, evidence: c.evidence } });
}

export interface NewSale {
  clientName: string;
  valueCents: number;
  soldAt: string;
  channel?: string;
  originOfferId?: string | null;
  notes?: string;
}

/** Registra uma venda (somente equipe). É a única forma de alcançar o estágio 5 em diante. */
export async function recordSale(actor: AuthContext, offerId: string, input: NewSale) {
  const { offer } = await editableOffer(actor, offerId);
  if (offer.status !== "ativa") throw new ValidationError("Reative a oferta antes de registrar vendas.");
  const client = input.clientName.trim();
  if (!client) throw new ValidationError("Informe o cliente.");
  if (!Number.isInteger(input.valueCents) || input.valueCents <= 0) throw new ValidationError("O valor deve ser maior que zero.");
  if (!isDate(input.soldAt)) throw new ValidationError("Informe a data da venda.");
  if (input.soldAt > todayBR()) throw new ValidationError("A data da venda não pode estar no futuro.");
  const db = await getDb();
  let origin: string | null = null;
  if (input.originOfferId) {
    if (input.originOfferId === offerId) throw new ValidationError("A oferta de origem deve ser outra oferta.");
    const [o] = await db.select().from(schema.offers).where(and(eq(schema.offers.id, input.originOfferId), eq(schema.offers.programId, offer.programId))).limit(1);
    if (!o) throw new ValidationError("Oferta de origem inválida (precisa ser do mesmo programa).");
    origin = o.id;
  }
  const [s] = await db
    .insert(schema.sales)
    .values({ offerId, clientName: client, valueCents: input.valueCents, soldAt: input.soldAt, channel: input.channel?.trim() || null, originOfferId: origin, notes: input.notes?.trim() || null, createdBy: actor.userId })
    .returning();
  await audit({ actorId: actor.userId, entityType: "offer", entityId: offerId, action: "offer.sale", after: { saleId: s.id, valueCents: s.valueCents, origin } });
  return s;
}

/** Remover venda: somente administração; o registro completo fica na auditoria. */
export async function removeSale(actor: AuthContext, saleId: string) {
  if (!canDeleteRecords(actor)) throw new ForbiddenError();
  const db = await getDb();
  const [s] = await db.select().from(schema.sales).where(eq(schema.sales.id, saleId)).limit(1);
  if (!s) throw new ValidationError("Venda não encontrada.");
  await db.delete(schema.sales).where(eq(schema.sales.id, saleId));
  await audit({ actorId: actor.userId, entityType: "offer", entityId: s.offerId, action: "offer.sale_remove", before: s });
}

/** Itens de portão marcados pelo mentorado que aguardam confirmação, nos mentorados que a equipe pode ver. */
export async function listPendingGates(actor: AuthContext) {
  if (!isStaff(actor)) throw new ForbiddenError();
  const ids = (await listMentees(actor)).map((m) => m.id);
  if (!ids.length) return [];
  const db = await getDb();
  const rows = await db
    .select({
      offerId: schema.offers.id, offerName: schema.offers.name, offerStatus: schema.offers.status,
      programId: schema.programs.id, programName: schema.programs.name, menteeName: schema.mentees.fullName,
      gateKey: schema.offerGateChecks.gateKey, gateLabel: schema.programGates.label,
      evidence: schema.offerGateChecks.evidence, checkedBy: schema.offerGateChecks.checkedBy, checkedAt: schema.offerGateChecks.checkedAt,
    })
    .from(schema.offerGateChecks)
    .innerJoin(schema.offers, eq(schema.offers.id, schema.offerGateChecks.offerId))
    .innerJoin(schema.programs, eq(schema.programs.id, schema.offers.programId))
    .innerJoin(schema.mentees, eq(schema.mentees.id, schema.programs.menteeId))
    .leftJoin(schema.programGates, and(eq(schema.programGates.programId, schema.programs.id), eq(schema.programGates.key, schema.offerGateChecks.gateKey)))
    .where(and(eq(schema.offerGateChecks.state, "pendente"), inArray(schema.mentees.id, ids)))
    .orderBy(asc(schema.offerGateChecks.checkedAt));
  const who = [...new Set(rows.map((r) => r.checkedBy).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (who.length) for (const u of await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, who))) names.set(u.id, u.name);
  return rows.map((r) => ({ ...r, gateLabel: r.gateLabel ?? r.gateKey, checkedByName: r.checkedBy ? (names.get(r.checkedBy) ?? null) : null }));
}

/** Todas as vendas dos mentorados que o usuário pode ver (mentorado: as próprias), com a oferta de origem. */
export async function listSalesForActor(actor: AuthContext) {
  const ids = (await listMentees(actor)).map((m) => m.id);
  if (!ids.length) return [];
  const db = await getDb();
  const origin = alias(schema.offers, "origin");
  return db
    .select({
      id: schema.sales.id, soldAt: schema.sales.soldAt, clientName: schema.sales.clientName, valueCents: schema.sales.valueCents,
      channel: schema.sales.channel, offerId: schema.offers.id, offerName: schema.offers.name, offerLevel: schema.offers.level,
      programId: schema.programs.id, programName: schema.programs.name, menteeName: schema.mentees.fullName,
      originOfferId: schema.sales.originOfferId, originName: origin.name,
    })
    .from(schema.sales)
    .innerJoin(schema.offers, eq(schema.offers.id, schema.sales.offerId))
    .innerJoin(schema.programs, eq(schema.programs.id, schema.offers.programId))
    .innerJoin(schema.mentees, eq(schema.mentees.id, schema.programs.menteeId))
    .leftJoin(origin, eq(origin.id, schema.sales.originOfferId))
    .where(inArray(schema.mentees.id, ids))
    .orderBy(desc(schema.sales.soldAt), desc(schema.sales.createdAt));
}

/** Vendas realizadas por nível da Escala do Negócio (nível da OFERTA) em um programa. */
export async function salesByLevel(actor: AuthContext, programId: string) {
  await viewable(actor, programId);
  const db = await getDb();
  const rows = await db
    .select({ level: schema.offers.level, n: sql<number>`count(${schema.sales.id})::int`, cents: sql<string>`coalesce(sum(${schema.sales.valueCents}), 0)::text` })
    .from(schema.offers)
    .leftJoin(schema.sales, eq(schema.sales.offerId, schema.offers.id))
    .where(eq(schema.offers.programId, programId))
    .groupBy(schema.offers.level);
  return new Map(rows.map((r) => [r.level, { sales: r.n, cents: Number(r.cents) }]));
}
