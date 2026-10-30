import { asc, eq, inArray, sql } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { type AuthContext, ForbiddenError, canViewMentee } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { type CardKind, type FunnelStage, type Priority, canHaveLessons, isCardKind, isPriority, isStage } from "@/lib/strategy";
import { normalizeUrl } from "@/domains/content/links";
import { toRef } from "@/domains/mentees/service";
import { loadProgram } from "@/domains/programs/service";

const MAX_CARDS_PER_OFFER = 120;
const RANK: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };

const clip = (s: string | null | undefined, max: number, what: string) => {
  const v = (s ?? "").trim();
  if (v.length > max) throw new ValidationError(`${what} é longo demais (máx. ${max} caracteres).`);
  return v || null;
};

/** Quem enxerga o mentorado (ele mesmo e a equipe com acesso) vê e edita o quadro das ofertas dele. */
async function offerAccess(actor: AuthContext, offerId: string) {
  const db = await getDb();
  const [offer] = await db.select().from(schema.offers).where(eq(schema.offers.id, offerId)).limit(1);
  if (!offer) throw new ValidationError("Oferta não encontrada.");
  const { mentee } = await loadProgram(offer.programId);
  if (!canViewMentee(actor, toRef(mentee))) throw new ForbiddenError();
  return { offer, db };
}

async function cardAccess(actor: AuthContext, cardId: string) {
  const db = await getDb();
  const [card] = await db.select().from(schema.offerCards).where(eq(schema.offerCards.id, cardId)).limit(1);
  if (!card) throw new ValidationError("Cartão não encontrado.");
  await offerAccess(actor, card.offerId);
  return { card, db };
}

export interface CardInput { kind: string; title: string; description?: string; approach?: string; objection?: string; materialUrl?: string; priority?: string; stage?: string }

function clean(input: Partial<CardInput>) {
  const out: Partial<typeof schema.offerCards.$inferInsert> = {};
  if (input.kind !== undefined) {
    if (!isCardKind(input.kind)) throw new ValidationError("Escolha se o cartão é um tipo de cliente ou de demanda.");
    out.kind = input.kind as CardKind;
  }
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new ValidationError("Dê um título ao cartão.");
    if (t.length > 160) throw new ValidationError("O título é longo demais (máx. 160 caracteres).");
    out.title = t;
  }
  if (input.description !== undefined) out.description = clip(input.description, 1000, "A descrição");
  if (input.approach !== undefined) out.approach = clip(input.approach, 1000, "A estratégia");
  if (input.objection !== undefined) out.objection = clip(input.objection, 1000, "A objeção");
  if (input.materialUrl !== undefined) {
    const u = input.materialUrl.trim();
    if (u) {
      const n = normalizeUrl(u);
      if (!n) throw new ValidationError("Informe um endereço válido para o material, começando com http:// ou https://.");
      out.materialUrl = n;
    } else out.materialUrl = null;
  }
  if (input.priority !== undefined) {
    if (!isPriority(input.priority)) throw new ValidationError("Prioridade inválida.");
    out.priority = input.priority;
  }
  if (input.stage !== undefined) {
    if (!isStage(input.stage)) throw new ValidationError("Etapa do funil inválida.");
    out.stage = input.stage as FunnelStage;
  }
  return out;
}

export async function listCards(actor: AuthContext, offerId: string) {
  const { offer, db } = await offerAccess(actor, offerId);
  const cards = await db.select().from(schema.offerCards).where(eq(schema.offerCards.offerId, offerId)).orderBy(asc(schema.offerCards.createdAt));
  const lessons = cards.length ? await db.select().from(schema.offerCardLessons).where(inArray(schema.offerCardLessons.cardId, cards.map((c) => c.id))).orderBy(asc(schema.offerCardLessons.createdAt)) : [];
  return {
    offer,
    cards: cards
      .sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.createdAt.getTime() - b.createdAt.getTime())
      .map((c) => ({ ...c, lessons: lessons.filter((l) => l.cardId === c.id) })),
  };
}

/** Quantos cartões cada oferta do programa tem (abas do quadro). */
export async function countCardsByOffer(actor: AuthContext, programId: string) {
  const { mentee } = await loadProgram(programId);
  if (!canViewMentee(actor, toRef(mentee))) throw new ForbiddenError();
  const db = await getDb();
  const rows = await db
    .select({ offerId: schema.offerCards.offerId, n: sql<number>`count(*)::int` })
    .from(schema.offerCards)
    .innerJoin(schema.offers, eq(schema.offers.id, schema.offerCards.offerId))
    .where(eq(schema.offers.programId, programId))
    .groupBy(schema.offerCards.offerId);
  return new Map(rows.map((r) => [r.offerId, r.n]));
}

