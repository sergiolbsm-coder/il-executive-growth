import assert from "node:assert/strict";

delete process.env.DATABASE_URL;
process.env.PGLITE_DIR = "memory://";
delete process.env.RESEND_API_KEY;

async function main() {
  const ok = (name: string) => console.log(`  ✓ ${name}`);
  const { getDb, schema, closeDb } = await import("../lib/db");
  const { createUser } = await import("../domains/users/service");
  const { createMentee } = await import("../domains/mentees/service");
  const { listTemplates } = await import("../domains/templates/service");
  const { createProgram } = await import("../domains/programs/service");
  const { createOffer } = await import("../domains/offers/service");
  const K = await import("../domains/strategy/service");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  type Ctx = Parameters<typeof K.listCards>[0];
  const ctx = (u: { id: string; role: Ctx["role"] }): Ctx => ({ userId: u.id, role: u.role, mentorScope: "assigned" });
  const must = async (p: Promise<unknown>, msg: string) => { await assert.rejects(p, new RegExp(msg)); };

  const admin = (await createUser(null, { name: "Adm", email: "a@t.invalid", role: "admin", password: "senha-inicial-1", sendEmail: false })).user;
  const dir = (await createUser(ctx(admin), { name: "Dir", email: "d@t.invalid", role: "direcao", sendEmail: false })).user;
  const mA = (await createUser(ctx(admin), { name: "Mentor A", email: "ma@t.invalid", role: "mentor", sendEmail: false })).user;
  const mB = (await createUser(ctx(admin), { name: "Mentor B", email: "mb@t.invalid", role: "mentor", sendEmail: false })).user;
  const x = await createMentee(ctx(dir), { fullName: "X (fictício)", email: "x@m.invalid", mentorIds: [mA.id], createAccess: true, sendEmail: false });
  const y = await createMentee(ctx(dir), { fullName: "Y (fictício)", email: "y@m.invalid", mentorIds: [mB.id], createAccess: true, sendEmail: false });
  const xU = x.grant!.user;
  const yU = y.grant!.user;
  const [base] = await listTemplates(ctx(mA));
  const progX = await createProgram(ctx(dir), { menteeId: x.mentee.id, templateId: base.id, name: "Programa X" });
  const progY = await createProgram(ctx(dir), { menteeId: y.mentee.id, templateId: base.id, name: "Programa Y" });
  const mk = (a: Ctx, pid: string, name: string) => createOffer(a, pid, { revenueSlug: "workshops", name, problem: "Escolas sem porta de entrada comercial", audience: "Mantenedores e diretores" });
  const offX = await mk(ctx(mA), progX.id, "Palestras");
  const offX2 = await mk(ctx(mA), progX.id, "Diagnóstico");
  const offY = await mk(ctx(mB), progY.id, "Palestras Y");

  // Criação e validações
  await must(K.createCard(ctx(yU), offX.id, { kind: "cliente", title: "Escolas" }), "Acesso negado");
  await must(K.createCard(ctx(mB), offX.id, { kind: "cliente", title: "Escolas" }), "Acesso negado");
  await must(K.createCard(ctx(xU), offX.id, { kind: "x", title: "Escolas" }), "cliente ou de demanda");
  await must(K.createCard(ctx(xU), offX.id, { kind: "cliente", title: " " }), "título");
  await must(K.createCard(ctx(xU), offX.id, { kind: "cliente", title: "t", priority: "urgente" }), "Prioridade");
  await must(K.createCard(ctx(xU), offX.id, { kind: "cliente", title: "t", stage: "xx" }), "Etapa");
  await must(K.createCard(ctx(xU), offX.id, { kind: "cliente", title: "t", materialUrl: "javascript:alert(1)" }), "endereço válido");
  await must(K.createCard(ctx(xU), offX.id, { kind: "cliente", title: "t".repeat(161) }), "longo demais");
  const c1 = await K.createCard(ctx(xU), offX.id, { kind: "cliente", title: "Escolas privadas de médio porte", approach: "Começar pela dor do diretor", objection: "Sem verba — mostrar retorno", materialUrl: "https://drive.google.com/file/d/1/view", priority: "alta" });
  const c2 = await K.createCard(ctx(mA), offX.id, { kind: "demanda", title: "Pedem formação para coordenadores", priority: "baixa" });
  assert.equal(c1.stage, "primeiro_contato", "entra na 1ª coluna");
  assert.equal(c2.priority, "baixa");
  const l1 = await K.listCards(ctx(xU), offX.id);
  assert.deepEqual(l1.cards.map((c) => c.title), ["Escolas privadas de médio porte", "Pedem formação para coordenadores"], "prioridade alta primeiro");
  await must(K.listCards(ctx(mB), offX.id), "Acesso negado");
  assert.equal((await K.listCards(ctx(yU), offY.id)).cards.length, 0, "quadro é por oferta");
  assert.equal((await K.listCards(ctx(mA), offX2.id)).cards.length, 0, "cada oferta tem o seu quadro");
  const counts = await K.countCardsByOffer(ctx(xU), progX.id);
  assert.equal(counts.get(offX.id), 2);
  assert.equal(counts.get(offX2.id), undefined);
  ok("cartões: validações, prioridade, isolamento por oferta e por programa");

  // Mover e editar
  const mv = await K.moveCard(ctx(xU), c1.id, "apresentacao");
  assert.equal(mv.stage, "apresentacao");
  await K.moveCard(ctx(mA), c1.id, "aquecimento");
  await must(K.moveCard(ctx(xU), c1.id, "inexistente"), "Etapa");
  await must(K.moveCard(ctx(yU), c1.id, "fechamento"), "Acesso negado");
  const ed = await K.updateCard(ctx(xU), c1.id, { title: "Escolas privadas (revisado)", materialUrl: "" });
  assert.equal(ed.title, "Escolas privadas (revisado)");
  assert.equal(ed.materialUrl, null, "link pode ser limpo");
  ok("mover entre as 6 colunas e editar");

  // Lições aprendidas
  await must(K.addLesson(ctx(xU), c1.id, { question: "Por que não fechou?", answer: "x" }), "Perdido e Concluído");
  await K.moveCard(ctx(xU), c1.id, "perdido");
  await must(K.addLesson(ctx(xU), c1.id, { question: " ", answer: "x" }), "pergunta");
  await must(K.addLesson(ctx(xU), c1.id, { question: "P?", answer: " " }), "resposta");
  await must(K.addLesson(ctx(yU), c1.id, { question: "P?", answer: "R" }), "Acesso negado");
  const a1 = await K.addLesson(ctx(xU), c1.id, { question: "Por que não fechou? (motivo principal)", answer: "Orçamento congelado" });
  await K.addLesson(ctx(mA), c1.id, { question: "O que faríamos diferente numa próxima abordagem?", answer: "Oferecer piloto menor" });
  await K.addLesson(ctx(xU), c1.id, { question: "Pergunta livre da equipe", answer: "Resposta livre" });
  let withL = (await K.listCards(ctx(xU), offX.id)).cards.find((c) => c.id === c1.id)!;
  assert.equal(withL.lessons.length, 3, "várias lições por cartão");
  await K.updateLesson(ctx(xU), a1.id, { question: a1.question, answer: "Orçamento congelado até 2027" });
  await must(K.updateLesson(ctx(yU), a1.id, { question: "P", answer: "R" }), "Acesso negado");
  await K.removeLesson(ctx(mA), a1.id);
  await must(K.removeLesson(ctx(mA), a1.id), "não encontrada");
  withL = (await K.listCards(ctx(xU), offX.id)).cards.find((c) => c.id === c1.id)!;
  assert.equal(withL.lessons.length, 2);
  await K.moveCard(ctx(xU), c1.id, "concluido");
  await K.addLesson(ctx(xU), c1.id, { question: "O que fez o cliente fechar?", answer: "Piloto com garantia" });
  assert.equal((await K.listCards(ctx(xU), offX.id)).cards.find((c) => c.id === c1.id)!.lessons.length, 3, "lições acompanham o cartão");
  ok("lições aprendidas: só em Perdido/Concluído, várias por cartão, editar e remover");

  // Auditoria e integridade
  const log = await db.select().from(schema.activityLog);
  const actions = new Set(log.map((l) => l.action));
  for (const a of ["strategy.card_create", "strategy.card_move", "strategy.card_update", "strategy.lesson_add", "strategy.lesson_update", "strategy.lesson_remove"]) assert.ok(actions.has(a), `auditoria registra ${a}`);
  await K.removeCard(ctx(mA), c2.id);
  await must(K.removeCard(ctx(mA), c2.id), "não encontrado");
  await db.delete(schema.offers).where(eq(schema.offers.id, offX.id));
  assert.equal((await db.select().from(schema.offerCards).where(eq(schema.offerCards.offerId, offX.id))).length, 0);
  assert.equal((await db.select().from(schema.offerCardLessons)).length, 0, "remover a oferta limpa cartões e lições");
  ok("auditoria e integridade");

  await closeDb();
  console.log("\nOK — estratégia de vendas passou.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
