import assert from "node:assert/strict";

delete process.env.DATABASE_URL;
process.env.PGLITE_DIR = "memory://";
delete process.env.RESEND_API_KEY;

async function main() {
  const ok = (name: string) => console.log(`  ✓ ${name}`);
  const { getDb, closeDb } = await import("../lib/db");
  const { createUser } = await import("../domains/users/service");
  const { createMentee } = await import("../domains/mentees/service");
  const { listTemplates } = await import("../domains/templates/service");
  const { createProgram } = await import("../domains/programs/service");
  const O = await import("../domains/offers/service");
  const A = await import("../domains/offers/answers");
  await getDb();
  type Ctx = Parameters<typeof O.listOffers>[0];
  const ctx = (u: { id: string; role: Ctx["role"] }): Ctx => ({ userId: u.id, role: u.role, mentorScope: "assigned" });
  const must = async (p: Promise<unknown>, msg: string) => { await assert.rejects(p, new RegExp(msg)); };

  const admin = (await createUser(null, { name: "Adm", email: "a@t.invalid", role: "admin", password: "senha-inicial-1", sendEmail: false })).user;
  const dir = (await createUser(ctx(admin), { name: "Dir", email: "d@t.invalid", role: "direcao", sendEmail: false })).user;
  const mA = (await createUser(ctx(admin), { name: "Mentor A", email: "ma@t.invalid", role: "mentor", sendEmail: false })).user;
  const mB = (await createUser(ctx(admin), { name: "Mentor B", email: "mb@t.invalid", role: "mentor", sendEmail: false })).user;
  const x = await createMentee(ctx(dir), { fullName: "X (fictício)", email: "x@m.invalid", mentorIds: [mA.id], createAccess: true, sendEmail: false });
  const xU = x.grant!.user;
  const [base] = await listTemplates(ctx(mA));
  const prog = await createProgram(ctx(dir), { menteeId: x.mentee.id, templateId: base.id, name: "Programa X" });
  const off = await O.createOffer(ctx(mA), prog.id, { revenueSlug: "workshops", name: "Workshop de Delegação", problem: "Gestores sobrecarregados", audience: "Gestores de PMEs" });
  const off2 = await O.createOffer(ctx(mA), prog.id, { revenueSlug: "cursos", name: "Curso B", problem: "Comunicação ineficaz", audience: "Líderes" });

  // Prompt
  const prompt = await A.buildOfferPrompt(ctx(xU), off.id);
  assert.match(prompt, /Workshop de Delegação/);
  assert.match(prompt, /ficha-oferta/);
  assert.match(prompt, /publico — Público/);
  assert.match(prompt, /entrega-replicavel/);
  assert.match(prompt, /Não invente/);
  assert.match(prompt, /"versao": 1/);
  assert.doesNotMatch(prompt, /primeira-venda — /, "itens de vendas não entram");
  await must(A.buildOfferPrompt(ctx(mB), off.id), "Acesso negado");
  ok("prompt: contexto, ferramentas, itens, regras e formato; sem itens de vendas; respeita acesso");

  const ficha = { publico: "Gestores de PMEs", problema: "Sobrecarga", solucao: "Workshop de delegação", proposta_valor: "Mais tempo para liderar", formato: "Workshop de 4h", hipotese: "3 de 5 convites aceitos" };
  const answer = "Claro! Aqui está:\n```json\n" + JSON.stringify({ versao: 1, oferta: "workshop de delegação", ferramentas: { "ficha-oferta": ficha, precificacao: { modelo: "Por turma", preco: "R$ 4.000" } }, itens: { "entrega-replicavel": "Roteiro minuto a minuto no Drive", "primeira-venda": "x" } }, null, 2) + "\n```\nSe precisar, me diga mais.";

  // Erros
  await must(A.importOfferAnswers(ctx(xU), off.id, "sem json", false), "bloco JSON");
  await must(A.importOfferAnswers(ctx(xU), off.id, "{ quebrado", false), "bloco JSON|defeito");
  await must(A.importOfferAnswers(ctx(xU), off2.id, answer, false), "é da oferta");
  await must(A.importOfferAnswers(ctx(xU), off.id, JSON.stringify({ versao: 1, oferta: "Workshop de Delegação", ferramentas: { "ficha-oferta": { formato: "x".repeat(600) } } }), false), "texto longo|longo demais");
  await must(A.importOfferAnswers(ctx(mB), off.id, answer, false), "Acesso negado");
  ok("importação: recusa texto sem JSON, JSON quebrado, oferta errada, campo inválido e acesso indevido");

  // Conferir não grava
  const dry = await A.importOfferAnswers(ctx(xU), off.id, answer, false);
  assert.equal(dry.applied, false);
  assert.equal(dry.tools, 2);
  assert.equal(dry.items, 1);
  assert.match(dry.report.join("\n"), /obrigatórios completos/);
  assert.match(dry.report.join("\n"), /rascunho \(falta/, "precificação sem custos fica rascunho");
  assert.match(dry.report.join("\n"), /primeira-venda/, "item de vendas ignorado");
  assert.equal((await O.getOffer(ctx(xU), off.id)).checks.length, 0, "conferir não grava");

  // Importar como mentorado: pendente
  const r = await A.importOfferAnswers(ctx(xU), off.id, answer, true);
  assert.deepEqual([r.applied, r.tools, r.items], [true, 2, 1]);
  let g = await O.getOffer(ctx(xU), off.id);
  const byKey = new Map(g.checks.map((c) => [c.gateKey, c]));
  assert.equal(byKey.get("ficha-1-pagina")?.state, "pendente");
  assert.match(byKey.get("ficha-1-pagina")!.evidence, /IA do assessorado/);
  assert.equal(byKey.get("entrega-replicavel")?.state, "pendente");
  assert.equal(byKey.has("preco"), false, "precificação incompleta não comprova o preço");
  assert.equal(g.offer.stage, 1, "pendente não avança o estágio");
  ok("importação como mentorado: ficha concluída → item pendente; precificação incompleta vira rascunho; estágio não avança");

  // Reimportar: ferramenta concluída é pulada; item já marcado também
  const again = await A.importOfferAnswers(ctx(xU), off.id, JSON.stringify({ versao: 1, oferta: "Workshop de Delegação", ferramentas: { "ficha-oferta": ficha, precificacao: { custos: "Meu tempo e deslocamento" } }, itens: { "entrega-replicavel": "outra" } }), true);
  assert.equal(again.tools, 1, "só a precificação (rascunho) segue");
  assert.match(again.report.join("\n"), /ficha-oferta.*ignorada|ignorada/);
  g = await O.getOffer(ctx(xU), off.id);
  assert.equal(new Map(g.checks.map((c) => [c.gateKey, c])).get("preco")?.state, "pendente", "completou a precificação → preço pendente");
  ok("reimportar: completa o rascunho, pula o que já está concluído ou marcado");

  // Equipe importando também grava PENDENTE (revisão obrigatória)
  const off3 = await O.createOffer(ctx(mA), prog.id, { revenueSlug: "workshops", name: "Oficina C", problem: "p", audience: "a" });
  await A.importOfferAnswers(ctx(mA), off3.id, JSON.stringify({ versao: 1, oferta: "Oficina C", ferramentas: { "ficha-oferta": ficha }, itens: { "meta-receita": "R$ 20 mil por trimestre" } }), true);
  const g3 = await O.getOffer(ctx(mA), off3.id);
  assert.deepEqual(g3.checks.map((c) => c.state).sort(), ["pendente", "pendente"], "mesmo importando a equipe, fica pendente");
  assert.equal(g3.offer.stage, 1);
  ok("equipe importando: também pendente; o mentor confirma depois");

  // Prompt encolhe: o que já foi marcado não volta
  const p2 = await A.buildOfferPrompt(ctx(mA), off3.id);
  assert.doesNotMatch(p2, /ficha-oferta/);
  assert.doesNotMatch(p2, /meta-receita —/);
  assert.match(p2, /precificacao/);
  ok("prompt só pede o que ainda falta");

  await closeDb();
  console.log("\nOK — completar oferta com a IA passou.");
}

main().catch((e) => { console.error(e); process.exit(1); });
