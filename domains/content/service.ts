import { and, asc, desc, eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { type AuthContext, ForbiddenError, canEditProgram, canViewMentee } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { currentWeek, isIsoDate, isMonday, mondayOf } from "@/lib/week";
import { saveKpiEntries } from "@/domains/cadence/service";
import { toRef } from "@/domains/mentees/service";
import { todayBR } from "@/domains/offers/stage";
import { loadProgram } from "@/domains/programs/service";
import { detectKind, normalizeUrl } from "./links";
import { CHANNELS, STATUSES, type Channel, type ContentStatus } from "./summary";

const clip = (s: string | undefined | null, max: number, what: string) => {
  const v = (s ?? "").trim();
  if (v.length > max) throw new ValidationError(`${what} é longo demais (máx. ${max} caracteres).`);
  return v || null;
};

/** Programa + quem é o usuário: `staff` edita tudo; `own` é o mentorado do programa (planeja o próprio conteúdo). */
async function access(actor: AuthContext, programId: string) {
  const { program, mentee } = await loadProgram(programId);
  if (!canViewMentee(actor, toRef(mentee))) throw new ForbiddenError();
  return { program, mentee, staff: canEditProgram(actor, toRef(mentee)) };
}

async function staffOnly(actor: AuthContext, programId: string) {
  const a = await access(actor, programId);
  if (!a.staff) throw new ForbiddenError();
  return a;
}

// ── Eixos (editáveis por programa) ──────────────────────────────────────

export async function listAxes(actor: AuthContext, programId: string) {
  await access(actor, programId);
  const db = await getDb();
  return db.select().from(schema.contentAxes).where(eq(schema.contentAxes.programId, programId)).orderBy(asc(schema.contentAxes.sort), asc(schema.contentAxes.createdAt));
}

export async function addAxis(actor: AuthContext, programId: string, input: { name: string; description?: string }) {
  await staffOnly(actor, programId);
  const name = input.name.trim();
  if (!name) throw new ValidationError("Informe o nome do eixo.");
  if (name.length > 80) throw new ValidationError("O nome do eixo é longo demais (máx. 80 caracteres).");
  const db = await getDb();
  const existing = await db.select().from(schema.contentAxes).where(eq(schema.contentAxes.programId, programId));
  if (existing.some((a) => a.name.toLowerCase() === name.toLowerCase())) throw new ValidationError("Já existe um eixo com este nome.");
  const [a] = await db.insert(schema.contentAxes).values({ programId, name, description: clip(input.description, 300, "A descrição"), sort: Math.max(0, ...existing.map((x) => x.sort)) + 1 }).returning();
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "content.add_axis", after: { name } });
  return a;
}

export async function updateAxis(actor: AuthContext, axisId: string, patch: { name?: string; description?: string }) {
  const db = await getDb();
  const [axis] = await db.select().from(schema.contentAxes).where(eq(schema.contentAxes.id, axisId)).limit(1);
  if (!axis) throw new ValidationError("Eixo não encontrado.");
  await staffOnly(actor, axis.programId);
  const set: { name?: string; description?: string | null } = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) throw new ValidationError("O nome do eixo não pode ficar vazio.");
    if (n.length > 80) throw new ValidationError("O nome do eixo é longo demais (máx. 80 caracteres).");
    const others = await db.select().from(schema.contentAxes).where(eq(schema.contentAxes.programId, axis.programId));
    if (others.some((o) => o.id !== axisId && o.name.toLowerCase() === n.toLowerCase())) throw new ValidationError("Já existe um eixo com este nome.");
    set.name = n;
  }
  if (patch.description !== undefined) set.description = clip(patch.description, 300, "A descrição");
  if (!Object.keys(set).length) return axis;
  const [after] = await db.update(schema.contentAxes).set(set).where(eq(schema.contentAxes.id, axisId)).returning();
  await audit({ actorId: actor.userId, entityType: "program", entityId: axis.programId, action: "content.update_axis", before: { name: axis.name, description: axis.description }, after: set });
  return after;
}