export async function createCard(actor: AuthContext, offerId: string, input: CardInput) {
  const { offer, db } = await offerAccess(actor, offerId);
  const values = clean({ ...input, stage: input.stage || "primeiro_contato", priority: input.priority || "media" });
  if (!values.title) throw new ValidationError("Dê um título ao cartão.");
  if (!values.kind) throw new ValidationError("Escolha se o cartão é um tipo de cliente ou de demanda.");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.offerCards).where(eq(schema.offerCards.offerId, offerId));
  if (n >= MAX_CARDS_PER_OFFER) throw new ValidationError(`Limite de ${MAX_CARDS_PER_OFFER} cartões por oferta.`);
  const [card] = await db
    .insert(schema.offerCards)
    .values({ ...(values as typeof schema.offerCards.$inferInsert), offerId, createdBy: actor.userId, updatedBy: actor.userId })
    .returning();
  await audit({ actorId: actor.userId, entityType: "offer", entityId: offer.id, action: "strategy.card_create", after: { title: card.title, kind: card.kind, stage: card.stage } });
  return card;
}

export async function updateCard(actor: AuthContext, cardId: string, patch: Partial<CardInput>) {
  const { card, db } = await cardAccess(actor, cardId);
  const set = clean(patch);
  if (!Object.keys(set).length) return card;
  const [after] = await db.update(schema.offerCards).set({ ...set, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(schema.offerCards.id, cardId)).returning();
  await audit({
    actorId: actor.userId, entityType: "offer", entityId: card.offerId, action: set.stage && Object.keys(set).length === 1 ? "strategy.card_move" : "strategy.card_update",
    before: Object.fromEntries(Object.keys(set).map((k) => [k, (card as Record<string, unknown>)[k]])), after: set,
  });
  return after;
}

export const moveCard = (actor: AuthContext, cardId: string, stage: string) => updateCard(actor, cardId, { stage });

export async function removeCard(actor: AuthContext, cardId: string) {
  const { card, db } = await cardAccess(actor, cardId);
  await db.delete(schema.offerCards).where(eq(schema.offerCards.id, cardId));
  await audit({ actorId: actor.userId, entityType: "offer", entityId: card.offerId, action: "strategy.card_remove", before: card });
}

// ── Lições aprendidas (cartões em Perdido e Concluído) ──────────────────

const cleanLesson = (q: string, a: string) => {
  const question = q.trim();
  const answer = a.trim();
  if (!question) throw new ValidationError("Escolha ou escreva a pergunta.");
  if (question.length > 300) throw new ValidationError("A pergunta é longa demais (máx. 300 caracteres).");
  if (!answer) throw new ValidationError("Registre a resposta.");
  if (answer.length > 2000) throw new ValidationError("A resposta é longa demais (máx. 2000 caracteres).");
  return { question, answer };
};

/** Acrescenta uma lição (pergunta + resposta). Só em cartões das colunas Perdido e Concluído; não há limite além de 50 por cartão. */
export async function addLesson(actor: AuthContext, cardId: string, input: { question: string; answer: string }) {
  const { card, db } = await cardAccess(actor, cardId);
  if (!canHaveLessons(card.stage)) throw new ValidationError("Lições aprendidas ficam nos cartões das colunas Perdido e Concluído.");
  const v = cleanLesson(input.question, input.answer);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.offerCardLessons).where(eq(schema.offerCardLessons.cardId, cardId));
  if (n >= 50) throw new ValidationError("Limite de 50 lições por cartão.");
  const [l] = await db.insert(schema.offerCardLessons).values({ cardId, ...v, createdBy: actor.userId }).returning();
  await audit({ actorId: actor.userId, entityType: "offer", entityId: card.offerId, action: "strategy.lesson_add", after: { card: card.title, question: v.question } });
  return l;
}

async function lessonAccess(actor: AuthContext, lessonId: string) {
  const db = await getDb();
  const [lesson] = await db.select().from(schema.offerCardLessons).where(eq(schema.offerCardLessons.id, lessonId)).limit(1);
  if (!lesson) throw new ValidationError("Lição não encontrada.");
  const { card } = await cardAccess(actor, lesson.cardId);
  return { lesson, card, db };
}

export async function updateLesson(actor: AuthContext, lessonId: string, input: { question: string; answer: string }) {
  const { lesson, card, db } = await lessonAccess(actor, lessonId);
  const v = cleanLesson(input.question, input.answer);
  const [after] = await db.update(schema.offerCardLessons).set({ ...v, updatedAt: new Date() }).where(eq(schema.offerCardLessons.id, lessonId)).returning();
  await audit({ actorId: actor.userId, entityType: "offer", entityId: card.offerId, action: "strategy.lesson_update", before: { question: lesson.question, answer: lesson.answer }, after: v });
  return after;
}

export async function removeLesson(actor: AuthContext, lessonId: string) {
  const { lesson, card, db } = await lessonAccess(actor, lessonId);
  await db.delete(schema.offerCardLessons).where(eq(schema.offerCardLessons.id, lessonId));
  await audit({ actorId: actor.userId, entityType: "offer", entityId: card.offerId, action: "strategy.lesson_remove", before: lesson });
}
