import { and, asc, eq, inArray } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { normalizeEmail } from "@/lib/auth/core";
import { type AuthContext, type MenteeRef, ForbiddenError, canCreateMentee, canViewMentee } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { type AccessGrant, applyUserIdentity, createUser } from "@/domains/users/service";

export interface MenteeRow {
  id: string;
  fullName: string;
  email: string | null;
  segment: string | null;
  active: boolean;
  userId: string | null;
  mentorIds: string[];
}

async function loadMentees(ids?: string[]): Promise<MenteeRow[]> {
  const db = await getDb();
  const base = db.select().from(schema.mentees);
  const q = (ids ? base.where(inArray(schema.mentees.id, ids)) : base).orderBy(asc(schema.mentees.fullName));
  // Banco remoto (Neon em São Paulo): sem filtro, busca mentorados e vínculos em paralelo (1 ida e volta, não 2).
  const [rows, links] = ids
    ? await q.then(async (r) => [r, r.length ? await db.select().from(schema.mentorAssignments).where(inArray(schema.mentorAssignments.menteeId, r.map((x) => x.id))) : []] as const)
    : await Promise.all([q, db.select().from(schema.mentorAssignments)]);
  if (!rows.length) return [];
  return rows.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    email: m.email,
    segment: m.segment,
    active: m.active,
    userId: m.userId,
    mentorIds: links.filter((l) => l.menteeId === m.id).map((l) => l.mentorId),
  }));
}

export const toRef = (m: MenteeRow): MenteeRef => ({ userId: m.userId, mentorIds: m.mentorIds });

async function assertMentors(mentorIds: string[]) {
  const ids = [...new Set(mentorIds)];
  if (!ids.length) return ids;
  const db = await getDb();
  const ok = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(inArray(schema.users.id, ids), eq(schema.users.role, "mentor"), eq(schema.users.active, true)));
  if (ok.length !== ids.length) throw new ValidationError("Mentor inválido ou inativo na seleção.");
  return ids;
}

/**
 * Cadastra mentorado (admin/direção). Com `createAccess`, cria também o login (papel mentorado) com senha
 * provisória; sem ele, é um pré-cadastro sem acesso.
 */
export async function createMentee(
  actor: AuthContext,
  input: { fullName: string; email?: string; segment?: string; mentorIds?: string[]; createAccess?: boolean; sendEmail?: boolean },
): Promise<{ mentee: MenteeRow; grant?: AccessGrant }> {
  if (!canCreateMentee(actor)) throw new ForbiddenError();
  const fullName = input.fullName.trim();
  if (!fullName) throw new ValidationError("Informe o nome do mentorado.");
  const email = input.email?.trim() ? normalizeEmail(input.email) : null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError("E-mail inválido.");
  if (input.createAccess && !email) throw new ValidationError("Informe o e-mail para criar o acesso.");
  const mentorIds = await assertMentors(input.mentorIds ?? []);

  let grant: AccessGrant | undefined;
  if (input.createAccess && email) {
    // actor null: a permissão (admin/direção) já foi checada acima; createUser de admin exigiria canManageUsers.
    grant = await createUser(null, { name: fullName, email, role: "mentorado", sendEmail: input.sendEmail });
  }
  const db = await getDb();
  const [m] = await db
    .insert(schema.mentees)
    .values({ fullName, email, segment: input.segment?.trim() || null, userId: grant?.user.id ?? null, createdBy: actor.userId })
    .returning();
  if (mentorIds.length) await db.insert(schema.mentorAssignments).values(mentorIds.map((mentorId) => ({ menteeId: m.id, mentorId })));
  await audit({ actorId: actor.userId, entityType: "mentee", entityId: m.id, action: "mentee.create", after: { segment: m.segment, mentorIds, withAccess: !!grant } });
  const [row] = await loadMentees([m.id]);
  return { mentee: row, grant };
}

/** Lista só o que o usuário pode ver (admin/direção: todos; mentor: escopo; mentorado: o próprio). */
export async function listMentees(actor: AuthContext): Promise<MenteeRow[]> {
  const all = await loadMentees();
  return all.filter((m) => canViewMentee(actor, toRef(m)));
}

export async function getMentee(actor: AuthContext, id: string) {
  const [m] = await loadMentees([id]);
  if (!m || !canViewMentee(actor, toRef(m))) throw new ForbiddenError();
  const db = await getDb();
  const [mentors, programs] = await Promise.all([
    m.mentorIds.length
      ? db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, m.mentorIds))
      : Promise.resolve([] as { id: string; name: string }[]),
    db.select().from(schema.programs).where(eq(schema.programs.menteeId, id)).orderBy(asc(schema.programs.createdAt)),
  ]);
  return { mentee: m, mentors, programs };
}

/** Substitui os mentores atribuídos (admin/direção). */
export async function assignMentors(actor: AuthContext, menteeId: string, mentorIds: string[]) {
  if (!canCreateMentee(actor)) throw new ForbiddenError();
  const ids = await assertMentors(mentorIds);
  const [m] = await loadMentees([menteeId]);
  if (!m) throw new ValidationError("Mentorado não encontrado.");
  const db = await getDb();
  await db.delete(schema.mentorAssignments).where(eq(schema.mentorAssignments.menteeId, menteeId));
  if (ids.length) await db.insert(schema.mentorAssignments).values(ids.map((mentorId) => ({ menteeId, mentorId })));
  await audit({ actorId: actor.userId, entityType: "mentee", entityId: menteeId, action: "mentee.assign_mentors", before: { mentorIds: m.mentorIds }, after: { mentorIds: ids } });
}

export async function listMentors(actor: AuthContext) {
  if (!canCreateMentee(actor)) throw new ForbiddenError();
  const db = await getDb();
  return db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.role, "mentor"), eq(schema.users.active, true)))
    .orderBy(asc(schema.users.name));
}

/** Corrige nome, e-mail e segmento do mentorado (admin/direção). Com login vinculado, nome e e-mail do login acompanham. */
export async function updateMentee(
  actor: AuthContext,
  menteeId: string,
  input: { fullName: string; email?: string; segment?: string },
) {
  if (!canCreateMentee(actor)) throw new ForbiddenError();
  const fullName = input.fullName.trim();
  if (!fullName) throw new ValidationError("Informe o nome do mentorado.");
  const email = input.email?.trim() ? normalizeEmail(input.email) : null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError("E-mail inválido.");
  const db = await getDb();
  const [m] = await db.select().from(schema.mentees).where(eq(schema.mentees.id, menteeId)).limit(1);
  if (!m) throw new ValidationError("Mentorado não encontrado.");
  if (m.userId) {
    if (!email) throw new ValidationError("Mentorado com acesso precisa de e-mail.");
    await applyUserIdentity(m.userId, { name: fullName, email });
  }
  await db
    .update(schema.mentees)
    .set({ fullName, email, segment: input.segment?.trim() || null, updatedAt: new Date() })
    .where(eq(schema.mentees.id, menteeId));
  await audit({ actorId: actor.userId, entityType: "mentee", entityId: menteeId, action: "mentee.update", before: { fullName: m.fullName, email: m.email, segment: m.segment }, after: { fullName, email, segment: input.segment?.trim() || null } });
}