/** Remove o eixo; as publicações dele continuam, apenas ficam sem eixo. Somente equipe. */
export async function removeAxis(actor: AuthContext, axisId: string) {
  const db = await getDb();
  const [axis] = await db.select().from(schema.contentAxes).where(eq(schema.contentAxes.id, axisId)).limit(1);
  if (!axis) throw new ValidationError("Eixo não encontrado.");
  await staffOnly(actor, axis.programId);
  await db.delete(schema.contentAxes).where(eq(schema.contentAxes.id, axisId));
  await audit({ actorId: actor.userId, entityType: "program", entityId: axis.programId, action: "content.remove_axis", before: axis });
}

/** Sugestão genérica de eixos (o programa renomeia e ajusta). Só se ainda não houver nenhum. */
export async function addExampleAxes(actor: AuthContext, programId: string) {
  await staffOnly(actor, programId);
  const db = await getDb();
  const existing = await db.select().from(schema.contentAxes).where(eq(schema.contentAxes.programId, programId));
  if (existing.length) throw new ValidationError("O programa já tem eixos.");
  const ex = [
    ["Autoridade e posicionamento", "Mostra quem você é, o que defende e onde atua."],
    ["Educação do mercado", "Ensina o público a enxergar o problema que a oferta resolve."],
    ["Prova social e cases", "Resultados, depoimentos e histórias de clientes."],
  ];
  await db.insert(schema.contentAxes).values(ex.map(([name, description], i) => ({ programId, name, description, sort: i + 1 })));
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "content.example_axes" });
  return ex.length;
}

// ── Calendário editorial ────────────────────────────────────────────────

export interface ItemInput {
  weekStart: string;
  channel: string;
  title: string;
  thesis?: string;
  axisId?: string | null;
  offerId?: string | null;
  status?: ContentStatus;
  publishUrl?: string;
  publishedOn?: string | null;
  engagement?: number | null;
  leads?: number | null;
}

async function checkRefs(programId: string, axisId?: string | null, offerId?: string | null) {
  const db = await getDb();
  if (axisId) {
    const [x] = await db.select().from(schema.contentAxes).where(and(eq(schema.contentAxes.id, axisId), eq(schema.contentAxes.programId, programId))).limit(1);
    if (!x) throw new ValidationError("Eixo inválido (precisa ser do mesmo programa).");
  }
  if (offerId) {
    const [x] = await db.select().from(schema.offers).where(and(eq(schema.offers.id, offerId), eq(schema.offers.programId, programId))).limit(1);
    if (!x) throw new ValidationError("Oferta inválida (precisa ser do mesmo programa).");
  }
}

function validateItem(p: Partial<ItemInput>) {
  if (p.channel !== undefined && !(CHANNELS as readonly string[]).includes(p.channel)) throw new ValidationError("Canal inválido.");
  if (p.title !== undefined && !p.title.trim()) throw new ValidationError("Informe o título da publicação.");
  if (p.title !== undefined && p.title.trim().length > 200) throw new ValidationError("O título é longo demais (máx. 200 caracteres).");
  if (p.status !== undefined && !(STATUSES as readonly string[]).includes(p.status)) throw new ValidationError("Situação inválida.");
  if (p.weekStart !== undefined && !isIsoDate(p.weekStart)) throw new ValidationError("Semana inválida.");
  if (p.publishedOn != null && p.publishedOn !== "" && !isIsoDate(p.publishedOn)) throw new ValidationError("Data de publicação inválida.");
  if (p.publishedOn && p.publishedOn > todayBR()) throw new ValidationError("A data de publicação não pode estar no futuro.");
  for (const [k, v] of [["engagement", p.engagement], ["leads", p.leads]] as const)
    if (v != null && !(Number.isInteger(v) && v >= 0 && v <= 10_000_000)) throw new ValidationError(`${k === "leads" ? "Leads" : "Engajamento"} deve ser um inteiro maior ou igual a zero.`);
  if (p.publishUrl && !normalizeUrl(p.publishUrl)) throw new ValidationError("O link da publicação deve começar com http:// ou https://.");
}

