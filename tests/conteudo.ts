import assert from "node:assert/strict";

delete process.env.DATABASE_URL;
process.env.PGLITE_DIR = "memory://";
delete process.env.RESEND_API_KEY;

async function main() {
  const ok = (name: string) => console.log(`  ✓ ${name}`);
  const L = await import("../domains/content/links");

  // ── Links (puro) ──────────────────────────────────────────────────────
  assert.equal(L.normalizeUrl("https://exemplo.com/a b"), null, "espaço no endereço");
  assert.equal(L.normalizeUrl("javascript:alert(1)"), null);
  assert.equal(L.normalizeUrl("data:text/html,<script>1</script>"), null);
  assert.equal(L.normalizeUrl("file:///etc/passwd"), null);
  assert.equal(L.normalizeUrl("ftp://exemplo.com/x"), null);
  assert.equal(L.normalizeUrl("exemplo.com/x"), null, "sem esquema");
  assert.equal(L.normalizeUrl("http://localhost/x"), null, "host sem ponto");
  assert.equal(L.normalizeUrl(""), null);
  assert.equal(L.normalizeUrl("https://exemplo.com/" + "a".repeat(2000)), null, "longo demais");
  assert.equal(L.normalizeUrl("  https://exemplo.com/x?y=1  "), "https://exemplo.com/x?y=1");
  assert.equal(L.detectKind("https://drive.google.com/drive/folders/1AbC?usp=sharing"), "drive-pasta");
  assert.equal(L.detectKind("https://drive.google.com/drive/u/0/folders/1AbC"), "drive-pasta");
  assert.equal(L.detectKind("https://drive.google.com/file/d/1AbC/view"), "drive-arquivo");
  assert.equal(L.detectKind("https://docs.google.com/document/d/1AbC/edit"), "drive-arquivo");
  assert.equal(L.detectKind("https://docs.google.com/spreadsheets/d/1AbC/edit"), "drive-arquivo");
  assert.equal(L.detectKind("https://www.drive.google.com/file/d/1"), "drive-arquivo", "www é ignorado");
  assert.equal(L.detectKind("https://exemplo.com/drive/folders/1"), "link", "só o Google conta como Drive");
  assert.equal(L.detectKind("https://drive.google.com.evil.com/file/d/1"), "link", "domínio imitando o Drive não é Drive");
  assert.equal(L.detectKind("https://linkedin.com/in/x"), "link");
  ok("links: só http(s) válido; Drive arquivo/pasta detectado; domínios imitadores não enganam");

  // ── Com banco ─────────────────────────────────────────────────────────
  const { getDb, schema, closeDb } = await import("../lib/db");
  const { createUser } = await import("../domains/users/service");
  const { createMentee } = await import("../domains/mentees/service");
  const { listTemplates } = await import("../domains/templates/service");
  const { createProgram } = await import("../domains/programs/service");
  const K = await import("../domains/content/service");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  const ctx = (u: { id: string; role: any; mentorScope?: any }) => ({ userId: u.id, role: u.role, mentorScope: u.mentorScope });
  const must = async (p: Promise<unknown>, msg: RegExp | string) => { await assert.rejects(p, typeof msg === "string" ? new RegExp(msg) : msg); };

  const admin = (await createUser(null, { name: "Admin", email: "admin@t.invalid", role: "admin", password: "senha-inicial-1", sendEmail: false })).user;
  const dir = (await createUser(ctx(admin), { name: "Direção", email: "dir@t.invalid", role: "direcao", sendEmail: false })).user;
  const mA = (await createUser(ctx(admin), { name: "Mentor A", email: "ma@t.invalid", role: "mentor", sendEmail: false })).user;
  const mB = (await createUser(ctx(admin), { name: "Mentor B", email: "mb@t.invalid", role: "mentor", sendEmail: false })).user;
  const x = await createMentee(ctx(dir), { fullName: "Mentorado X (fictício)", email: "x@m.invalid", mentorIds: [mA.id], createAccess: true, sendEmail: false });
  const y = await createMentee(ctx(dir), { fullName: "Mentorado Y (fictício)", email: "y@m.invalid", mentorIds: [mB.id], createAccess: true, sendEmail: false });
  const xU = x.grant!.user;
  const yU = y.grant!.user;
  const [base] = await listTemplates(ctx(mA));
  const progX = await createProgram(ctx(dir), { menteeId: x.mentee.id, templateId: base.id, name: "Programa X" });
  const progY = await createProgram(ctx(dir), { menteeId: y.mentee.id, templateId: base.id, name: "Programa Y" });

  // ── Biblioteca de links ───────────────────────────────────────────────
  await must(K.addLink(ctx(yU), progX.id, { title: "x", url: "https://exemplo.com" }), "Acesso negado");
  await must(K.addLink(ctx(mB), progX.id, { title: "x", url: "https://exemplo.com" }), "Acesso negado");
  await must(K.addLink(ctx(xU), progX.id, { title: " ", url: "https://exemplo.com" }), "título");
  await must(K.addLink(ctx(xU), progX.id, { title: "x", url: "javascript:alert(1)" }), "endereço válido");
  await must(K.addLink(ctx(xU), progX.id, { title: "x", url: "https://exemplo.com", category: "Qualquer" }), "Tipo inválido");
  const l1 = await K.addLink(ctx(mA), progX.id, { title: "Pasta do programa", url: "https://drive.google.com/drive/folders/1AbCdEf?usp=sharing" });
  const l2 = await K.addLink(ctx(mA), progX.id, { title: "Assessment de liderança", url: "https://assessment.exemplo.com/x", category: "Assessment" });
  const l3 = await K.addLink(ctx(xU), progX.id, { title: "Atividade 1", url: "https://exemplo.com/atividade" });
  assert.equal(l1.category, "Drive", "endereço do Drive vira tipo Drive");
  assert.equal(l1.kind, "drive-pasta");
  assert.equal(l2.category, "Assessment");
  assert.equal(l3.category, "Atividade", "link comum vira Atividade");
  const libs = await K.listLinks(ctx(xU), progX.id);
  assert.equal(libs.length, 3);
  assert.ok(libs.every((l) => l.done === false && l.doneAt === null));
  await must(K.listLinks(ctx(mB), progX.id), "Acesso negado");
  assert.equal((await K.listLinks(ctx(yU), progY.id)).length, 0, "biblioteca é por programa");
  ok("links: tipos Drive/Atividade/Assessment, validações e isolamento por programa");

  // Check "já fiz / já acessei"
  await K.setLinkDone(ctx(xU), l1.id, true);
  let after = (await K.listLinks(ctx(xU), progX.id)).find((l) => l.id === l1.id)!;
  assert.equal(after.done, true);
  assert.ok(after.doneAt);
  assert.equal(after.doneBy, xU.id);
  assert.equal((await K.listLinks(ctx(mA), progX.id)).find((l) => l.id === l1.id)!.done, true, "a equipe vê o check do mentorado");
  await K.setLinkDone(ctx(xU), l1.id, false);
  after = (await K.listLinks(ctx(xU), progX.id)).find((l) => l.id === l1.id)!;
  assert.deepEqual([after.done, after.doneAt, after.doneBy], [false, null, null]);
  await must(K.setLinkDone(ctx(yU), l1.id, true), "Acesso negado");
  await must(K.setLinkDone(ctx(mB), l1.id, true), "Acesso negado");
  await must(K.setLinkDone(ctx(xU), "00000000-0000-0000-0000-000000000000", true), "não encontrado");
  ok("check: mentorado marca e desmarca, equipe vê, outros programas não mexem");

  // Edição e remoção
  await K.updateLink(ctx(xU), l3.id, { title: "Atividade 1 (revisada)" });
  await must(K.updateLink(ctx(xU), l1.id, { title: "x" }), "Acesso negado");
  await must(K.removeLink(ctx(xU), l1.id), "Acesso negado");
  await must(K.updateLink(ctx(yU), l3.id, { title: "x" }), "Acesso negado");
  const moved = await K.updateLink(ctx(mA), l3.id, { url: "https://drive.google.com/file/d/9/view", category: "Drive" });
  assert.equal(moved.kind, "drive-arquivo");
  assert.equal(moved.category, "Drive");
  await must(K.updateLink(ctx(mA), l3.id, { url: "ftp://x.com/y" }), "endereço válido");
  await must(K.updateLink(ctx(mA), l3.id, { title: " " }), "título");
  await must(K.updateLink(ctx(mA), l3.id, { category: "Outro" }), "Tipo inválido");
  await K.removeLink(ctx(xU), l3.id);
  await K.removeLink(ctx(mA), l2.id);
  await must(K.removeLink(ctx(mA), l2.id), "não encontrado");
  assert.equal((await K.listLinks(ctx(mA), progX.id)).length, 1);
  ok("edição/remoção: mentorado só os próprios links; equipe todos");

  const log = await db.select().from(schema.activityLog);
  const actions = new Set(log.map((l) => l.action));
  for (const a of ["library.add", "library.update", "library.remove", "library.done", "library.undone"]) assert.ok(actions.has(a), `auditoria registra ${a}`);
  await db.delete(schema.programs).where(eq(schema.programs.id, progX.id));
  assert.equal((await db.select().from(schema.libraryLinks).where(eq(schema.libraryLinks.programId, progX.id))).length, 0, "remover programa limpa os links");
  ok("auditoria e integridade");

  await closeDb();
  console.log("\nOK — conteúdo e biblioteca passaram.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
