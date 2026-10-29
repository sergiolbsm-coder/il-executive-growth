import { and, asc, eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { type AuthContext, ForbiddenError, canEditProgram, canViewMentee } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { toRef } from "@/domains/mentees/service";
import { loadProgram } from "@/domains/programs/service";
import { LINK_CATEGORIES, type LinkCategory, detectKind, isLinkCategory, normalizeUrl } from "./links";

const clip = (s: string | undefined | null, max: number, what: string) => {
  const v = (s ?? "").trim();
  if (v.length > max) throw new ValidationError(`${what} é longo demais (máx. ${max} caracteres).`);
  return v || null;
};

/** Programa + quem é o usuário: `staff` edita tudo; o mentorado do programa também vê, adiciona e marca os próprios checks. */
async function access(actor: AuthContext, programId: string) {
  const { program, mentee } = await loadProgram(programId);
  if (!canViewMentee(actor, toRef(mentee))) throw new ForbiddenError();
  return { program, mentee, staff: canEditProgram(actor, toRef(mentee)) };
}

// ── Biblioteca de links: Drive, atividades e assessments ────────────────

export interface LinkInput { title: string; url: string; category?: string; description?: string }

/** Sem categoria informada: endereço do Drive → "Drive"; qualquer outro → "Atividade". */
function categoryFor(input: string | undefined, url: string): LinkCategory {
  const c = (input ?? "").trim();
  if (c) {
    if (!isLinkCategory(c)) throw new ValidationError(`Tipo inválido. Use: ${LINK_CATEGORIES.join(", ")}.`);
    return c;
  }
  return detectKind(url) === "link" ? "Atividade" : "Drive";
}

export async function listLinks(actor: AuthContext, programId: string) {
  await access(actor, programId);
  const db = await getDb();
  return db.select().from(schema.libraryLinks).where(eq(schema.libraryLinks.programId, programId)).orderBy(asc(schema.libraryLinks.createdAt));
}

/** Acrescenta um link (Drive ou qualquer endereço http/https). */
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
    .values({ programId, kind: detectKind(url), title, url, category: categoryFor(input.category, url), description: clip(input.description, 500, "A descrição"), createdBy: actor.userId })
    .returning();
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "library.add", after: { title, kind: l.kind, category: l.category } });
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
  let url = l.url;
  if (patch.url !== undefined) {
    const n = normalizeUrl(patch.url);
    if (!n) throw new ValidationError("Informe um endereço válido, começando com http:// ou https://.");
    url = n;
    set.url = n;
    set.kind = detectKind(n);
  }
  if (patch.category !== undefined) set.category = categoryFor(patch.category, url);
  if (patch.description !== undefined) set.description = clip(patch.description, 500, "A descrição");
  if (!Object.keys(set).length) return l;
  const db = await getDb();
  const [after] = await db.update(schema.libraryLinks).set({ ...set, updatedAt: new Date() }).where(eq(schema.libraryLinks.id, linkId)).returning();
  await audit({ actorId: actor.userId, entityType: "program", entityId: l.programId, action: "library.update", before: { title: l.title, url: l.url, category: l.category }, after: set });
  return after;
}

/** Check "já fiz / já acessei": o mentorado (ou a equipe) marca e desmarca, em qualquer link do programa. */
export async function setLinkDone(actor: AuthContext, linkId: string, done: boolean) {
  const db = await getDb();
  const [l] = await db.select().from(schema.libraryLinks).where(eq(schema.libraryLinks.id, linkId)).limit(1);
  if (!l) throw new ValidationError("Link não encontrado.");
  await access(actor, l.programId);
  await db
    .update(schema.libraryLinks)
    .set(done ? { done: true, doneAt: new Date(), doneBy: actor.userId } : { done: false, doneAt: null, doneBy: null })
    .where(and(eq(schema.libraryLinks.id, linkId)));
  await audit({ actorId: actor.userId, entityType: "program", entityId: l.programId, action: done ? "library.done" : "library.undone", after: { title: l.title } });
}

export async function removeLink(actor: AuthContext, linkId: string) {
  const l = await ownLink(actor, linkId);
  const db = await getDb();
  await db.delete(schema.libraryLinks).where(eq(schema.libraryLinks.id, linkId));
  await audit({ actorId: actor.userId, entityType: "program", entityId: l.programId, action: "library.remove", before: l });
}
