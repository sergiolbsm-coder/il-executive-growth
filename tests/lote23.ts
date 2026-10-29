import assert from "node:assert/strict";

delete process.env.DATABASE_URL;
process.env.PGLITE_DIR = "memory://";
delete process.env.RESEND_API_KEY;

async function main() {
  const ok = (name: string) => console.log(`  ✓ ${name}`);
  const W = await import("../lib/week");
  const S = await import("../domains/score/compute");
  const T = await import("../domains/tools/service");
  const { todayBR } = await import("../domains/offers/stage");

  // ── Semanas ───────────────────────────────────────────────────────────
  assert.equal(W.mondayOf("2026-10-26"), "2026-10-26", "26/10/2026 é segunda");
  assert.equal(W.mondayOf("2026-10-28"), "2026-10-26");
  assert.equal(W.mondayOf("2026-11-01"), "2026-10-26", "domingo pertence à semana que começou na segunda anterior");
  assert.equal(W.mondayOf("2026-11-02"), "2026-11-02");
  assert.ok(W.isMonday("2026-10-26") && !W.isMonday("2026-10-27") && !W.isMonday("lixo"));
  assert.equal(W.addDays("2026-12-28", 7), "2027-01-04", "virada de ano");
  assert.deepEqual(W.mondaysOfMonth("2026-10"), ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  assert.deepEqual(W.mondaysOfMonth("2026-11"), ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
  assert.equal(W.weekLabel("2026-10-26"), "26/10 a 01/11");
  ok("semanas: segunda-feira, virada de mês/ano e semanas do mês");

  // ── Pesos e score (puro) ──────────────────────────────────────────────
  assert.deepEqual(S.normalizeWeights({ informacao: 1, ferramentas: 1, ofertas: 1, estrutura: 1, tracao: 1 }), { informacao: 20, ferramentas: 20, ofertas: 20, estrutura: 20, tracao: 20 });
  const nw = S.normalizeWeights({ informacao: 1, ferramentas: 1, ofertas: 1, estrutura: 0, tracao: 0 });
  assert.equal(Object.values(nw).reduce((a, b) => a + b, 0), 100, "sempre soma 100");
  assert.equal(nw.estrutura, 0);
  assert.deepEqual(S.normalizeWeights({}), S.DEFAULT_WEIGHTS);
  assert.deepEqual(S.normalizeWeights(null), S.DEFAULT_WEIGHTS);
  assert.equal(Object.values(S.normalizeWeights({ informacao: 33, ferramentas: 33, ofertas: 34 })).reduce((a, b) => a + b, 0), 100);

  const empty: Parameters<typeof S.computeScore>[0] = {
    program: { purpose: null, weeklyHours: null, startDate: null, endDate: null }, sessionsCount: 0,
    sources: [{ slug: "a", name: "A", level: 1 }, { slug: "b", name: "B", level: 3 }],
    offers: [], tools: [{ slug: "t1", name: "T1", weight: 3, strategic: true, credit: null }, { slug: "t2", name: "T2", weight: 1, strategic: false, credit: null }],
    sales: [], cadence: { attainment: null, checkinWeeks: 0, weeks: 4 },
  };
  const s0 = S.computeScore(empty);
  assert.equal(s0.total, 0, "nada preenchido = 0");
  assert.equal(s0.components.length, 5);
  assert.ok(s0.steps.length > 0 && s0.steps.length <= 3, "sugere até 3 próximos passos");
  assert.ok(s0.steps[0].upTo >= s0.steps[s0.steps.length - 1].upTo, "ordenados pelo maior ganho possível");

  const full: typeof empty = {
    program: { purpose: "Transformar organizações educacionais para gerar impacto duradouro.", weeklyHours: 6, startDate: "2026-10-26", endDate: "2027-04-30" }, sessionsCount: 2,
    sources: empty.sources,
    offers: [
      { name: "Base", level: 1, stage: 7, status: "ativa", priceNote: "R$ 1.000", dueDate: "2026-12-01", wave: 1, problem: "Escolas sem porta de entrada comercial clara", audience: "Mantenedores e diretores de escolas privadas", revenueSlug: "a" },
      { name: "Topo", level: 3, stage: 7, status: "ativa", priceNote: "R$ 9.000", dueDate: "2027-02-01", wave: 2, problem: "Gestão escolar travada por silos entre áreas", audience: "Escolas privadas com mais de 500 alunos", revenueSlug: "b" },
    ],
    tools: [{ slug: "t1", name: "T1", weight: 3, strategic: true, credit: "revisada" }, { slug: "t2", name: "T2", weight: 1, strategic: false, credit: "revisada" }],
    sales: Array.from({ length: 5 }, () => ({ hasOrigin: true })), cadence: { attainment: 1, checkinWeeks: 4, weeks: 4 },
  };
  const s1 = S.computeScore(full);
  assert.equal(s1.total, 100, "tudo completo = 100");
  assert.equal(s1.steps.length, 0, "sem passos quando não há o que ganhar");

  // monotonia: concluir ferramenta/avançar oferta nunca reduz o score
  const prev = S.computeScore({ ...full, tools: full.tools.map((t) => ({ ...t, credit: null })) }).total;
  const conc = S.computeScore({ ...full, tools: full.tools.map((t) => ({ ...t, credit: "concluida" as const })) }).total;
  assert.ok(prev < conc && conc < s1.total, "rascunho < concluída (60%) < revisada (100%)");
  const rasc = S.computeScore({ ...full, tools: full.tools.map((t) => ({ ...t, credit: "rascunho" as const })) }).total;
  assert.equal(rasc, prev, "rascunho não pontua (qualidade antes de volume)");
  // ferramenta estratégica pesa o dobro
  const onlyStrategic = S.computeScore({ ...empty, tools: [{ ...empty.tools[0], credit: "revisada" }, empty.tools[1]] }).components.find((c) => c.key === "ferramentas")!.ratio;
  const onlyPlain = S.computeScore({ ...empty, tools: [empty.tools[0], { ...empty.tools[1], credit: "revisada" }] }).components.find((c) => c.key === "ferramentas")!.ratio;
  assert.ok(onlyStrategic > onlyPlain, "estratégica (peso 3×2) vale mais que a comum (peso 1)");
  // oferta de nível alto madura vale mais que oferta de nível baixo madura
  const hi = S.computeScore({ ...full, offers: [{ ...full.offers[0], stage: 1 }, { ...full.offers[1], stage: 7 }] }).components.find((c) => c.key === "ofertas")!.ratio;
  const lo = S.computeScore({ ...full, offers: [{ ...full.offers[0], stage: 7 }, { ...full.offers[1], stage: 1 }] }).components.find((c) => c.key === "ofertas")!.ratio;
  assert.ok(hi > lo, "maturidade no nível alto pesa mais");
  // pesos mudam o total sem mudar as proporções
  const heavy = S.computeScore({ ...full, tools: full.tools.map((t) => ({ ...t, credit: null })) }, { informacao: 1, ferramentas: 97, ofertas: 1, estrutura: 1, tracao: 0 });
  assert.ok(heavy.total < 10, "com 97% do peso em ferramentas e nenhuma usada, o total despenca");
  assert.equal(heavy.weights.tracao, 0);
  // base fina gera dica
  const thin = S.computeScore({ ...full, offers: [full.offers[1], { ...full.offers[1], name: "Topo 2", revenueSlug: "b" }] }).components.find((c) => c.key === "estrutura")!;
  assert.ok(thin.hints.some((h) => h.startsWith("Base fina")));
  ok("score: pesos normalizados, pontuação por qualidade, estratégicas e níveis pesam mais, próximos passos");

  // ── Validação de campos de ferramenta ─────────────────────────────────
  assert.throws(() => T.validateFields([]), /ao menos um campo/);
  assert.throws(() => T.validateFields([{ key: "A", label: "x", type: "text" }]), /identificador/);
  assert.throws(() => T.validateFields([{ key: "a", label: "x", type: "text" }, { key: "a", label: "y", type: "text" }]), /repetido/);
  assert.throws(() => T.validateFields([{ key: "a", label: " ", type: "text" }]), /rótulo/);
  assert.throws(() => T.validateFields([{ key: "a", label: "x", type: "foto" }]), /tipo/);
  assert.throws(() => T.validateFields([{ key: "a", label: "x", type: "select" }]), /opções/);
  assert.throws(() => T.validateFields(Array.from({ length: 41 }, (_, i) => ({ key: `k${i}`, label: "x", type: "text" }))), /40 campos/);
  const fields = T.validateFields([
    { key: "nome", label: "Nome", type: "text", required: true }, { key: "qtd", label: "Qtd", type: "number" }, { key: "link", label: "Link", type: "url" },
    { key: "modelo", label: "Modelo", type: "select", options: ["A", "B"], required: true }, { key: "itens", label: "Itens", type: "checklist", options: ["x", "y", "z"] },
  ]);
  assert.deepEqual(T.validateEntryData(fields, { nome: " Ana ", qtd: "3,5", link: "https://exemplo.com/x", modelo: "A", itens: ["x", "z"], extra: "descartado" }, true), { nome: "Ana", qtd: 3.5, link: "https://exemplo.com/x", modelo: "A", itens: ["x", "z"] });
  assert.throws(() => T.validateEntryData(fields, { modelo: "A" }, true), /Preencha: Nome/);
  assert.doesNotThrow(() => T.validateEntryData(fields, {}, false), "rascunho aceita vazio");
  assert.throws(() => T.validateEntryData(fields, { nome: "x", modelo: "A", qtd: "abc" }, false), /número/);
  assert.throws(() => T.validateEntryData(fields, { nome: "x", modelo: "A", link: "ftp://x" }, false), /http/);
  assert.throws(() => T.validateEntryData(fields, { nome: "x", modelo: "C" }, false), /opção inválida/);
  assert.throws(() => T.validateEntryData(fields, { nome: "x", modelo: "A", itens: ["w"] }, false), /opção inválida/);
  ok("campos declarativos: definição e preenchimento validados");

  // ── Com banco ─────────────────────────────────────────────────────────
  const { getDb, schema, closeDb } = await import("../lib/db");
  const { createUser } = await import("../domains/users/service");
  const { createMentee } = await import("../domains/mentees/service");
  const { listTemplates, getTemplate, deriveTemplate } = await import("../domains/templates/service");
  const { createProgram, getProgram } = await import("../domains/programs/service");
  const { loadTemplateDefaults } = await import("../domains/programs/defaults");
  const O = await import("../domains/offers/service");
  const SS = await import("../domains/sessions/service");
  const C = await import("../domains/cadence/service");
  const SC = await import("../domains/score/service");
  const { eq, and } = await import("drizzle-orm");
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
  const progX = await createProgram(ctx(dir), { menteeId: x.mentee.id, templateId: base.id, name: "Programa X", purpose: "Propósito de teste suficientemente longo." });
  const progY = await createProgram(ctx(dir), { menteeId: y.mentee.id, templateId: base.id, name: "Programa Y" });

  // Snapshots no programa
  const pk = await C.listKpis(progX.id);
  assert.equal(pk.length, 11, "programa recebe os KPIs do template");
  assert.equal(pk.find((k) => k.key === "conexoes")?.weeklyTarget, 20);
  const pt = await T.listProgramTools(ctx(mA), progX.id);
  assert.equal(pt.tools.length, 11, "programa recebe as 11 ferramentas declarativas (sem Planner externo)");
  assert.equal(pt.tools.filter((t) => t.kind === "externa").length, 0);
  assert.ok(!pt.tools.some((t) => t.slug === "planner-lider"), "link do Planner removido (migração 0011)");
  assert.ok(pt.tools.every((t) => t.best === null));
  ok("programa novo recebe KPIs e ferramentas do template (snapshot)");

  // ── Sessões e tarefas ─────────────────────────────────────────────────
  await must(SS.createSession(ctx(xU), progX.id, { heldOn: "2026-10-26", title: "Kick-off" }), "Acesso negado");
  await must(SS.createSession(ctx(mB), progX.id, { heldOn: "2026-10-26", title: "Kick-off" }), "Acesso negado");
  await must(SS.createSession(ctx(mA), progX.id, { heldOn: "2026-10-26", title: " " }), "título");
  await must(SS.createSession(ctx(mA), progX.id, { heldOn: "26/10/2026", title: "x" }), "data");
  await must(SS.createSession(ctx(mA), progX.id, { heldOn: "2026-10-26", title: "x", summary: "a".repeat(8001) }), "longo demais");
  const sess = await SS.createSession(ctx(mA), progX.id, { heldOn: "2026-10-26", title: "Kick-off", summary: "Alinhamos propósito e portfólio.", decisions: "Começar por palestras e diagnóstico.", internalNotes: "Mentorada insegura com preço." });
  const asStaff = await SS.listSessions(ctx(mA));
  assert.equal(asStaff.length, 1);
  assert.equal(asStaff[0].internalNotes, "Mentorada insegura com preço.");
  const asMentee = await SS.listSessions(ctx(xU));
  assert.equal(asMentee.length, 1, "mentorado vê as sessões do próprio programa");
  assert.equal(asMentee[0].internalNotes, null, "notas internas NUNCA vão ao mentorado");
  assert.equal(asMentee[0].summary, "Alinhamos propósito e portfólio.");
  assert.equal((await SS.listSessions(ctx(mB))).length, 0, "outro mentor não vê");
  assert.equal((await SS.listSessions(ctx(yU))).length, 0);
  await must(SS.listSessions(ctx(mB), progX.id), "Acesso negado");
  const up = await SS.updateSession(ctx(mA), sess.id, { title: "Kick-off (ajustado)", internalNotes: "Novas notas" });
  assert.equal(up.title, "Kick-off (ajustado)");
  await must(SS.updateSession(ctx(xU), sess.id, { title: "x" }), "Acesso negado");
  await must(SS.updateSession(ctx(mA), "00000000-0000-0000-0000-000000000000", { title: "x" }), "não encontrada");
  ok("sessões: ata compartilhada, notas internas ocultas do mentorado, isolamento");

  const offer = await O.createOffer(ctx(mA), progX.id, { revenueSlug: "workshops", name: "Palestras", problem: "Escolas sem porta de entrada comercial", audience: "Mantenedores e diretores" });
  const otherOffer = await O.createOffer(ctx(mB), progY.id, { revenueSlug: "workshops", name: "Palestras Y", problem: "Escolas sem porta de entrada comercial", audience: "Mantenedores e diretores" });
  await must(SS.createTask(ctx(xU), progX.id, { title: "x" }), "Acesso negado");
  await must(SS.createTask(ctx(mA), progX.id, { title: " " }), "tarefa");
  await must(SS.createTask(ctx(mA), progX.id, { title: "x", dueDate: "amanhã" }), "Data inválida");
  await must(SS.createTask(ctx(mA), progX.id, { title: "x", assignee: "outro" as any }), "Responsável");
  await must(SS.createTask(ctx(mA), progX.id, { title: "x", offerId: otherOffer.id }), "Oferta inválida");
  await must(SS.createTask(ctx(mA), progY.id, { title: "x", sessionId: sess.id }), "Acesso negado");
  const tMentee = await SS.createTask(ctx(mA), progX.id, { title: "Enviar a ficha da oferta", dueDate: "2026-11-05", sessionId: sess.id, offerId: offer.id });
  const tMentor = await SS.createTask(ctx(mA), progX.id, { title: "Revisar o pitch", assignee: "mentor", dueDate: "2026-11-02" });
  assert.equal(tMentee.assignee, "mentorado", "padrão: responsável é o mentorado");
  await SS.setTaskStatus(ctx(xU), tMentee.id, "concluida");
  await must(SS.setTaskStatus(ctx(xU), tMentor.id, "concluida"), "Acesso negado");
  await must(SS.setTaskStatus(ctx(xU), tMentee.id, "cancelada"), "Acesso negado");
  await must(SS.setTaskStatus(ctx(yU), tMentee.id, "aberta"), "Acesso negado");
  await must(SS.setTaskStatus(ctx(mB), tMentor.id, "concluida"), "Acesso negado");
  await must(SS.setTaskStatus(ctx(mA), tMentee.id, "inventada" as any), "inválida");
  let tl = await SS.listTasks(ctx(mA));
  assert.equal(tl.find((t) => t.id === tMentee.id)!.status, "concluida");
  assert.ok(tl.find((t) => t.id === tMentee.id)!.completedAt, "registra quando concluiu");
  assert.equal(tl[0].id, tMentor.id, "abertas primeiro");
  await SS.setTaskStatus(ctx(xU), tMentee.id, "aberta");
  assert.equal((await SS.listTasks(ctx(mA))).find((t) => t.id === tMentee.id)!.completedAt, null, "reabrir limpa a conclusão");
  await SS.setTaskStatus(ctx(mA), tMentor.id, "cancelada");
  assert.equal((await SS.listTasks(ctx(xU))).length, 2, "mentorado vê as tarefas do programa");
  assert.equal((await SS.listTasks(ctx(mB))).length, 0);
  ok("tarefas: validações, mentorado conclui só as dele, equipe cancela, isolamento");

  // ── Cadência ──────────────────────────────────────────────────────────
  const wk = W.currentWeek();
  const prevWk = W.addDays(wk, -7);
  await must(C.getWeek(ctx(mB), progX.id, wk), "Acesso negado");
  await must(C.getWeek(ctx(yU), progX.id, wk), "Acesso negado");
  await must(C.getWeek(ctx(mA), progX.id, "2026-10-27"), "segunda-feira");
  const w0 = await C.getWeek(ctx(xU), progX.id, wk);
  assert.equal(w0.kpis.length, 11);
  assert.equal(w0.canConfigure, false, "mentorado não configura metas");
  assert.deepEqual(w0.actuals, {});
  await must(C.saveKpiEntries(ctx(xU), progX.id, W.addDays(wk, 7), { conexoes: 1 }), "futuras");
  await must(C.saveKpiEntries(ctx(xU), progX.id, "2026-10-27", { conexoes: 1 }), "segunda-feira");
  await must(C.saveKpiEntries(ctx(xU), progX.id, wk, { inexistente: 1 }), "desconhecido");
  await must(C.saveKpiEntries(ctx(xU), progX.id, wk, { conexoes: -1 }), "maiores ou iguais");
  await must(C.saveKpiEntries(ctx(xU), progX.id, wk, { conexoes: Number.NaN }), "maiores ou iguais");
  await must(C.saveKpiEntries(ctx(yU), progX.id, wk, { conexoes: 1 }), "Acesso negado");
  await must(C.saveKpiEntries(ctx(mB), progX.id, wk, { conexoes: 1 }), "Acesso negado");
  await C.saveKpiEntries(ctx(xU), progX.id, wk, { conexoes: 12, "reunioes-realizadas": 2, "contatos-diretos": 8, propostas: 0 });
  await C.saveKpiEntries(ctx(mA), progX.id, wk, { conexoes: 15 });
  assert.deepEqual((await C.getWeek(ctx(mA), progX.id, wk)).actuals, { conexoes: 15, "reunioes-realizadas": 2, "contatos-diretos": 8, propostas: 0 }, "regravar atualiza; zero é um valor válido");
  await C.saveKpiEntries(ctx(xU), progX.id, wk, { propostas: null });
  assert.equal("propostas" in (await C.getWeek(ctx(mA), progX.id, wk)).actuals, false, "null limpa o lançamento");
  ok("KPIs semanais: validações, mentorado e equipe lançam, isolamento, limpar");

  await must(C.saveCheckin(ctx(xU), progX.id, wk, { traffic: "roxo" as any }), "Semáforo");
  await must(C.saveCheckin(ctx(xU), progX.id, wk, { plan: "a".repeat(3001) }), "longo demais");
  await must(C.saveCheckin(ctx(yU), progX.id, wk, { plan: "x" }), "Acesso negado");
  await C.saveCheckin(ctx(xU), progX.id, wk, { plan: "Prospectar 20 contas", done: "Prospectei 15", result: "3 reuniões", adjust: "Mais cedo", objection: "Preço", traffic: "amarelo" });
  await C.saveCheckin(ctx(mA), progX.id, wk, { plan: "Prospectar 20 contas", traffic: "verde" });
  const ck = await C.listCheckins(ctx(mA), progX.id);
  assert.equal(ck.length, 1, "um check-in por semana (salvar de novo atualiza)");
  assert.equal(ck[0].traffic, "verde");
  assert.equal(ck[0].done, null, "campos não enviados são limpos");
  await C.saveCheckin(ctx(xU), progX.id, prevWk, { plan: "Semana anterior" });
  assert.equal((await C.listCheckins(ctx(xU), progX.id)).length, 2);
  await must(C.listCheckins(ctx(mB), progX.id), "Acesso negado");
  ok("check-in semanal (PDCA): um por semana, semáforo e limites validados");

  const ym = wk.slice(0, 7);
  const elapsed = W.mondaysOfMonth(ym).filter((m) => m <= wk).length;
  const ms = await C.monthSummary(ctx(mA), progX.id, ym);
  const con = ms.rows.find((r) => r.key === "conexoes")!;
  assert.equal(con.actual, 15 + (W.mondaysOfMonth(ym).includes(prevWk) ? 0 : 0), "soma do mês");
  assert.equal(con.target, 20 * elapsed, "meta = semanal × semanas já decorridas");
  assert.equal(con.pct, con.actual / con.target!);
  assert.equal(con.status, con.pct! >= 1 ? "verde" : con.pct! >= 0.7 ? "amarelo" : "vermelho");
  const pr = ms.rows.find((r) => r.key === "propostas")!;
  assert.equal(pr.actual, 0);
  assert.equal(pr.status, "vermelho", "sem lançamento = 0% da meta");
  assert.equal(ms.conversion, 2 / (15 + 8), "reuniões ÷ (conexões + contatos diretos)");
  const empty2 = await C.monthSummary(ctx(mB), progY.id, ym);
  assert.equal(empty2.conversion, null, "sem contatos não há taxa (nada de #DIV/0!)");
  await must(C.monthSummary(ctx(mA), progX.id, "2026-13"), "Mês inválido");
  await must(C.monthSummary(ctx(mB), progX.id, ym), "Acesso negado");
  const nextMonth = await C.monthSummary(ctx(mA), progX.id, "2099-01");
  assert.equal(nextMonth.weeks.length, 0, "mês futuro: sem semanas decorridas");
  assert.ok(nextMonth.rows.every((r) => r.target === 0 || r.target === null));
  ok("resumo do mês: meta × realizado, semáforo e conversão sem divisão por zero");

  await must(C.updateProgramKpi(ctx(xU), progX.id, "conexoes", { weeklyTarget: 1 }), "Acesso negado");
  await must(C.updateProgramKpi(ctx(mB), progX.id, "conexoes", { weeklyTarget: 1 }), "Acesso negado");
  await must(C.updateProgramKpi(ctx(mA), progX.id, "conexoes", { weeklyTarget: -1 }), "maior ou igual");
  await must(C.updateProgramKpi(ctx(mA), progX.id, "conexoes", { label: " " }), "vazio");
  await must(C.updateProgramKpi(ctx(mA), progX.id, "nao-existe", { weeklyTarget: 1 }), "não encontrado");
  await C.updateProgramKpi(ctx(mA), progX.id, "conexoes", { weeklyTarget: 30, label: "Conexões qualificadas" });
  await C.updateProgramKpi(ctx(mA), progX.id, "eventos", { weeklyTarget: null });
  assert.equal((await C.listKpis(progX.id)).find((k) => k.key === "conexoes")?.weeklyTarget, 30);
  assert.equal((await C.monthSummary(ctx(mA), progX.id, ym)).rows.find((r) => r.key === "eventos")!.status, "sem-meta");
  await C.addProgramKpi(ctx(mA), progX.id, { key: "indicacoes", label: "Indicações recebidas", weeklyTarget: 2 });
  await must(C.addProgramKpi(ctx(mA), progX.id, { key: "indicacoes", label: "dup" }), "Já existe");
  await must(C.addProgramKpi(ctx(mA), progX.id, { key: "Inválido!", label: "x" }), "Identificador");
  assert.equal((await C.listKpis(progY.id)).find((k) => k.key === "conexoes")?.weeklyTarget, 20, "metas são por programa");
  assert.equal((await C.listKpis(progX.id)).length, 12);
  ok("metas de KPI editáveis por programa (sem afetar outros programas)");

  // loadTemplateDefaults: programa "antigo" sem KPIs/ferramentas/portões
  await db.delete(schema.programKpis).where(eq(schema.programKpis.programId, progY.id));
  await db.delete(schema.programTools).where(eq(schema.programTools.programId, progY.id));
  await db.delete(schema.programGates).where(eq(schema.programGates.programId, progY.id));
  await must(loadTemplateDefaults(ctx(mA), progY.id), "Acesso negado");
  await must(loadTemplateDefaults(ctx(xU), progY.id), "Acesso negado");
  const added = await loadTemplateDefaults(ctx(mB), progY.id);
  assert.deepEqual(added, { gates: 14, kpis: 11, tools: 11, weights: false });
  assert.deepEqual(await loadTemplateDefaults(ctx(mB), progY.id), { gates: 0, kpis: 0, tools: 0, weights: false }, "idempotente");
  await C.updateProgramKpi(ctx(mB), progY.id, "conexoes", { weeklyTarget: 99 });
  await db.delete(schema.programKpis).where(and(eq(schema.programKpis.programId, progY.id), eq(schema.programKpis.key, "propostas")));
  assert.equal((await C.listKpis(progX.id)).some((k) => k.key === "propostas"), true, "outros programas não são afetados");
  assert.deepEqual(await loadTemplateDefaults(ctx(mB), progY.id), { gates: 0, kpis: 1, tools: 0, weights: false }, "restaura só o KPI apagado");
  assert.equal((await C.listKpis(progY.id)).find((k) => k.key === "conexoes")?.weeklyTarget, 99, "não sobrescreve o que o programa já tem");
  ok("carregar padrões do template: completa o que falta, idempotente, preserva edições");

  // ── Ferramentas ───────────────────────────────────────────────────────
  await must(T.listToolsAdmin(ctx(mA)), "Acesso negado");
  await must(T.listToolsAdmin(ctx(xU)), "Acesso negado");
  const adm = await T.listToolsAdmin(ctx(dir));
  assert.equal(adm.tools.length, 11);
  assert.deepEqual(adm.tools.find((t) => t.slug === "plano-aquisicao")!.gateKeys.sort(), ["canal-aquisicao", "metas-semanais"]);
  assert.ok(adm.tools.every((t) => t.templateIds.includes(base.id)), "template-base inclui todas");

  const nt = { slug: "diario-decisoes", name: "Diário de decisões", phase: "transversal" as const, kind: "declarativa" as const, fields: [{ key: "decisao", label: "Decisão", type: "textarea", required: true }], strategic: true, weight: 2 };
  await must(T.saveTool(ctx(mA), nt), "Acesso negado");
  await must(T.saveTool(ctx(dir), { ...nt, slug: "Inválido!" }), "Identificador");
  await must(T.saveTool(ctx(dir), { ...nt, name: " " }), "nome");
  await must(T.saveTool(ctx(dir), { ...nt, phase: "x" as any }), "Fase");
  await must(T.saveTool(ctx(dir), { ...nt, weight: 11 }), "peso");
  await must(T.saveTool(ctx(dir), { ...nt, fields: [] }), "ao menos um campo");
  await must(T.saveTool(ctx(dir), { ...nt, gateKeys: ["Ruim!"] }), "portão inválido");
  await must(T.saveTool(ctx(dir), { slug: "ext", name: "Ext", phase: "transversal", kind: "externa", externalUrl: "javascript:alert(1)" }), "link");
  await must(T.saveTool(ctx(dir), { slug: "ext", name: "Ext", phase: "transversal", kind: "externa", externalUrl: "https://exemplo.com", gateKeys: ["preco"] }), "não comprovam");
  await T.saveTool(ctx(dir), nt);
  await T.saveTool(ctx(dir), { ...nt, name: "Diário de decisões v2", weight: 3, gateKeys: ["case"] });
  await must(T.saveTool(ctx(dir), { slug: "diario-decisoes", name: "x", phase: "transversal", kind: "externa", externalUrl: "https://exemplo.com" }), "não pode mudar");
  const adm2 = await T.listToolsAdmin(ctx(admin));
  assert.equal(adm2.tools.length, 12);
  assert.equal(adm2.tools.find((t) => t.slug === "diario-decisoes")!.name, "Diário de decisões v2");
  assert.deepEqual(adm2.tools.find((t) => t.slug === "diario-decisoes")!.gateKeys, ["case"]);
  assert.equal(adm2.tools.at(-1)!.slug, "diario-decisoes", "nova ferramenta entra no fim");
  // nova ferramenta só aparece em programas novos (cópia) e conforme o template
  assert.equal((await T.listProgramTools(ctx(mA), progX.id)).tools.length, 11, "programa existente não muda sozinho");
  const edu = await deriveTemplate(ctx(dir), base.id, { name: "Educação — Executive", segment: "educacao", model: "executive" });
  assert.equal((await getTemplate(ctx(dir), edu.id)).gates.length, 14);
  const eduTools = (await T.listToolsAdmin(ctx(dir))).tools.filter((t) => t.templateIds.includes(edu.id)).length;
  assert.equal(eduTools, 11, "derivação copia as ferramentas do template");
  await must(T.setTemplateTools(ctx(mA), edu.id, []), "Acesso negado");
  await must(T.setTemplateTools(ctx(dir), edu.id, ["nao-existe"]), "inválida");
  await T.setTemplateTools(ctx(dir), edu.id, ["sintese-profissional", "ficha-oferta", "diario-decisoes"]);
  const z = await createMentee(ctx(dir), { fullName: "Mentorado Z (fictício)", mentorIds: [mA.id] });
  const progZ = await createProgram(ctx(dir), { menteeId: z.mentee.id, templateId: edu.id, name: "Programa Z" });
  assert.deepEqual((await T.listProgramTools(ctx(mA), progZ.id)).tools.map((t) => t.slug).sort(), ["diario-decisoes", "ficha-oferta", "sintese-profissional"], "programa novo usa as ferramentas do template");
  assert.equal((await C.listKpis(progZ.id)).length, 11, "KPIs também copiados na derivação");
  // ferramenta inativa some do programa
  await T.saveTool(ctx(dir), { ...nt, name: "Diário de decisões v2", weight: 3, gateKeys: ["case"], active: false });
  assert.equal((await T.listProgramTools(ctx(mA), progZ.id)).tools.length, 2, "inativa não aparece");
  ok("catálogo de ferramentas: criar/editar (admin e direção), vínculos com portões, por template, inativar");

  // Entradas
  const pfx = (await T.listProgramTools(ctx(mA), progX.id)).tools;
  assert.equal(pfx.find((t) => t.slug === "ficha-oferta")!.entries.length, 0);
  await must(T.createEntry(ctx(yU), progX.id, "sintese-profissional"), "Acesso negado");
  await must(T.createEntry(ctx(mB), progX.id, "sintese-profissional"), "Acesso negado");
  await db.insert(schema.tools).values({ slug: "externa-teste", name: "Externa (teste)", phase: "transversal", kind: "externa", externalUrl: "https://exemplo.com" });
  await db.insert(schema.programTools).values({ programId: progX.id, toolSlug: "externa-teste" });
  await must(T.createEntry(ctx(xU), progX.id, "externa-teste"), "externas");
  await db.delete(schema.tools).where(eq(schema.tools.slug, "externa-teste"));
  await must(T.createEntry(ctx(xU), progX.id, "inexistente"), "não faz parte");
  await must(T.createEntry(ctx(xU), progX.id, "ficha-oferta"), "Escolha a oferta");
  await must(T.createEntry(ctx(xU), progX.id, "ficha-oferta", { offerId: otherOffer.id }), "Oferta inválida");
  const eSint = await T.createEntry(ctx(xU), progX.id, "sintese-profissional", { title: "Minha síntese" });
  assert.equal(eSint.offerId, null, "ferramenta sem portão não exige oferta");

  const eFicha = await T.createEntry(ctx(xU), progX.id, "ficha-oferta", { offerId: offer.id });
  const scoreBefore = (await SC.getScore(ctx(mA), progX.id)).total;
  await must(T.saveEntry(ctx(xU), eFicha.id, { publico: "Escolas" }, true), "Preencha");
  assert.equal((await T.saveEntry(ctx(xU), eFicha.id, { publico: "Escolas" }, false)).status, "rascunho");
  await must(T.saveEntry(ctx(yU), eFicha.id, {}, false), "Acesso negado");
  await must(T.saveEntry(ctx(mB), eFicha.id, {}, false), "Acesso negado");
  const fichaOk = { publico: "Mantenedores", problema: "Sem porta de entrada", solucao: "Palestra + diagnóstico", proposta_valor: "Abre portas", formato: "Palestra", hipotese: "3 convites em 30 dias" };
  const r1 = await T.saveEntry(ctx(xU), eFicha.id, fichaOk, true);
  assert.deepEqual(r1, { status: "concluida", marked: ["ficha-1-pagina"], warnings: [] });
  let ov = (await O.listOffers(ctx(mA), progX.id)).find((o) => o.id === offer.id)!;
  assert.equal(ov.stage, 1, "mentorado concluiu: item fica PENDENTE e não avança o estágio");
  assert.equal(ov.pendingChecks, 1);
  const g = await O.getOffer(ctx(mA), offer.id);
  assert.match(g.checks.find((c) => c.gateKey === "ficha-1-pagina")!.evidence, /Ferramenta "Ficha de 1 página da oferta" concluída/);
  assert.equal((await T.listProgramTools(ctx(mA), progX.id)).tools.find((t) => t.slug === "ficha-oferta")!.best, "concluida");

  await must(T.reviewEntry(ctx(xU), eFicha.id), "Acesso negado");
  await must(T.reviewEntry(ctx(mB), eFicha.id), "Acesso negado");
  await must(T.reviewEntry(ctx(mA), eSint.id), "concluídas");
  const rv = await T.reviewEntry(ctx(mA), eFicha.id);
  assert.deepEqual(rv.confirmed, ["ficha-1-pagina"], "revisar confirma o item pendente do portão");
  ov = (await O.listOffers(ctx(mA), progX.id)).find((o) => o.id === offer.id)!;
  assert.equal(ov.stage, 2, "confirmado: Prototipada");
  assert.equal(ov.pendingChecks, 0);
  assert.equal((await T.listProgramTools(ctx(mA), progX.id)).tools.find((t) => t.slug === "ficha-oferta")!.best, "revisada");
  const scoreAfter = (await SC.getScore(ctx(mA), progX.id)).total;
  assert.ok(scoreAfter > scoreBefore, "usar a ferramenta, avançar a oferta e revisar sobe o score");
  // editar depois limpa a revisão
  await T.saveEntry(ctx(xU), eFicha.id, { ...fichaOk, formato: "Workshop" }, true);
  assert.equal((await T.getEntry(ctx(mA), eFicha.id)).entry.reviewedAt, null, "qualquer alteração limpa a revisão");
  assert.equal((await T.listProgramTools(ctx(mA), progX.id)).tools.find((t) => t.slug === "ficha-oferta")!.best, "concluida");
  ok("entradas: validação, mentorado conclui (portão pendente), mentor revisa (confirma e pontua), edição limpa revisão");

  // equipe concluindo: portão já confirmado; ferramenta que comprova 2 portões
  const ePlano = await T.createEntry(ctx(mA), progX.id, "plano-aquisicao", { offerId: offer.id });
  const r2 = await T.saveEntry(ctx(mA), ePlano.id, { canais: "LinkedIn e eventos", contas_semana: "20", reunioes_semana: 3 }, true);
  assert.deepEqual(r2.marked.sort(), ["canal-aquisicao", "metas-semanais"]);
  assert.equal((await O.getOffer(ctx(mA), offer.id)).checks.find((c) => c.gateKey === "canal-aquisicao")!.state, "confirmado", "equipe confirma na hora");
  // oferta pausada: conclui a ferramenta mas avisa que o portão não foi marcado
  const o3 = await O.createOffer(ctx(mA), progX.id, { revenueSlug: "digitais", name: "Toolkit", problem: "Pré-diagnóstico para escolas", audience: "Escolas privadas" });
  const ePre = await T.createEntry(ctx(mA), progX.id, "precificacao", { offerId: o3.id });
  await O.setOfferStatus(ctx(mA), o3.id, "pausada", "Aguardando agenda");
  const r3 = await T.saveEntry(ctx(mA), ePre.id, { modelo: "Projeto", custos: "20h", preco: "R$ 4.900" }, true);
  assert.deepEqual(r3.marked, []);
  assert.equal(r3.warnings.length, 1, "oferta pausada: avisa em vez de falhar");
  assert.match(r3.warnings[0], /Reative/);
  ok("ferramenta que comprova vários portões; oferta pausada gera aviso, não erro");

  // ── Score no banco ────────────────────────────────────────────────────
  const sc = await SC.getScore(ctx(xU), progX.id);
  assert.equal(sc.canEdit, false);
  assert.equal(sc.components.length, 5);
  assert.ok(sc.total > 0 && sc.total < 100);
  assert.equal(sc.components.find((c) => c.key === "informacao")!.ratio < 1, true);
  await must(SC.getScore(ctx(mB), progX.id), "Acesso negado");
  await must(SC.getScore(ctx(yU), progX.id), "Acesso negado");
  await must(SC.updateScoreWeights(ctx(xU), progX.id, { ofertas: 50 }), "Acesso negado");
  await must(SC.updateScoreWeights(ctx(mB), progX.id, { ofertas: 50 }), "Acesso negado");
  await must(SC.updateScoreWeights(ctx(mA), progX.id, { inventado: 50 }), "desconhecido");
  await must(SC.updateScoreWeights(ctx(mA), progX.id, { ofertas: 101 }), "entre 0 e 100");
  await must(SC.updateScoreWeights(ctx(mA), progX.id, { ofertas: 0 }), "maior que zero");
  const wts = await SC.updateScoreWeights(ctx(mA), progX.id, { informacao: 10, ferramentas: 30, ofertas: 30, estrutura: 10, tracao: 20 });
  assert.equal(Object.values(wts).reduce((a, b) => a + b, 0), 100);
  const sc2 = await SC.getScore(ctx(mA), progX.id);
  assert.equal(sc2.weights.ferramentas, 30);
  assert.equal(sc2.canEdit, true);
  assert.equal((await SC.getScore(ctx(mB), progY.id)).weights.ferramentas, 20, "pesos são por programa");
  const snap1 = await SC.recordSnapshot(ctx(xU), progX.id);
  const snap2 = await SC.recordSnapshot(ctx(mA), progX.id);
  assert.equal(snap1.weekStart, W.currentWeek());
  assert.equal((await SC.listSnapshots(ctx(mA), progX.id)).length, 1, "um retrato por semana (regravar atualiza)");
  assert.equal(snap2.total, sc2.total);
  await must(SC.listSnapshots(ctx(mB), progX.id), "Acesso negado");
  await must(SC.recordSnapshot(ctx(yU), progX.id), "Acesso negado");
  ok("score no banco: cálculo, pesos por programa, retratos semanais e permissões");

  // auditoria e cascata
  const log = await db.select().from(schema.activityLog);
  const actions = new Set(log.map((l) => l.action));
  for (const a of ["session.create", "session.update", "task.create", "task.status", "cadence.kpis", "cadence.checkin", "program.update_kpi", "program.add_kpi", "program.load_defaults", "tool.create", "tool.update", "template.set_tools", "tool_entry.create", "tool_entry.save", "tool_entry.conclude", "tool_entry.review", "program.score_weights"])
    assert.ok(actions.has(a), `auditoria registra ${a}`);
  await db.delete(schema.programs).where(eq(schema.programs.id, progX.id));
  for (const t of [schema.mentoringSessions, schema.tasks, schema.kpiEntries, schema.weeklyCheckins, schema.toolEntries, schema.scoreSnapshots, schema.programKpis, schema.programTools] as const)
    assert.equal((await db.select().from(t).where(eq(t.programId, progX.id))).length, 0);
  ok("auditoria e integridade (remover programa limpa sessões, tarefas, cadência, entradas e retratos)");

  await closeDb();
  console.log("\nOK — sessões, tarefas, cadência, ferramentas e score passaram.");
  void todayBR;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
