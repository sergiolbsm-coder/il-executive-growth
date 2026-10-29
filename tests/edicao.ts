import assert from "node:assert/strict";

delete process.env.DATABASE_URL;
process.env.PGLITE_DIR = "memory://";
delete process.env.RESEND_API_KEY;

async function main() {
  const ok = (name: string) => console.log(`  ✓ ${name}`);
  const U = await import("../domains/users/service");
  const M = await import("../domains/mentees/service");
  const T = await import("../domains/templates/service");
  const { getDb, schema, closeDb } = await import("../lib/db");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();

  const admin = (await U.createUser(null, { name: "Adm", email: "adm@ex.com", role: "admin", sendEmail: false })).user;
  const ctx = (u: { id: string; role: "admin" | "direcao" | "mentor" | "mentorado"; mentorScope?: "all" | "assigned" }) => ({ userId: u.id, role: u.role, mentorScope: u.mentorScope ?? "assigned" }) as Parameters<typeof U.updateUser>[0];
  const a = ctx(admin);
  const mentor = (await U.createUser(null, { name: "Mentor", email: "m@ex.com", role: "mentor", sendEmail: false })).user;

  // usuário: corrige nome e e-mail; duplicado e inválido são recusados; mentor não edita
  await U.updateUser(a, mentor.id, { name: "Mentora Corrigida", email: "  Novo@EX.com " });
  const [m1] = await db.select().from(schema.users).where(eq(schema.users.id, mentor.id));
  assert.equal(m1.name, "Mentora Corrigida");
  assert.equal(m1.email, "novo@ex.com", "e-mail normalizado");
  await assert.rejects(() => U.updateUser(a, mentor.id, { name: "X", email: "adm@ex.com" }), /Já existe/);
  await assert.rejects(() => U.updateUser(a, mentor.id, { name: "X", email: "invalido" }), /E-mail inválido/);
  await assert.rejects(() => U.updateUser(a, mentor.id, { name: " ", email: "novo@ex.com" }), /nome/);
  await assert.rejects(() => U.updateUser(ctx(mentor), mentor.id, { name: "X", email: "z@ex.com" }));
  await U.updateUser(a, mentor.id, { name: "Mentora Corrigida", email: "novo@ex.com" }); // mesmo e-mail não conflita consigo
  ok("usuário: nome/e-mail corrigidos, normalizados, sem duplicar e só admin");

  // mentorado com acesso: login acompanha
  const { mentee } = await M.createMentee(a, { fullName: "Karina Errada", email: "k@ex.com", createAccess: true, sendEmail: false });
  await M.updateMentee(a, mentee.id, { fullName: "Karina Certa", email: "karina@ex.com", segment: " saúde " });
  const [me] = await db.select().from(schema.mentees).where(eq(schema.mentees.id, mentee.id));
  const [lu] = await db.select().from(schema.users).where(eq(schema.users.id, mentee.userId!));
  assert.deepEqual([me.fullName, me.email, me.segment], ["Karina Certa", "karina@ex.com", "saúde"]);
  assert.deepEqual([lu.name, lu.email], ["Karina Certa", "karina@ex.com"], "login sincronizado");
  await assert.rejects(() => M.updateMentee(a, mentee.id, { fullName: "K", email: "adm@ex.com" }), /Já existe/);
  await assert.rejects(() => M.updateMentee(a, mentee.id, { fullName: "K", email: "" }), /precisa de e-mail/);
  // editar o usuário também atualiza o cadastro de mentorado
  await U.updateUser(a, mentee.userId!, { name: "Karina Silva", email: "karina@ex.com" });
  const [me2] = await db.select().from(schema.mentees).where(eq(schema.mentees.id, mentee.id));
  assert.equal(me2.fullName, "Karina Silva");
  await assert.rejects(() => M.updateMentee(ctx(mentor), mentee.id, { fullName: "K", email: "k@ex.com" }));
  ok("mentorado: dados e login ficam em sincronia nos dois sentidos; mentor não edita");

  // template: renomear
  const [tpl] = await db.select().from(schema.programTemplates).limit(1);
  await T.updateTemplate(a, tpl.id, { name: "Plano Novo", segment: tpl.segment, model: tpl.model, notes: "obs" });
  const [t2] = await db.select().from(schema.programTemplates).where(eq(schema.programTemplates.id, tpl.id));
  assert.equal(t2.name, "Plano Novo");
  await assert.rejects(() => T.updateTemplate(a, tpl.id, { name: " ", segment: "x", model: "y" }), /obrigatórios/);
  await assert.rejects(() => T.updateTemplate(ctx(mentor), tpl.id, { name: "Z", segment: "x", model: "y" }));
  ok("template (plano): renomeado; vazio e sem permissão recusados");

  const log = await db.select().from(schema.activityLog);
  for (const act of ["user.update", "mentee.update", "template.update"]) assert.ok(log.some((l) => l.action === act), `auditoria ${act}`);
  ok("auditoria registra as correções");

  await closeDb();
  console.log("\nOK — edição de nomes/e-mails passou.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
