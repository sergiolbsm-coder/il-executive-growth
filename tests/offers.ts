import assert from "node:assert/strict";

delete process.env.DATABASE_URL;
process.env.PGLITE_DIR = "memory://";
delete process.env.RESEND_API_KEY;

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

async function main() {
  const { computeStage, scheduleStatus, gateMet, todayBR } = await import("../domains/offers/stage");
  const { cleanGatePatch, cleanNewGate } = await import("../domains/offers/gate-input");
  const ok = (name: string) => console.log(`  ✓ ${name}`);

  // ── Regras puras ──────────────────────────────────────────────────────
  const G = (stage: number, key: string, o: Partial<{ kind: "manual" | "vendas"; threshold: number | null; required: boolean }> = {}) =>
    ({ key, stage, kind: o.kind ?? "manual", threshold: o.threshold ?? null, required: o.required ?? true }) as const;
  const gates = [
    G(2, "ficha"), G(3, "preco"), G(3, "pitch"), G(4, "canal"),
    G(5, "v1", { kind: "vendas", threshold: 1 }), G(6, "v2", { kind: "vendas", threshold: 2 }), G(6, "dep"), G(7, "escala"),
  ];
  const none = new Set<string>();
  assert.equal(computeStage(gates, none, 0).stage, 1, "sem nada = Ideia");
  assert.equal(computeStage(gates, new Set(["ficha"]), 0).stage, 2);
  assert.equal(computeStage(gates, new Set(["ficha", "preco"]), 0).stage, 2, "estágio 3 exige TODOS os itens obrigatórios");
  assert.equal(computeStage(gates, new Set(["ficha", "preco", "pitch"]), 0).stage, 3);
  assert.equal(computeStage(gates, new Set(["preco", "pitch", "canal"]), 0).stage, 1, "é sequencial: sem a ficha não passa do 1");
  assert.equal(computeStage(gates, new Set(["ficha", "preco", "pitch", "canal"]), 0).stage, 4);
  assert.equal(computeStage(gates, new Set(["ficha", "preco", "pitch", "canal"]), 1).stage, 5, "1 venda → Primeira venda");
  assert.equal(computeStage(gates, new Set(["ficha", "preco", "pitch", "canal", "dep"]), 1).stage, 5, "Validada exige 2 vendas");
  assert.equal(computeStage(gates, new Set(["ficha", "preco", "pitch", "canal", "dep"]), 2).stage, 6);
  assert.equal(computeStage(gates, new Set(["ficha", "preco", "pitch", "canal", "dep", "escala"]), 2).stage, 7);
  const sem = computeStage(gates, new Set(["ficha"]), 0);
  assert.deepEqual(sem.missing.map((m) => m.key).sort(), ["pitch", "preco"], "informa o que falta para o próximo estágio");
  assert.equal(computeStage(gates, new Set(["ficha", "preco", "pitch", "canal", "dep", "escala"]), 2).missing.length, 0);
  // opcionais não bloqueiam
  assert.equal(computeStage([G(2, "ficha", { required: false })], none, 0).stage, 4, "sem portões obrigatórios avança até a trava de vendas");
  // invariante: estágio 5+ exige venda mesmo sem portão de vendas configurado
  assert.equal(computeStage([G(2, "a"), G(5, "x")], new Set(["a", "x"]), 0).stage, 4, "sem venda registrada nunca passa de 4");
  assert.equal(computeStage([G(2, "a"), G(5, "x")], new Set(["a", "x"]), 1).stage, 7, "estágios sem portão obrigatório são alcançados em sequência (6 e 7 aqui)");
  assert.equal(computeStage([G(2, "a"), G(5, "x"), G(6, "y")], new Set(["a", "x"]), 1).stage, 5, "o portão obrigatório do 6 segura o estágio");
  assert.ok(gateMet(G(5, "v", { kind: "vendas", threshold: 3 }), none, 3) && !gateMet(G(5, "v", { kind: "vendas", threshold: 3 }), none, 2));
  ok("estágio derivado: sequencial, itens obrigatórios, vendas e trava no estágio 5");

  const today = "2026-11-10";
  assert.equal(scheduleStatus(3, 3, "2026-01-01", today), "cumprida");
  assert.equal(scheduleStatus(2, 3, null, today), "sem-prazo");
  assert.equal(scheduleStatus(2, 3, "2026-11-09", today), "atrasada");
  assert.equal(scheduleStatus(2, 3, "2026-11-10", today), "em-risco", "vence hoje ainda não é atraso");
  assert.equal(scheduleStatus(2, 3, "2026-11-24", today), "em-risco", "≤ 14 dias");
  assert.equal(scheduleStatus(2, 3, "2026-11-25", today), "no-prazo");
  assert.match(todayBR(), /^\d{4}-\d{2}-\d{2}$/);
  ok("prazo: cumprida · sem prazo · atrasada · em risco · no prazo");

  assert.throws(() => cleanNewGate({ key: "Inválido!", label: "x", stage: 3 }), /Identificador/);
  assert.throws(() => cleanNewGate({ key: "ok", label: " ", stage: 3 }), /rótulo/);
  assert.throws(() => cleanNewGate({ key: "ok", label: "x", stage: 1 }), /2 a 7/);
  assert.throws(() => cleanNewGate({ key: "ok", label: "x", stage: 8 }), /2 a 7/);
  assert.throws(() => cleanNewGate({ key: "ok", label: "x", stage: 5, kind: "vendas" }), /número mínimo/);
  assert.throws(() => cleanNewGate({ key: "ok", label: "x", stage: 5, threshold: 2 }), /Só portões de vendas/);
  assert.deepEqual(cleanNewGate({ key: "ok", label: " Rótulo ", stage: 6, kind: "vendas", threshold: 3 }), { key: "ok", label: "Rótulo", stage: 6, kind: "vendas", threshold: 3, required: true });
  assert.throws(() => cleanGatePatch({ threshold: null }, "vendas"), /exige/);
  assert.throws(() => cleanGatePatch({ threshold: 0 }, "vendas"), /maior que zero/);
  assert.throws(() => cleanGatePatch({ threshold: 2 }, "manual"), /Só portões de vendas/);
  ok("validação de portões (novos e edição)");

  const { parseBRLToCents, fmtBRL } = await import("../lib/format");
  assert.equal(parseBRLToCents("2500"), 250000);
  assert.equal(parseBRLToCents("2.500,00"), 250000);
  assert.equal(parseBRLToCents("R$ 2.500"), 250000);
  assert.equal(parseBRLToCents("2500,5"), 250050);
  assert.equal(parseBRLToCents("2500.50"), 250050);
  assert.equal(parseBRLToCents("0,99"), 99);
  assert.equal(parseBRLToCents("1.234.567,89"), 123456789);
  for (const bad of ["", "abc", "12,345", "1,2,3", "-5", "R$"]) assert.equal(parseBRLToCents(bad), null, `inválido: ${bad}`);
  assert.match(fmtBRL(250000), /2\.500,00/);
  ok("valores em reais: parser e formatação");

  // ── Com banco ─────────────────────────────────────────────────────────
  const { getDb, schema, closeDb } = await import("../lib/db");
  const { createUser } = await import("../domains/users/service");
  const { createMentee } = await import("../domains/mentees/service");
  const { listTemplates, getTemplate, deriveTemplate, updateTemplateGate, addTemplateGate } = await import("../domains/templates/service");
  const { createProgram, getProgram, updateProgramGate, addProgramGate } = await import("../domains/programs/service");
  const O = await import("../domains/offers/service");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();

  const ctx = (u: { id: string; role: any; mentorScope?: any }) => ({ userId: u.id, role: u.role, mentorScope: u.mentorScope });
  const must = async (p: Promise<unknown>, msg: RegExp | string) => {
    await assert.rejects(p, typeof msg === "string" ? new RegExp(msg) : msg);
  };

  const admin = (await createUser(null, { name: "Admin", email: "admin@teste.invalid", role: "admin", password: "senha-inicial-1", sendEmail: false })).user;
  const dir = (await createUser(ctx(admin), { name: "Direção", email: "dir@teste.invalid", role: "direcao", sendEmail: false })).user;
  const mA = (await createUser(ctx(admin), { name: "Mentor A", email: "ma@teste.invalid", role: "mentor", sendEmail: false })).user;
  const mB = (await createUser(ctx(admin), { name: "Mentor B", email: "mb@teste.invalid", role: "mentor", sendEmail: false })).user;
  const x = await createMentee(ctx(dir), { fullName: "Mentorado X (fictício)", email: "x@m.invalid", mentorIds: [mA.id], createAccess: true, sendEmail: false });
  const y = await createMentee(ctx(dir), { fullName: "Mentorado Y (fictício)", email: "y@m.invalid", mentorIds: [mB.id], createAccess: true, sendEmail: false });
  const xU = x.grant!.user;
  const yU = y.grant!.user;

  const [base] = await listTemplates(ctx(mA));
  const baseFull = await getTemplate(ctx(mA), base.id);
  assert.equal(baseFull.gates.length, 14, "template-base traz 14 portões padrão");
  assert.deepEqual([...new Set(baseFull.gates.map((g) => g.stage))].sort(), [2, 3, 4, 5, 6, 7]);
  assert.equal(baseFull.gates.find((g) => g.key === "clientes-pagantes")?.threshold, 2);
  ok("template-base: 14 portões padrão nos estágios 2–7");

  // derivar copia portões; editar portão do template não muda o programa
  const edu = await deriveTemplate(ctx(dir), base.id, { name: "Educação — Executive", segment: "educacao", model: "executive" });
  assert.equal((await getTemplate(ctx(dir), edu.id)).gates.length, 14, "derivação copia os portões");
  await updateTemplateGate(ctx(dir), edu.id, "clientes-pagantes", { threshold: 3, label: "Clientes pagantes (mínimo 3)" });
  await addTemplateGate(ctx(dir), edu.id, { key: "licenca", label: "Licenciamento fechado", stage: 7 });
  await must(addTemplateGate(ctx(dir), edu.id, { key: "licenca", label: "dup", stage: 7 }), "Já existe");
  await must(updateTemplateGate(ctx(mA), edu.id, "preco", { required: false }), "Acesso negado");
  await must(updateTemplateGate(ctx(dir), edu.id, "nao-existe", { required: false }), "não encontrado");
  assert.equal((await getTemplate(ctx(dir), base.id)).gates.find((g) => g.key === "clientes-pagantes")?.threshold, 2, "origem intacta");
  assert.equal((await getTemplate(ctx(dir), edu.id)).gates.length, 15);

  const progX = await createProgram(ctx(dir), { menteeId: x.mentee.id, templateId: edu.id, name: "Programa X" });
  const progY = await createProgram(ctx(dir), { menteeId: y.mentee.id, templateId: base.id, name: "Programa Y" });
  const pgX = await getProgram(ctx(mA), progX.id);
  assert.equal(pgX.gates.length, 15, "programa recebe snapshot dos portões");
  assert.equal(pgX.gates.find((g) => g.key === "clientes-pagantes")?.threshold, 3);
  await updateTemplateGate(ctx(dir), edu.id, "pitch", { required: false });
  assert.equal((await getProgram(ctx(mA), progX.id)).gates.find((g) => g.key === "pitch")?.required, true, "snapshot isolado");
  ok("portões: derivação, snapshot no programa e isolamento entre template e programa");

  // ── Ofertas ───────────────────────────────────────────────────────────
  const base0 = { revenueSlug: "workshops", name: "Palestras Memoráveis", problem: "Escolas sem porta de entrada comercial", audience: "Mantenedores e diretores" };
  await must(O.createOffer(ctx(xU), progX.id, base0), "Acesso negado");
  await must(O.createOffer(ctx(mB), progX.id, base0), "Acesso negado");
  await must(O.createOffer(ctx(mA), progX.id, { ...base0, name: " " }), "nome");
  await must(O.createOffer(ctx(mA), progX.id, { ...base0, problem: "" }), "problema");
  await must(O.createOffer(ctx(mA), progX.id, { ...base0, audience: "" }), "público");
  await must(O.createOffer(ctx(mA), progX.id, { ...base0, revenueSlug: "inexistente" }), "Receita não encontrada");
  await must(O.createOffer(ctx(mA), progX.id, { ...base0, wave: 4 }), "onda");
  await must(O.createOffer(ctx(mA), progX.id, { ...base0, targetStage: 9 }), "meta");
  await must(O.createOffer(ctx(mA), progX.id, { ...base0, dueDate: "31/12/2026" }), "Data inválida");
  await must(O.createOffer(ctx(mA), progX.id, { ...base0, level: 7 }), "nível");

  const past = addDays(todayBR(), -3);
  const offer = await O.createOffer(ctx(mA), progX.id, { ...base0, targetStage: 3, dueDate: past, wave: 1 });
  assert.equal(offer.level, 1, "nível herdado da receita");
  let v = (await O.listOffers(ctx(mA), progX.id))[0];
  assert.equal(v.stage, 1, "nasce em Ideia");
  assert.equal(v.schedule, "atrasada", "meta 3 com prazo vencido");
  assert.equal(v.status, "ativa");
  ok("criação de oferta: validações, permissões, nasce em Ideia, prazo atrasado");

  // progressão por portões (equipe confirma na hora)
  await must(O.checkGate(ctx(mA), offer.id, "ficha-1-pagina", "  "), "evidência");
  await must(O.checkGate(ctx(mA), offer.id, "primeira-venda", "x".repeat(5)), "calculado pelas vendas");
  await must(O.checkGate(ctx(mA), offer.id, "inexistente", "evidência ok"), "não encontrado");
  await must(O.checkGate(ctx(mA), offer.id, "ficha-1-pagina", "x".repeat(2001)), "longa demais");
  assert.equal(await O.checkGate(ctx(mA), offer.id, "ficha-1-pagina", "Ficha anexada: link.exemplo/ficha"), "confirmado");
  v = (await O.listOffers(ctx(mA), progX.id))[0];
  assert.equal(v.stage, 2);
  assert.equal(v.schedule, "atrasada");
  for (const k of ["preco", "pitch", "proposta"]) await O.checkGate(ctx(mA), offer.id, k, `evidência ${k}`);
  assert.equal((await O.listOffers(ctx(mA), progX.id))[0].stage, 2, "falta o material de entrega");
  assert.deepEqual((await O.listOffers(ctx(mA), progX.id))[0].missing.map((m) => m.key), ["material-entrega"]);
  await O.checkGate(ctx(mA), offer.id, "material-entrega", "Material pronto");
  v = (await O.listOffers(ctx(mA), progX.id))[0];
  assert.equal(v.stage, 3);
  assert.equal(v.schedule, "cumprida", "atingiu a meta de estágio 3");
  await O.checkGate(ctx(mA), offer.id, "canal-aquisicao", "LinkedIn ativo");
  await O.checkGate(ctx(mA), offer.id, "metas-semanais", "20 contas/semana");
  assert.equal((await O.listOffers(ctx(mA), progX.id))[0].stage, 4);
  ok("progressão Ideia → Prototipada → Oferta pronta → Em prospecção por portões com evidência");

  // vendas
  await must(O.recordSale(ctx(xU), offer.id, { clientName: "Escola Exemplo", valueCents: 100000, soldAt: past }), "Acesso negado");
  await must(O.recordSale(ctx(mB), offer.id, { clientName: "Escola Exemplo", valueCents: 100000, soldAt: past }), "Acesso negado");
  await must(O.recordSale(ctx(mA), offer.id, { clientName: " ", valueCents: 100000, soldAt: past }), "cliente");
  await must(O.recordSale(ctx(mA), offer.id, { clientName: "E", valueCents: 0, soldAt: past }), "maior que zero");
  await must(O.recordSale(ctx(mA), offer.id, { clientName: "E", valueCents: 10.5, soldAt: past }), "maior que zero");
  await must(O.recordSale(ctx(mA), offer.id, { clientName: "E", valueCents: 100, soldAt: "sem-data" }), "data");
  await must(O.recordSale(ctx(mA), offer.id, { clientName: "E", valueCents: 100, soldAt: addDays(todayBR(), 5) }), "futuro");
  await must(O.recordSale(ctx(mA), offer.id, { clientName: "E", valueCents: 100, soldAt: past, originOfferId: offer.id }), "outra oferta");
  const otherY = await O.createOffer(ctx(mB), progY.id, base0);
  await must(O.recordSale(ctx(mA), offer.id, { clientName: "E", valueCents: 100, soldAt: past, originOfferId: otherY.id }), "mesmo programa");
  assert.equal((await O.listOffers(ctx(mA), progX.id))[0].stage, 4, "sem venda não passa de 4");
  const s1 = await O.recordSale(ctx(mA), offer.id, { clientName: "Escola Exemplo A", valueCents: 250000, soldAt: past, channel: "LinkedIn" });
  v = (await O.listOffers(ctx(mA), progX.id))[0];
  assert.equal(v.stage, 5, "1 venda → Primeira venda");
  assert.equal(v.salesCount, 1);
  ok("vendas: validações, permissões e Primeira venda (estágio 5) só com venda registrada");

  // Validada exige 3 vendas no programa X (limiar editado no template = 3) + depoimento + case
  await O.checkGate(ctx(mA), offer.id, "depoimento", "Depoimento do diretor");
  await O.checkGate(ctx(mA), offer.id, "case", "Case publicado");
  await O.recordSale(ctx(mA), offer.id, { clientName: "Escola Exemplo B", valueCents: 180000, soldAt: past });
  assert.equal((await O.listOffers(ctx(mA), progX.id))[0].stage, 5, "limiar do programa X é 3 clientes");
  await O.recordSale(ctx(mA), offer.id, { clientName: "Escola Exemplo C", valueCents: 90000, soldAt: past });
  assert.equal((await O.listOffers(ctx(mA), progX.id))[0].stage, 6, "3 vendas + depoimento + case → Validada");
  // editar o portão DO PROGRAMA muda o que é exigido
  await updateProgramGate(ctx(mA), progX.id, "clientes-pagantes", { threshold: 4 });
  assert.equal((await O.listOffers(ctx(mA), progX.id))[0].stage, 5, "exigir 4 clientes faz a oferta recuar");
  await updateProgramGate(ctx(mA), progX.id, "clientes-pagantes", { threshold: 2 });
  assert.equal((await O.listOffers(ctx(mA), progX.id))[0].stage, 6);
  await must(updateProgramGate(ctx(mB), progX.id, "case", { required: false }), "Acesso negado");
  await must(updateProgramGate(ctx(xU), progX.id, "case", { required: false }), "Acesso negado");
  await updateProgramGate(ctx(mA), progX.id, "case", { required: false });
  await addProgramGate(ctx(mA), progX.id, { key: "contrato-recorrente", label: "Contrato recorrente assinado", stage: 7 });
  await must(addProgramGate(ctx(mA), progX.id, { key: "contrato-recorrente", label: "dup", stage: 7 }), "Já existe");
  for (const k of ["entrega-replicavel", "multiplos-canais", "meta-receita", "licenca", "contrato-recorrente"]) await O.checkGate(ctx(mA), offer.id, k, `evidência ${k}`);
  assert.equal((await O.listOffers(ctx(mA), progX.id))[0].stage, 7, "Escala");
  assert.equal((await getTemplate(ctx(dir), edu.id)).gates.find((g) => g.key === "case")?.required, true, "template não muda ao editar o programa");
  ok("Validada e Escala; portões do programa editáveis (limiar, obrigatório, novo) sem afetar o template");

  // mentorado marca → pendente → equipe confirma
  const o2 = await O.createOffer(ctx(mA), progX.id, { revenueSlug: "digitais", name: "Toolkit de diagnóstico", problem: "Pré-diagnóstico", audience: "Escolas" });
  assert.equal(await O.checkGate(ctx(xU), o2.id, "ficha-1-pagina", "Ficha preenchida por mim"), "pendente");
  assert.equal((await O.listOffers(ctx(mA), progX.id)).find((o) => o.id === o2.id)!.stage, 1, "pendente não conta");
  assert.equal((await O.listOffers(ctx(mA), progX.id)).find((o) => o.id === o2.id)!.pendingChecks, 1);
  // fila de portões pendentes (equipe)
  const pend = await O.listPendingGates(ctx(mA));
  assert.equal(pend.length, 1);
  assert.equal(pend[0].gateLabel.startsWith("Ficha de 1 página"), true);
  assert.equal(pend[0].menteeName, "Mentorado X (fictício)");
  assert.equal(pend[0].checkedByName, "Mentorado X (fictício)");
  assert.equal((await O.listPendingGates(ctx(mB))).length, 0, "outro mentor não vê pendências alheias");
  await must(O.listPendingGates(ctx(xU)), "Acesso negado");
  assert.equal((await O.listPendingGates(ctx(dir))).length, 1);

  await must(O.checkGate(ctx(yU), o2.id, "ficha-1-pagina", "invasão"), "Acesso negado");
  await must(O.confirmGate(ctx(xU), o2.id, "ficha-1-pagina"), "Acesso negado");
  await must(O.confirmGate(ctx(mB), o2.id, "ficha-1-pagina"), "Acesso negado");
  await must(O.confirmGate(ctx(mA), o2.id, "pitch"), "pendente");
  await O.confirmGate(ctx(mA), o2.id, "ficha-1-pagina");
  assert.equal((await O.listOffers(ctx(mA), progX.id)).find((o) => o.id === o2.id)!.stage, 2, "confirmado avança");
  await must(O.checkGate(ctx(xU), o2.id, "ficha-1-pagina", "tentando sobrescrever"), "já foi confirmado");
  await must(O.recordSale(ctx(xU), o2.id, { clientName: "E", valueCents: 100, soldAt: past }), "Acesso negado");
  await must(O.setOfferStatus(ctx(xU), o2.id, "descartada", "não quero"), "Acesso negado");
  ok("mentorado marca (pendente) → equipe confirma; mentorado não confirma, vende nem descarta");

  // desmarcar regride o estágio; pausar/descartar exigem motivo e bloqueiam ações
  await O.uncheckGate(ctx(mA), o2.id, "ficha-1-pagina");
  assert.equal((await O.listOffers(ctx(mA), progX.id)).find((o) => o.id === o2.id)!.stage, 1, "desmarcar faz o estágio voltar");
  await must(O.uncheckGate(ctx(mA), o2.id, "ficha-1-pagina"), "não está marcado");
  await must(O.setOfferStatus(ctx(mA), o2.id, "pausada"), "motivo");
  await must(O.setOfferStatus(ctx(mA), o2.id, "pausada", "ab"), "motivo");
  await must(O.setOfferStatus(ctx(mA), o2.id, "inventada" as any, "motivo válido"), "inválida");
  await O.setOfferStatus(ctx(mA), o2.id, "pausada", "Aguardando agenda do segundo semestre");
  await must(O.checkGate(ctx(mA), o2.id, "ficha-1-pagina", "evidência"), "Reative");
  await must(O.recordSale(ctx(mA), o2.id, { clientName: "E", valueCents: 100, soldAt: past }), "Reative");
  await O.setOfferStatus(ctx(mA), o2.id, "ativa");
  assert.equal((await O.getOffer(ctx(mA), o2.id)).offer.statusReason, null, "reativar limpa o motivo");
  ok("desmarcar regride; pausar/descartar exigem motivo e bloqueiam marcações e vendas");

  // trocar a receita da oferta
  const ofBefore = (await O.listOffers(ctx(mA), progX.id)).find((o) => o.id === o2.id)!;
  assert.equal(ofBefore.revenueSlug, "digitais");
  await must(O.updateOffer(ctx(mA), o2.id, { revenueSlug: "nao-existe" }), "Receita não encontrada");
  await must(O.updateOffer(ctx(xU), o2.id, { revenueSlug: "workshops" }), "Acesso negado");
  await must(O.updateOffer(ctx(mB), o2.id, { revenueSlug: "workshops" }), "Acesso negado");
  const swapped = await O.updateOffer(ctx(mA), o2.id, { revenueSlug: "instituicoes" });
  assert.equal(swapped.revenueSlug, "instituicoes");
  const ofAfter = (await O.listOffers(ctx(mA), progX.id)).find((o) => o.id === o2.id)!;
  assert.equal(ofAfter.stage, ofBefore.stage, "trocar a receita não muda o estágio");
  assert.equal(ofAfter.level, ofBefore.level, "nem o nível (que é escolhido à parte)");
  assert.equal((await O.getOffer(ctx(mA), o2.id)).sources.length, 9, "detalhe devolve o catálogo de receitas do programa");
  assert.equal(swapped.name, ofBefore.name);
  const same = await O.updateOffer(ctx(mA), o2.id, { revenueSlug: "instituicoes" });
  assert.equal(same.revenueSlug, "instituicoes", "repetir a mesma receita é inofensivo");
  const logSwap = (await db.select().from(schema.activityLog)).filter((l) => l.action === "offer.update" && JSON.stringify(l.afterJson).includes("instituicoes"));
  assert.ok(logSwap.length >= 1 && JSON.stringify(logSwap[0].beforeJson).includes("digitais"), "auditoria guarda a receita anterior");
  await O.updateOffer(ctx(mA), o2.id, { revenueSlug: "digitais" });
  ok("troca da receita da oferta: só equipe, só receitas do programa, estágio preservado, auditada");

  // edição da oferta
  const upd = await O.updateOffer(ctx(mA), o2.id, { name: "Toolkit de diagnóstico v2", wave: 2, targetStage: 4, dueDate: addDays(todayBR(), 40), priceNote: "R$ 497" });
  assert.equal(upd.name, "Toolkit de diagnóstico v2");
  await must(O.updateOffer(ctx(mA), o2.id, { name: "" }), "nome");
  await must(O.updateOffer(ctx(xU), o2.id, { name: "x" }), "Acesso negado");
  assert.equal((await O.listOffers(ctx(mA), progX.id)).find((o) => o.id === o2.id)!.schedule, "no-prazo");
  ok("edição da oferta (nome, onda, meta, prazo)");

  // isolamento
  await must(O.listOffers(ctx(mB), progX.id), "Acesso negado");
  await must(O.listOffers(ctx(yU), progX.id), "Acesso negado");
  await must(O.getOffer(ctx(mB), offer.id), "Acesso negado");
  await must(O.getOffer(ctx(yU), offer.id), "Acesso negado");
  const own = await O.getOffer(ctx(xU), offer.id);
  assert.equal(own.canEdit, false, "mentorado vê a própria oferta sem editar");
  assert.equal(own.sales.length, 3);
  assert.equal((await O.getOffer(ctx(mA), offer.id)).canEdit, true);
  ok("isolamento: outro mentor/mentorado não vê; o próprio mentorado vê sem editar");

  // origem da venda (grafo "puxa →") e remoção só pelo admin
  const s4 = await O.recordSale(ctx(mA), o2.id, { clientName: "Escola Exemplo D", valueCents: 49700, soldAt: past, originOfferId: offer.id });
  assert.equal(s4.originOfferId, offer.id);
  await must(O.removeSale(ctx(mA), s4.id), "Acesso negado");
  await must(O.removeSale(ctx(dir), s4.id), "Acesso negado");
  await O.removeSale(ctx(admin), s4.id);
  await must(O.removeSale(ctx(admin), s4.id), "não encontrada");
  ok("origem da venda registrada; remover venda é só do administrador");

  // listagens comerciais e por nível
  const allSales = await O.listSalesForActor(ctx(mA));
  assert.equal(allSales.length, 3, "vendas do mentorado X (a quarta foi removida)");
  assert.ok(allSales.every((r) => r.menteeName === "Mentorado X (fictício)" && r.programName === "Programa X"));
  assert.equal((await O.listSalesForActor(ctx(mB))).length, 0, "mentor B não vê vendas do X");
  assert.equal((await O.listSalesForActor(ctx(xU))).length, 3, "mentorado vê as próprias");
  assert.equal((await O.listSalesForActor(ctx(yU))).length, 0);
  assert.equal((await O.listSalesForActor(ctx(admin))).length, 3);
  const byLvl = await O.salesByLevel(ctx(mA), progX.id);
  assert.deepEqual(byLvl.get(1), { sales: 3, cents: 250000 + 180000 + 90000 }, "vendas somadas no nível 1 (oferta de Palestras)");
  assert.equal(byLvl.get(3), undefined, "nível sem oferta não aparece");
  await must(O.salesByLevel(ctx(mB), progX.id), "Acesso negado");
  ok("listagens: fila de portões pendentes, vendas do usuário e vendas por nível");

  // auditoria
  const log = await db.select().from(schema.activityLog);
  const actions = new Set(log.map((l) => l.action));
  for (const a of ["offer.create", "offer.update", "offer.status", "offer.gate_check", "offer.gate_confirm", "offer.gate_uncheck", "offer.sale", "offer.sale_remove", "template.update_gate", "template.add_gate", "program.update_gate", "program.add_gate"])
    assert.ok(actions.has(a), `auditoria registra ${a}`);
  const removed = log.find((l) => l.action === "offer.sale_remove");
  assert.ok(removed?.beforeJson && JSON.stringify(removed.beforeJson).includes("Escola Exemplo D"), "remoção guarda o registro completo");
  ok("auditoria das ofertas, portões e vendas");

  // cascata
  await db.delete(schema.programs).where(eq(schema.programs.id, progY.id));
  assert.equal((await db.select().from(schema.offers).where(eq(schema.offers.id, otherY.id))).length, 0, "remover programa remove suas ofertas");
  ok("integridade referencial (cascata)");

  await closeDb();
  console.log("\nOK — ofertas, estágios, portões e vendas passaram.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