/** Cria uma publicação no calendário. A semana é normalizada para a segunda-feira. Equipe ou o próprio mentorado. */
export async function createItem(actor: AuthContext, programId: string, input: ItemInput) {
  await access(actor, programId);
  validateItem(input);
  if (!input.channel || !input.title?.trim() || !input.weekStart) throw new ValidationError("Informe semana, canal e título.");
  await checkRefs(programId, input.axisId, input.offerId);
  const status = input.status ?? "ideia";
  const db = await getDb();
  const [i] = await db
    .insert(schema.contentItems)
    .values({
      programId, weekStart: mondayOf(input.weekStart), channel: input.channel, title: input.title.trim(), thesis: clip(input.thesis, 2000, "A tese"),
      axisId: input.axisId || null, offerId: input.offerId || null, status, publishUrl: input.publishUrl ? normalizeUrl(input.publishUrl) : null,
      publishedOn: status === "publicada" ? input.publishedOn || todayBR() : input.publishedOn || null, engagement: input.engagement ?? null, leads: input.leads ?? null, createdBy: actor.userId,
    })
    .returning();
  await audit({ actorId: actor.userId, entityType: "content_item", entityId: i.id, action: "content.create", after: { programId, title: i.title, weekStart: i.weekStart, channel: i.channel, status } });
  return i;
}

export async function updateItem(actor: AuthContext, itemId: string, patch: Partial<ItemInput>) {
  const db = await getDb();
  const [item] = await db.select().from(schema.contentItems).where(eq(schema.contentItems.id, itemId)).limit(1);
  if (!item) throw new ValidationError("Publicação não encontrada.");
  await access(actor, item.programId);
  validateItem(patch);
  if (patch.axisId !== undefined || patch.offerId !== undefined) await checkRefs(item.programId, patch.axisId, patch.offerId);
  const set: Partial<typeof schema.contentItems.$inferInsert> = {};
  if (patch.weekStart !== undefined) set.weekStart = mondayOf(patch.weekStart);
  if (patch.channel !== undefined) set.channel = patch.channel;
  if (patch.title !== undefined) set.title = patch.title.trim();
  if (patch.thesis !== undefined) set.thesis = clip(patch.thesis, 2000, "A tese");
  if (patch.axisId !== undefined) set.axisId = patch.axisId || null;
  if (patch.offerId !== undefined) set.offerId = patch.offerId || null;
  if (patch.publishUrl !== undefined) set.publishUrl = patch.publishUrl ? normalizeUrl(patch.publishUrl) : null;
  if (patch.engagement !== undefined) set.engagement = patch.engagement;
  if (patch.leads !== undefined) set.leads = patch.leads;
  if (patch.status !== undefined) {
    set.status = patch.status;
    if (patch.status === "publicada") set.publishedOn = patch.publishedOn || item.publishedOn || todayBR();
    else if (patch.publishedOn === undefined && item.status === "publicada") set.publishedOn = null; // saiu de "publicada"
  }
  if (patch.publishedOn !== undefined && patch.status === undefined) set.publishedOn = patch.publishedOn || null;
  if (!Object.keys(set).length) return item;
  const [after] = await db.update(schema.contentItems).set({ ...set, updatedAt: new Date() }).where(eq(schema.contentItems.id, itemId)).returning();
  await audit({ actorId: actor.userId, entityType: "content_item", entityId: itemId, action: "content.update", before: Object.fromEntries(Object.keys(set).map((k) => [k, (item as Record<string, unknown>)[k]])), after: set });
  return after;
}

export async function listItems(actor: AuthContext, programId: string) {
  await access(actor, programId);
  const db = await getDb();
  return db.select().from(schema.contentItems).where(eq(schema.contentItems.programId, programId)).orderBy(asc(schema.contentItems.weekStart), asc(schema.contentItems.createdAt));
}

/**
 * Atualiza os KPIs da semana a partir das publicações PUBLICADAS naquela semana: LinkedIn → "Publicações no LinkedIn",
 * artigo/newsletter → "Artigos / newsletter". Só mexe nos KPIs que existem no programa. Equipe ou o próprio mentorado.
 */
export async function syncKpisFromContent(actor: AuthContext, programId: string, weekStart: string) {
  await access(actor, programId);
  if (!isMonday(weekStart)) throw new ValidationError("A semana deve começar numa segunda-feira (AAAA-MM-DD).");
  if (weekStart > currentWeek()) throw new ValidationError("Não é possível atualizar semanas futuras.");
  const db = await getDb();
  const [items, kpis] = await Promise.all([
    db.select().from(schema.contentItems).where(and(eq(schema.contentItems.programId, programId), eq(schema.contentItems.weekStart, weekStart), eq(schema.contentItems.status, "publicada"))),
    db.select().from(schema.programKpis).where(eq(schema.programKpis.programId, programId)),
  ]);
  const known = new Set(kpis.map((k) => k.key));
  const counts: Record<string, number> = {};
  const bump = (key: string) => known.has(key) && (counts[key] = (counts[key] ?? 0) + 1);
  for (const i of items) {
    if (i.channel === "linkedin") bump("posts-linkedin");
    if (i.channel === "artigo" || i.channel === "newsletter") bump("artigos");
  }
  const targets = ["posts-linkedin", "artigos"].filter((k) => known.has(k));
  if (!targets.length) throw new ValidationError("Este programa não tem os KPIs de publicações.");
  const values = Object.fromEntries(targets.map((k) => [k, counts[k] ?? 0]));
  await saveKpiEntries(actor, programId, weekStart, values);
  return values;
}

