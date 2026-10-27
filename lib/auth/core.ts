import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { User } from "@/lib/db/schema";

export const SESSION_DAYS = 7;
export const MIN_PASSWORD = 8;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const hashPassword = (plain: string) => bcrypt.hash(plain, 11);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
export const generateTempPassword = () => randomBytes(9).toString("base64url");
export const normalizeEmail = (e: string) => e.trim().toLowerCase();

// Limitador simples em memória (instância única no Render). Cloudflare complementa na borda.
const attempts = new Map<string, { n: number; first: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 8;

function tooManyAttempts(key: string): boolean {
  const a = attempts.get(key);
  if (!a) return false;
  if (Date.now() - a.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return a.n >= MAX_ATTEMPTS;
}
function registerFailure(key: string) {
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > WINDOW_MS) attempts.set(key, { n: 1, first: Date.now() });
  else a.n += 1;
}

export type LoginResult =
  | { ok: true; token: string; user: User }
  | { ok: false; reason: "invalid" | "locked" };

// Hash fictício para igualar o tempo de resposta quando o e-mail não existe.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 11);

export async function login(emailRaw: string, password: string): Promise<LoginResult> {
  const email = normalizeEmail(emailRaw);
  if (tooManyAttempts(email)) return { ok: false, reason: "locked" };

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${email}`).limit(1);
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid || !user.active) {
    registerFailure(email);
    return { ok: false, reason: "invalid" };
  }
  attempts.delete(email);
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  return { ok: true, token: await createSession(user.id), user };
}

export async function createSession(userId: string): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  await db.insert(schema.sessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });
  return token;
}

/** Resolve o token para um usuário ativo; sessões expiradas ou de usuários inativos não resolvem. */
export async function resolveSession(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return row && row.user.active ? row.user : null;
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)));
}

export async function destroyAllSessions(userId: string) {
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}
