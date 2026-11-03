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
  const { parseOfferTable } = await import("../domains/offers/import");
  await getDb();
  type Ctx = Parameters<typeof O.listOffers>[0];
  const ctx = (u: { id: string; role: Ctx["role"] }): Ctx => ({ userId: u.id, role: u.role, mentorScope: "assigned" });
  const must = async (p: Promise<unknown>, msg: string) => { await assert.rejects(p, new RegExp(msg)); };

  // Formato agrupado, como colado do documento: nota (*) e título colados na mesma linha, "Primeira venda*"
  const grouped = [
    "Receita 1 — Autoridade e marca pessoal (Nível 1)",
    "Objetivo: visibilidade.",
    "Nome da oferta\tProblema que resolve / Público\tMeta de estágio\tPrazo\tOnda\tPreço",
    "Liga (LNL)\tFalta de desenvolvimento contínuo. Líderes, profissionais e empresas\tEscala\tMar/27\tVender e validar\tGratuito inicialmente",
    "Jogo do Detetive\tDificuldade de aplicar. Equipes\tPrimeira venda*\tFev/27\tVender e validar\tGratuito",
    "*Para a LNL gratuita, interpretar “Primeira venda” como adesão.Receita 4 — Cursos e treinamentos online (Nível 2)",
    "Curso de Oratória\tComunicação ineficaz. Líderes\tValidada\tFev/27\tAumentar ticket\tR$ 197–497 estimado",
    "Sistema de Carreira\tFalta de acompanhamento. RH\tPrototipação\tJul/27\tRecorrência\tA definir",
  ].join("\n");
  const g = parseOfferTable(grouped);
  assert.deepEqual(g.errors, []);
  assert.equal(g.offers.length, 4);
  assert.deepEqual(
    g.offers.map((o) => [o.revenueSlug, o.targetStage, o.dueDate, o.wave]),
    [["autoridade", 7, "2027-03-31", 1], ["autoridade", 5, "2027-02-28", 1], ["cursos", 6, "2027-02-28", 2], ["cursos", 2, "2027-07-31", 3]],
  );
  assert.equal(g.offers[0].problem, "Falta de desenvolvimento contínuo");
  assert.equal(g.offers[0].audience, "Líderes, profissionais e empresas");
  assert.equal(g.offers[3].priceNote, "A definir");
  ok("leitor: formato agrupado (nota e título colados, '*', meta Prototipação, prazo → fim do mês)");

  // Formato plano (planilha), inclusive data que o Excel converteu
  const flat = [
    "Receita\tNome da oferta\tProblema que resolve\tPúblico\tMeta de estágio\tPrazo (Mmm/AA)\tOnda\tPreço",
    "2 · Workshops, palestras e eventos\tWorkshop X\tGestores sobrecarregados\tPMEs\tPrimeira venda\t2027-03-01\tVender e validar\tR$ 4.000",
    "9 · Conselhos e advisory\tConselho Y\tFalta de apoio\tPMEs\tValidada\t01/04/2027\tRecorrência\t",
  ].join("\n");
  const f = parseOfferTable(flat);
  assert.deepEqual(f.errors, []);
  assert.deepEqual(f.offers.map((o) => [o.revenueSlug, o.dueDate, o.priceNote]), [["workshops", "2027-03-31", "R$ 4.000"], ["conselhos", "2027-04-30", undefined]]);
  ok("leitor: formato plano da planilha (data convertida pelo Excel)");

  // Erros úteis, sem importar nada
  const bad = parseOfferTable("Receita 1 — X\nA\tSó problema sem publico\tTalvez\tMar/27\tVender e validar\t1\nB\tProb. Pub\tEscala\tMar/27\tOnda errada\t1\nsolta");
  assert.ok(bad.errors.length >= 3, bad.errors.join("|"));
  assert.match(bad.errors.join("|"), /meta "Talvez"/);
  ok("leitor: erros apontam a linha e o campo");

  // Importação no programa
  const admin = (await createUser(null, { name: "Adm", email: "a@t.invalid", role: "admin", password: "senha-inicial-1", sendEmail: false })).user;
  const dir = (await createUser(ctx(admin), { name: "Dir", email: "d@t.invalid", role: "direcao", sendEmail: false })).user;
  const mA = (await createUser(ctx(admin), { name: "Mentor A", email: "ma@t.invalid", role: "mentor", sendEmail: false })).user;
  const mB = (await createUser(ctx(admin), { name: "Mentor B", email: "mb@t.invalid", role: "mentor", sendEmail: false })).user;
  const x = await createMentee(ctx(dir), { fullName: "Instituto (fictício)", email: "x@m.invalid", mentorIds: [mA.id], createAccess: true, sendEmail: false });
  const xU = x.grant!.user;
  const [base] = await listTemplates(ctx(mA));
  const prog = await createProgram(ctx(dir), { menteeId: x.mentee.id, templateId: base.id, name: "Programa IDL" });

  await must(O.importOffers(ctx(mB), prog.id, grouped, true), "Acesso negado");
  await must(O.importOffers(ctx(xU), prog.id, grouped, true), "Acesso negado");
  await must(O.importOffers(ctx(mA), prog.id, "nada", true), "Nada foi importado");
  const dry = await O.importOffers(ctx(mA), prog.id, grouped, false);
  assert.deepEqual([dry.total, dry.created, dry.applied], [4, 4, false]);
  assert.equal((await O.listOffers(ctx(mA), prog.id)).length, 0, "conferir não grava");
  const done = await O.importOffers(ctx(mA), prog.id, grouped, true);
  assert.deepEqual([done.created, done.skipped.length], [4, 0]);
  const list = await O.listOffers(ctx(mA), prog.id);
  const lna = list.find((o) => o.name === "Liga (LNL)")!;
  assert.deepEqual([lna.level, lna.targetStage, lna.dueDate, lna.wave, lna.stage], [1, 7, "2027-03-31", 1, 1], "nasce em Ideia, com meta, prazo e onda");
  assert.equal(list.find((o) => o.name === "Curso de Oratória")!.level, 2, "nível vem da receita");
  const again = await O.importOffers(ctx(mA), prog.id, grouped, true);
  assert.deepEqual([again.created, again.skipped.length], [0, 4], "reimportar pula os já existentes");
  assert.equal((await O.listOffers(ctx(mA), prog.id)).length, 4);
  ok("importação: confere sem gravar, cria em Ideia com meta/prazo/onda, pula repetidas, respeita acesso");

  await closeDb();
  console.log("\nOK — importação de ofertas passou.");
}

main().catch((e) => { console.error(e); process.exit(1); });
