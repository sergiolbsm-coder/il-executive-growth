import { eq, sql } from "drizzle-orm";
import { audit } from "@/lib/audit";
import {
  MIN_PASSWORD,
  destroyAllSessions,
  generateTempPassword,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "@/lib/auth/core";
import { type AuthContext, ForbiddenError, canManageUsers } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import type { MentorScope, User, UserRole } from "@/lib/db/schema";
import { ValidationError } from "@/lib/errors";
import { type MailResult, sendAccessEmail } from "@/lib/mail";

export { ValidationError };

export interface AccessGrant {
  user: User;
  /** Senha provisória: exibida UMA vez ao admin (e enviada por e-mail). Nunca é persistida em claro. */
  tempPassword: string;
  mail: MailResult;
}

const notSent = { sent: false, reason: "not_configured" } as MailResult;

async function emailTaken(email: string) {
  const db = await getDb();
  const rows = await db.select({ id: schema.users.id }).from(schema.users).where(sql`lower(${schema.users.email}) = ${email}`).limit(1);
  return rows.length > 0;
}

/**
 * Cria usuário com senha provisória e envia o e-mail de liberação.
 * `actor` null = bootstrap/script ou fluxo interno já autorizado (ex.: cadastro de mentorado por direção).
 */
export async function createUser(
  actor: AuthContext | null,
  input: { name: string; email: string; role: UserRole; password?: string; sendEmail?: boolean; mentorScope?: MentorScope },
): Promise<AccessGrant> {
  if (actor && !canManageUsers(actor)) throw new ForbiddenError();
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!name) throw new ValidationError("Informe o nome.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError("E-mail inválido.");
  if (await emailTaken(email)) throw new ValidationError("Já existe um usuário com este e-mail.");

  const tempPassword = input.password ?? generateTempPassword();
  if (tempPassword.length < MIN_PASSWORD) throw new ValidationError(`A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`);

  const db = await getDb();
  const [user] = await db
    .insert(schema.users)
    .values({
      name,
      email,
      role: input.role,
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      mentorScope: input.role === "mentor" ? (input.mentorScope ?? "assigned") : "assigned",
    })
    .returning();
  await audit({ actorId: actor?.userId ?? null, entityType: "user", entityId: user.id, action: "user.create", after: { email, role: input.role } });

  const mail = input.sendEmail === false ? notSent : await sendAccessEmail({ name, email, tempPassword });
  return { user, tempPassword, mail };
}

/** Admin redefine a senha (informada ou gerada), força troca no próximo acesso, encerra sessões e reenvia o e-mail. */
export async function resetPassword(
  actor: AuthContext,
  userId: string,
  opts: { password?: string; sendEmail?: boolean } = {},
): Promise<AccessGrant> {
  if (!canManageUsers(actor)) throw new ForbiddenError();
  const db = await getDb();
  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!target) throw new ValidationError("Usuário não encontrado.");

  const tempPassword = opts.password ?? generateTempPassword();
  if (tempPassword.length < MIN_PASSWORD) throw new ValidationError(`A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`);

  const [user] = await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(tempPassword), mustChangePassword: true, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning();
  await destroyAllSessions(userId);
  await audit({ actorId: actor.userId, entityType: "user", entityId: userId, action: "user.reset_password" });

  const mail = opts.sendEmail === false ? notSent : await sendAccessEmail({ name: user.name, email: user.email, tempPassword });
  return { user, tempPassword, mail };
}

export async function setActive(actor: AuthContext, userId: string, active: boolean) {
  if (!canManageUsers(actor)) throw new ForbiddenError();
  if (actor.userId === userId && !active) throw new ValidationError("Você não pode desativar a própria conta.");
  const db = await getDb();
  await db.update(schema.users).set({ active, updatedAt: new Date() }).where(eq(schema.users.id, userId));
  if (!active) await destroyAllSessions(userId);
  await audit({ actorId: actor.userId, entityType: "user", entityId: userId, action: active ? "user.activate" : "user.deactivate" });
}

/** O próprio usuário troca a senha (exige a atual, inclusive a provisória). */
export async function changeOwnPassword(userId: string, current: string, next: string) {
  if (next.length < MIN_PASSWORD) throw new ValidationError(`A nova senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`);
  if (next === current) throw new ValidationError("A nova senha deve ser diferente da atual.");
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!u || !(await verifyPassword(current, u.passwordHash))) throw new ValidationError("Senha atual incorreta.");
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(next), mustChangePassword: false, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
  await audit({ actorId: userId, entityType: "user", entityId: userId, action: "user.change_password" });
}

/** Define se o mentor vê TODOS os mentorados ou só os atribuídos a ele. Somente administração. */
export async function setMentorScope(actor: AuthContext, userId: string, scope: MentorScope) {
  if (!canManageUsers(actor)) throw new ForbiddenError();
  const db = await getDb();
  const [t] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!t || t.role !== "mentor") throw new ValidationError("Usuário não é mentor.");
  await db.update(schema.users).set({ mentorScope: scope, updatedAt: new Date() }).where(eq(schema.users.id, userId));
  await audit({ actorId: actor.userId, entityType: "user", entityId: userId, action: "user.set_scope", before: { scope: t.mentorScope }, after: { scope } });
}

export async function listUsers(actor: AuthContext) {
  if (!canManageUsers(actor)) throw new ForbiddenError();
  const db = await getDb();
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      active: schema.users.active,
      mustChangePassword: schema.users.mustChangePassword,
      lastLoginAt: schema.users.lastLoginAt,
      mentorScope: schema.users.mentorScope,
    })
    .from(schema.users)
    .orderBy(schema.users.name);
}