// ── Biblioteca de links e acesso rápido ao Drive ────────────────────────

export interface LinkInput { title: string; url: string; category?: string; description?: string; pinned?: boolean }

export async function listLinks(actor: AuthContext, programId: string) {
  await access(actor, programId);
  const db = await getDb();
  return db.select().from(schema.libraryLinks).where(eq(schema.libraryLinks.programId, programId)).orderBy(desc(schema.libraryLinks.pinned), asc(schema.libraryLinks.category), asc(schema.libraryLinks.title));
}

/** Acrescenta um link (Drive ou qualquer endereço http/https). O tipo — arquivo ou pasta do Drive — é detectado pelo endereço. */
export async function addLink(actor: AuthContext, programId: string, input: LinkInput) {
  await access(actor, programId);
  const title = input.title.trim();
  if (!title) throw new ValidationError("Informe o título do link.");
  if (title.length > 200) throw new ValidationError("O título é longo demais (máx. 200 caracteres).");
  const url = normalizeUrl(input.url);
  if (!url) throw new ValidationError("Informe um endereço válido, começando com http:// ou https://.");
  const db = await getDb();
  const [l] = await db
    .insert(schema.libraryLinks)
    .values({ programId, kind: detectKind(url), title, url, category: clip(input.category, 60, "A categoria"), description: clip(input.description, 500, "A descrição"), pinned: !!input.pinned, createdBy: actor.userId })
    .returning();
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "library.add", after: { title, kind: l.kind, pinned: l.pinned } });
  return l;
}

async function ownLink(actor: AuthContext, linkId: string) {
  const db = await getDb();
  const [l] = await db.select().from(schema.libraryLinks).where(eq(schema.libraryLinks.id, linkId)).limit(1);
  if (!l) throw new ValidationError("Link não encontrado.");
  const a = await access(actor, l.programId);
  if (!a.staff && l.createdBy !== actor.userId) throw new ForbiddenError();
  return l;
}

export async function updateLink(actor: AuthContext, linkId: string, patch: Partial<LinkInput>) {
  const l = await ownLink(actor, linkId);
  const set: Partial<typeof schema.libraryLinks.$inferInsert> = {};
  if (patch.title !== undefined) {
    if (!patch.title.trim()) throw new ValidationError("Informe o título do link.");
    set.title = patch.title.trim();
  }
  if (patch.url !== undefined) {
    const url = normalizeUrl(patch.url);
    if (!url) throw new ValidationError("Informe um endereço válido, começando com http:// ou https://.");
    set.url = url;
    set.kind = detectKind(url);
  }
  if (patch.category !== undefined) set.category = clip(patch.category, 60, "A categoria");
  if (patch.description !== undefined) set.description = clip(patch.description, 500, "A descrição");
  if (patch.pinned !== undefined) set.pinned = !!patch.pinned;
  if (!Object.keys(set).length) return l;
  const db = await getDb();
  const [after] = await db.update(schema.libraryLinks).set({ ...set, updatedAt: new Date() }).where(eq(schema.libraryLinks.id, linkId)).returning();
  await audit({ actorId: actor.userId, entityType: "program", entityId: l.programId, action: "library.update", before: { title: l.title, url: l.url, pinned: l.pinned }, after: set });
  return after;
}

export async function removeLink(actor: AuthContext, linkId: string) {
  const l = await ownLink(actor, linkId);
  const db = await getDb();
  await db.delete(schema.libraryLinks).where(eq(schema.libraryLinks.id, linkId));
  await audit({ actorId: actor.userId, entityType: "program", entityId: l.programId, action: "library.remove", before: l });
}

export type { Channel };
