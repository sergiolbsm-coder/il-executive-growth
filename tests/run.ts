import assert from "node:assert/strict";

// Banco em memória: nunca toca em Neon durante os testes.
delete process.env.DATABASE_URL;
process.env.PGLITE_DIR = "memory://";
delete process.env.RESEND_API_KEY;

async function main() {
  const { getDb, schema, closeDb } = await import("../lib/db");
  const { createUser, resetPassword, changeOwnPassword, setActive, setMentorScope, listUsers } = await import("../domains/users/service");
  const { createMentee, listMentees, getMentee, assignMentors, listMentors } = await import("../domains/mentees/service");
  const { listTemplates, getTemplate, deriveTemplate, updateTemplateLevel, updateTemplateSource, addTemplateSource } = await import("../domains/templates/service");
  const { createProgram, getProgram, updateProgram, updateProgramLevel, updateProgramSource, addProgramSource } = await import("../domains/programs/service");
  const { login, resolveSession, destroySession } = await import("../lib/auth/core");
  const { canViewMentee, canManageUsers, canManageTemplates, canEditProgram, canViewInternalFields, canDeleteRecords } = await import("../lib/authorization");
  const { eq } = await import("drizzle-orm");

  const db = await getDb();
  const ctx = (u: { id: string; role: any; mentorScope?: any }) => ({ userId: u.id, role: u.role, mentorScope: u.mentorScope });
  const must = async (p: Promise<unknown>, msg: RegExp | string) => {
    await assert.rejects(p, typeof msg === "string" ? new RegExp(msg) : msg);
  };
  let n = 0;
  const ok = (name: string) => console.log(`  ✓ ${name}`);

  // ── Usuários e autenticação ───────────────────────────────────────────
  const admin = (await createUser(null, { name: "Admin Teste", email: "admin@teste.invalid", role: "admin", password: "senha-inicial-1", sendEmail: false })).user;
  const dir = (await createUser(ctx(admin), { name: "Direção Teste", email: "dir@teste.invalid", role: "direcao", sendEmail: false })).user;
  const mA = (await createUser(ctx(admin), { name: "Mentor A", email: "ma@teste.invalid", role: "mentor", sendEmail: false })).user;
  const mB = (await createUser(ctx(admin), { name: "Mentor B", email: "mb@teste.invalid", role: "mentor", sendEmail: false })).user;
  const mAll = (await createUser(ctx(admin), { name: "Mentor Todos", email: "mt@teste.invalid", role: "mentor", mentorScope: "all", sendEmail: false })).user;

  await must(createUser(ctx(mA), { name: "X", email: "x@teste.invalid", role: "admin" }), "Acesso negado");
  await must(createUser(ctx(dir), { name: "X", email: "x@teste.invalid", role: "admin" }), "Acesso negado");
  await must(createUser(ctx(admin), { name: "Dup", email: "ADMIN@teste.invalid", role: "admin", sendEmail: false }), "Já existe");
  await must(createUser(ctx(admin), { name: "Curta", email: "c@teste.invalid", role: "admin", password: "123", sendEmail: false }), "ao menos");
  await must(createUser(ctx(admin), { name: "", email: "v@teste.invalid", role: "admin", sendEmail: false }), "Informe o nome");
  assert.equal(mAll.mentorScope, "all");
  assert.equal(mA.mentorScope, "assigned");
  ok("criação de usuários, validações e escopo de mentor");

  const bad = await login("admin@teste.invalid", "errada");
  assert.equal(bad.ok, false);
  const good = await login("Admin@Teste.invalid", "senha-inicial-1");
  assert.ok(good.ok);
  if (!good.ok) throw new Error();
  assert.equal(good.user.mustChangePassword, true, "senha provisória força troca");
  assert.equal((await resolveSession(good.token))?.id, admin.id);
  const rows = await db.select().from(schema.sessions);
  assert.ok(rows.every((r) => r.tokenHash !== good.token), "token não é guardado em claro");
  await destroySession(good.token);
  assert.equal(await resolveSession(good.token), null);
  await changeOwnPassword(admin.id, "senha-inicial-1", "nova-senha-segura");
  const after = await login("admin@teste.invalid", "nova-senha-segura");
  assert.ok(after.ok && !after.user.mustChangePassword);
  await must(changeOwnPassword(admin.id, "errada-errada", "outra-senha-1"), "incorreta");
  ok("login, sessão (token em hash), troca de senha");

  const s1 = await login("ma@teste.invalid", (await resetPassword(ctx(admin), mA.id, { password: "temp-12345", sendEmail: false })).tempPassword);
  assert.ok(s1.ok);
  if (!s1.ok) throw new Error();
  const reset = await resetPassword(ctx(admin), mA.id, { sendEmail: false });
  assert.equal(await resolveSession(s1.token), null, "reset encerra sessões ativas");
  assert.equal(reset.mail.sent, false);
  await must(resetPassword(ctx(mA), mB.id), "Acesso negado");
  await setActive(ctx(admin), mB.id, false);
  assert.equal((await login("mb@teste.invalid", "qualquer")).ok, false);
  await must(setActive(ctx(admin), admin.id, false), "própria conta");
  await setActive(ctx(admin), mB.id, true);
  await must(setMentorScope(ctx(admin), dir.id, "all"), "não é mentor");
  await must(setMentorScope(ctx(mA), mB.id, "all"), "Acesso negado");
  assert.equal((await listUsers(ctx(admin))).length, 5);
  await must(listUsers(ctx(dir)), "Acesso negado");
  ok("reset de senha, ativação/desativação, escopo, listagem restrita ao admin");

  // ── Permissões puras ──────────────────────────────────────────────────
  assert.ok(canManageUsers(ctx(admin)) && !canManageUsers(ctx(dir)) && !canManageUsers(ctx(mA)));
  assert.ok(canManageTemplates(ctx(admin)) && canManageTemplates(ctx(dir)) && !canManageTemplates(ctx(mA)));
  assert.ok(canDeleteRecords(ctx(admin)) && !canDeleteRecords(ctx(dir)));
  ok("matriz de permissões por papel");

  // ── Mentorados ────────────────────────────────────────────────────────
  await must(createMentee(ctx(mA), { fullName: "Não Pode" }), "Acesso negado");
  await must(createMentee(ctx(dir), { fullName: "  " }), "Informe o nome");
  await must(createMentee(ctx(dir), { fullName: "Sem Email", createAccess: true }), "e-mail");
  await must(createMentee(ctx(dir), { fullName: "Mentor Falso", mentorIds: [dir.id] }), "Mentor inválido");
  const x = await createMentee(ctx(dir), { fullName: "Mentorado X (fictício)", email: "x@mentorado.invalid", segment: "educacao", mentorIds: [mA.id], createAccess: true, sendEmail: false });
  const y = await createMentee(ctx(dir), { fullName: "Mentorado Y (fictício)", segment: "financas", mentorIds: [mB.id] });
  assert.ok(x.grant && x.mentee.userId, "createAccess cria o login do mentorado");
  assert.equal(y.mentee.userId, null, "pré-cadastro sem login");
  const xUser = x.grant!.user;
  assert.equal(xUser.role, "mentorado");
  assert.ok((await login("x@mentorado.invalid", x.grant!.tempPassword)).ok);
  ok("cadastro de mentorado (com e sem acesso), validações");

  const names = async (u: { id: string; role: any; mentorScope?: any }) => (await listMentees(ctx(u))).map((m) => m.fullName).sort();
  assert.equal((await names(admin)).length, 2);
  assert.equal((await names(dir)).length, 2);
  assert.deepEqual(await names(mA), ["Mentorado X (fictício)"]);
  assert.deepEqual(await names(mB), ["Mentorado Y (fictício)"]);
  assert.equal((await names(mAll)).length, 2, "mentor com escopo 'todos' vê a carteira inteira");
  assert.deepEqual(await names(xUser), ["Mentorado X (fictício)"], "mentorado vê só o próprio");
  await must(getMentee(ctx(mA), y.mentee.id), "Acesso negado");
  await must(getMentee(ctx(xUser), y.mentee.id), "Acesso negado");
  assert.equal((await getMentee(ctx(mAll), y.mentee.id)).mentee.id, y.mentee.id);
  assert.ok(canViewMentee(ctx(xUser), { userId: xUser.id, mentorIds: [] }) && !canViewMentee(ctx(xUser), { userId: null, mentorIds: [] }));
  ok("isolamento da carteira: mentor atribuído/todos, mentorado só o próprio");

  await assignMentors(ctx(dir), y.mentee.id, [mA.id, mB.id]);
  assert.deepEqual(await names(mA), ["Mentorado X (fictício)", "Mentorado Y (fictício)"], "vários mentores no mesmo mentorado");
  await must(assignMentors(ctx(mA), y.mentee.id, [mA.id]), "Acesso negado");
  await must(assignMentors(ctx(dir), y.mentee.id, [mAll.id, xUser.id]), "Mentor inválido");
  assert.equal((await listMentors(ctx(dir))).length, 3);
  await must(listMentors(ctx(mA)), "Acesso negado");
  await assignMentors(ctx(dir), y.mentee.id, [mB.id]);
  assert.deepEqual(await names(mA), ["Mentorado X (fictício)"]);
  ok("atribuição de mentores (admin/direção), validação de papel");

  // ── Templates ─────────────────────────────────────────────────────────
  const tpls = await listTemplates(ctx(mA));
  assert.equal(tpls.length, 1);
  await must(listTemplates(ctx(xUser)), "Acesso negado");
  const base = tpls[0];
  const b = await getTemplate(ctx(mA), base.id);
  assert.equal(b.sources.length, 9, "template-base: 9 fontes de receita");
  assert.equal(b.levels.length, 5, "template-base: 5 níveis da Escala do Negócio");
  assert.deepEqual(b.sources.map((s) => s.slug), ["autoridade", "workshops", "digitais", "cursos", "recorrencia", "instituicoes", "alto-valor", "parcerias", "conselhos"]);
  assert.equal(b.levels.find((l) => l.level === 5)?.name, "Influência e legado");
  assert.ok(b.sources.every((s) => !s.isMotor));
  ok("template-base IDL: 9 receitas (slugs estáveis) e 5 níveis");

  await must(deriveTemplate(ctx(mA), base.id, { name: "Educação — Executive", segment: "educacao", model: "executive" }), "Acesso negado");
  await must(deriveTemplate(ctx(dir), base.id, { name: "Base IDL — 9 Fontes de Receita", segment: "x", model: "y" }), "Já existe");
  const edu = await deriveTemplate(ctx(dir), base.id, { name: "Educação — Executive", segment: "Educacao", model: "Executive" });
  assert.equal(edu.segment, "educacao");
  assert.equal(edu.model, "executive");
  const eduFull = await getTemplate(ctx(dir), edu.id);
  assert.equal(eduFull.sources.length, 9);
  assert.equal(eduFull.levels.length, 5);
  await updateTemplateSource(ctx(dir), edu.id, "instituicoes", { isMotor: true });
  await updateTemplateSource(ctx(dir), edu.id, "conselhos", { isMotor: true, role: "Recorrência premium" });
  await updateTemplateLevel(ctx(dir), edu.id, 1, { volume: "Muito alto (B2C e B2B)" });
  await addTemplateSource(ctx(dir), edu.id, { slug: "roadmap-futuro", name: "Roadmap to Your Future", level: 1 });
  await must(addTemplateSource(ctx(dir), edu.id, { slug: "roadmap-futuro", name: "Duplicada", level: 1 }), "Já existe");
  await must(addTemplateSource(ctx(dir), edu.id, { slug: "Slug Inválido", name: "X", level: 1 }), "Identificador inválido");
  await must(updateTemplateSource(ctx(dir), edu.id, "conselhos", { level: 9 }), "nível");
  await must(updateTemplateLevel(ctx(dir), edu.id, 1, { name: " " }), "vazios");
  await must(updateTemplateLevel(ctx(mA), edu.id, 1, { name: "Z" }), "Acesso negado");
  const eduAfter = await getTemplate(ctx(dir), edu.id);
  assert.equal(eduAfter.template.version, 5, "cada edição incrementa a versão do template");
  const baseAfter = await getTemplate(ctx(dir), base.id);
  assert.equal(baseAfter.template.version, 1, "o template de origem não é alterado");
  assert.ok(baseAfter.sources.every((s) => !s.isMotor));
  ok("deriva template (segmento/modelo), edita catálogo e pirâmide, versiona, valida");

  // ── Programas (snapshot) ──────────────────────────────────────────────
  await must(createProgram(ctx(mA), { menteeId: x.mentee.id, templateId: edu.id, name: "Mentoria" }), "Acesso negado");
  await must(createProgram(ctx(dir), { menteeId: x.mentee.id, templateId: edu.id, name: " " }), "Informe o nome");
  await must(createProgram(ctx(dir), { menteeId: x.mentee.id, templateId: edu.id, name: "P", startDate: "2026-12-01", endDate: "2026-10-01" }), "anterior");
  await must(createProgram(ctx(dir), { menteeId: x.mentee.id, templateId: edu.id, name: "P", weeklyHours: 200 }), "Horas");
  const prog = await createProgram(ctx(dir), {
    menteeId: x.mentee.id, templateId: edu.id, name: "Mentoria Executiva — Mentorado X", purpose: "Transformar organizações educacionais.", weeklyHours: 6, startDate: "2026-10-26", endDate: "2027-04-30",
  });
  assert.equal(prog.templateVersion, 5);
  assert.equal(prog.model, "executive");
  const pg = await getProgram(ctx(mA), prog.id);
  assert.equal(pg.sources.length, 10, "snapshot copia o catálogo (9 + 1 própria do template)");
  assert.equal(pg.levels.length, 5);
  assert.equal(pg.sources.filter((s) => s.isMotor).length, 2);
  assert.equal(pg.levels[0].volume, "Muito alto (B2C e B2B)");
  assert.equal(pg.canEdit, true);

  // editar o template NÃO muda o programa; editar o programa NÃO muda o template
  await updateTemplateLevel(ctx(dir), edu.id, 1, { volume: "Alterado depois" });
  await updateTemplateSource(ctx(dir), edu.id, "digitais", { name: "Renomeada no template" });
  const pg2 = await getProgram(ctx(mA), prog.id);
  assert.equal(pg2.levels[0].volume, "Muito alto (B2C e B2B)", "snapshot isolado do template");
  assert.equal(pg2.sources.find((s) => s.slug === "digitais")?.name, "Produtos digitais");
  await updateProgramLevel(ctx(mA), prog.id, 3, { ticket: "Alto (R$ a definir)" });
  await updateProgramSource(ctx(mA), prog.id, "alto-valor", { isMotor: true, level: 4 });
  await addProgramSource(ctx(mA), prog.id, { slug: "linha-propria", name: "Linha própria do mentorado", level: 2, role: "Recorrência" });
  await must(addProgramSource(ctx(mA), prog.id, { slug: "linha-propria", name: "Dup", level: 2 }), "Já existe");
  await must(updateProgramLevel(ctx(mA), prog.id, 7, { name: "X" }), "nível");
  await must(updateProgramSource(ctx(mA), prog.id, "nao-existe", { name: "X" }), "não encontrada");
  const tplCheck = await getTemplate(ctx(dir), edu.id);
  assert.equal(tplCheck.levels.find((l) => l.level === 3)?.ticket, "Alto", "template intacto");
  assert.equal((await getProgram(ctx(mA), prog.id)).sources.length, 11);
  ok("programa copia (snapshot) catálogo e pirâmide; template e programa evoluem isolados");

  // permissões no programa
  await must(getProgram(ctx(mB), prog.id), "Acesso negado");
  await must(updateProgram(ctx(mB), prog.id, { purpose: "invasão" }), "Acesso negado");
  const ownView = await getProgram(ctx(xUser), prog.id);
  assert.equal(ownView.canEdit, false, "mentorado vê o próprio programa, sem editar");
  await must(updateProgram(ctx(xUser), prog.id, { purpose: "eu mesmo" }), "Acesso negado");
  await must(updateProgramLevel(ctx(xUser), prog.id, 1, { name: "Z" }), "Acesso negado");
  const yProg = await createProgram(ctx(dir), { menteeId: y.mentee.id, templateId: base.id, name: "Programa do Y" });
  await must(getProgram(ctx(xUser), yProg.id), "Acesso negado");
  assert.ok(canEditProgram(ctx(mA), { userId: xUser.id, mentorIds: [mA.id] }) && !canEditProgram(ctx(xUser), { userId: xUser.id, mentorIds: [] }));
  assert.ok(canViewInternalFields(ctx(mA)) && !canViewInternalFields(ctx(xUser)));
  ok("permissões no programa: mentor atribuído edita; outro mentor e mentorado não");

  const up = await updateProgram(ctx(mA), prog.id, { purpose: "Novo propósito", weeklyHours: 8, status: "pausado" });
  assert.equal(up.purpose, "Novo propósito");
  assert.equal(up.weeklyHours, 8);
  await must(updateProgram(ctx(mA), prog.id, { status: "inventado" }), "Situação");
  await must(updateProgram(ctx(mA), prog.id, { endDate: "2026-01-01" }), "anterior");
  await must(updateProgram(ctx(mA), prog.id, { name: " " }), "vazio");
  await must(updateProgram(ctx(mA), "00000000-0000-0000-0000-000000000000", { name: "x" }), "não encontrado");
  ok("edição do programa com validações");

  // ── Auditoria ─────────────────────────────────────────────────────────
  const log = await db.select().from(schema.activityLog);
  const actions = new Set(log.map((l) => l.action));
  for (const a of ["user.create", "user.reset_password", "mentee.create", "mentee.assign_mentors", "template.derive", "template.update_level", "program.create", "program.update", "program.update_level", "program.add_source"])
    assert.ok(actions.has(a), `auditoria registra ${a}`);
  const lvl = log.find((l) => l.action === "program.update_level");
  assert.ok(lvl && lvl.beforeJson && lvl.afterJson, "auditoria guarda antes/depois");
  const pwdLeak = JSON.stringify(log);
  assert.ok(!pwdLeak.includes("temp-12345") && !pwdLeak.includes("senha-inicial-1"), "senhas nunca vão para a auditoria");
  ok("auditoria completa, com antes/depois e sem senhas");

  // ── Integridade ───────────────────────────────────────────────────────
  await db.delete(schema.mentees).where(eq(schema.mentees.id, y.mentee.id));
  assert.equal((await db.select().from(schema.programs).where(eq(schema.programs.id, yProg.id))).length, 0, "remover mentorado remove seus programas (cascata)");
  assert.equal((await db.select().from(schema.programRevenueSources).where(eq(schema.programRevenueSources.programId, yProg.id))).length, 0);
  ok("integridade referencial (cascata)");

  await closeDb();
  console.log(`\nOK — testes de autorização, templates e programas passaram.`);
  void n;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
