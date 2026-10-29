import assert from "node:assert/strict";

delete process.env.DATABASE_URL;
process.env.PGLITE_DIR = "memory://";
delete process.env.RESEND_API_KEY;

async function main() {
  const ok = (name: string) => console.log(`  ✓ ${name}`);
  const U = await import("../domains/users/service");
  const M = await import("../domains/mentees/service");
  const S = await import("../domains/support/service");
  const { areaFromPath } = await import("../lib/support");
  const { closeDb } = await import("../lib/db");
  type Ctx = Parameters<typeof S.createTicket>[0];
  const ctx = (u: { id: string; role: Ctx["role"] }, scope: "all" | "assigned" = "assigned"): Ctx => ({ userId: u.id, role: u.role, mentorScope: scope });

  const admin = ctx((await U.createUser(null, { name: "Adm", email: "adm@ex.com", role: "admin", sendEmail: false })).user);
  const m1u = (await U.createUser(null, { name: "Mentor 1", email: "m1@ex.com", role: "mentor", sendEmail: false })).user;
  const m2u = (await U.createUser(null, { name: "Mentor 2", email: "m2@ex.com", role: "mentor", sendEmail: false })).user;
  const a = await M.createMentee(admin, { fullName: "Ana", email: "ana@ex.com", createAccess: true, sendEmail: false, mentorIds: [m1u.id] });
  const b = await M.createMentee(admin, { fullName: "Bia", email: "bia@ex.com", createAccess: true, sendEmail: false, mentorIds: [m2u.id] });
  const ana = ctx({ id: a.mentee.userId!, role: "mentorado" });
  const bia = ctx({ id: b.mentee.userId!, role: "mentorado" });

  assert.equal(areaFromPath("/app/cadencia"), "cadencia");
  assert.equal(areaFromPath("/app/ofertas/123"), "ofertas");
  assert.equal(areaFromPath("/app/mentorados/9"), "plano");
  assert.equal(areaFromPath("/qualquer"), "outro");
  ok("área detectada pela tela de origem");

  // abertura
  const t = await S.createTicket(ana, { kind: "duvida", area: "cadencia", title: "  Como lançar KPI? ", description: "não acho", pagePath: "/app/cadencia" });
  assert.equal(t.menteeId, a.mentee.id, "mentorado abre sempre no próprio cadastro");
  assert.equal(t.status, "aberto");
  assert.equal(t.title, "Como lançar KPI?");
  await assert.rejects(() => S.createTicket(ana, { kind: "x", area: "cadencia", title: "t" }), /Tipo/);
  await assert.rejects(() => S.createTicket(ana, { kind: "ajuda", area: "xx", title: "t" }), /funcionalidade/);
  await assert.rejects(() => S.createTicket(ana, { kind: "ajuda", area: "outro", title: "  " }), /assunto/);
  const hijack = await S.createTicket(ana, { kind: "ajuda", area: "outro", title: "tentando", menteeId: b.mentee.id });
  assert.equal(hijack.menteeId, a.mentee.id, "mentorado não abre chamado em nome de outro");
  const bad = await S.createTicket(ana, { kind: "ajuda", area: "outro", title: "caminho", pagePath: "javascript:alert(1)" });
  assert.equal(bad.pagePath, null, "caminho de origem inválido descartado");
  ok("abertura: validações; mentorado só no próprio cadastro");

  // visibilidade
  await S.createTicket(bia, { kind: "problema", area: "ofertas", title: "Erro nas ofertas" });
  assert.equal((await S.listTickets(ana)).every((x) => x.menteeId === a.mentee.id), true, "mentorado vê só os dele");
  assert.equal((await S.listTickets(ctx(m1u))).every((x) => x.menteeId === a.mentee.id), true, "mentor vê só a carteira dele");
  assert.equal((await S.listTickets(admin)).length, 4, "admin vê todos");
  await assert.rejects(() => S.getTicket(bia, t.id), /negado/);
  await assert.rejects(() => S.getTicket(ctx(m2u), t.id), /negado/);
  ok("visibilidade: mentorado, mentor da carteira e admin");

  // atendimento
  await S.addMessage(ctx(m1u), t.id, { body: "nota para o time", internal: true });
  assert.equal((await S.getTicket(admin, t.id)).ticket.status, "aberto", "nota interna não assume");
  await S.addMessage(ctx(m1u), t.id, { body: "Veja a aba Metas semanais" });
  const g = await S.getTicket(ana, t.id);
  assert.equal(g.ticket.status, "em_andamento");
  assert.equal(g.ticket.assignedTo, m1u.id);
  assert.equal(g.messages.length, 1, "mentorado não vê nota interna");
  assert.equal((await S.getTicket(admin, t.id)).messages.length, 2);
  await assert.rejects(() => S.resolveTicket(ana, t.id, "eu resolvo"), /negado/);
  await assert.rejects(() => S.resolveTicket(ctx(m1u), t.id, "  "), /solução/i);
  await S.resolveTicket(ctx(m1u), t.id, "Abra Cadência > semana e preencha os KPIs.");
  let r = (await S.getTicket(ana, t.id)).ticket;
  assert.equal(r.status, "resolvido");
  assert.ok(r.resolvedAt);
  await S.addMessage(ana, t.id, { body: "ainda não funcionou" });
  r = (await S.getTicket(ana, t.id)).ticket;
  assert.equal(r.status, "aberto", "resposta do mentorado reabre");
  ok("atendimento: nota interna oculta, assumir, resolver só equipe, reabrir");

  // painel
  await S.resolveTicket(admin, t.id, "Solução final.");
  const p = await S.supportPanel(admin);
  assert.equal(p.total, 4);
  assert.equal(p.byStatus.resolvido, 1);
  assert.equal(p.solutions.length, 1);
  assert.ok(p.areas.length >= 2);
  await assert.rejects(() => S.supportPanel(ana), /negado/);
  ok("painel de dúvidas: contagens, áreas e soluções; mentorado não acessa");

  await closeDb();
  console.log("\nOK — chamados passaram.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
