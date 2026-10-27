import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

type Exec = (sql: string) => Promise<void>;
type Applied = () => Promise<Set<string>>;
type Mark = (name: string) => Promise<void>;

/** Aplica db/migrations/*.sql em ordem, uma vez cada (registro em _migrations). */
async function migrate(exec: Exec, applied: Applied, mark: Mark) {
  await exec("CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = await applied();
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const ddl = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await exec(ddl);
    await mark(file);
  }
}

async function connect(): Promise<{ db: Db; close: () => Promise<void> }> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: 5 });
    await migrate(
      async (s) => void (await pool.query(s)),
      async () => new Set((await pool.query("SELECT name FROM _migrations")).rows.map((r) => r.name as string)),
      async (n) => void (await pool.query("INSERT INTO _migrations (name) VALUES ($1)", [n])),
    );
    return { db: drizzle(pool, { schema }) as unknown as Db, close: () => pool.end() };
  }
  // Sem DATABASE_URL: PGlite embutido (dev/teste). PGLITE_DIR=memory:// para testes.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  if (!dir.startsWith("memory://")) await mkdir(path.dirname(dir), { recursive: true });
  const client = new PGlite(dir);
  await migrate(
    async (s) => void (await client.exec(s)),
    async () => new Set((await client.query<{ name: string }>("SELECT name FROM _migrations")).rows.map((r) => r.name)),
    async (n) => void (await client.query("INSERT INTO _migrations (name) VALUES ($1)", [n])),
  );
  return { db: drizzle(client, { schema }) as unknown as Db, close: () => client.close() };
}

const g = globalThis as unknown as { __ilgDb?: Promise<{ db: Db; close: () => Promise<void> }> };

export function getDb(): Promise<Db> {
  if (!g.__ilgDb) {
    g.__ilgDb = connect();
    g.__ilgDb.catch(() => {
      g.__ilgDb = undefined;
    });
  }
  return g.__ilgDb.then((c) => c.db);
}

export async function closeDb() {
  if (g.__ilgDb) {
    const c = await g.__ilgDb;
    g.__ilgDb = undefined;
    await c.close();
  }
}

export { schema };
