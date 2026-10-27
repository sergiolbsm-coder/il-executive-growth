import assert from "node:assert/strict";

delete process.env.DATABASE_URL;
process.env.PGLITE_DIR = "memory://";
delete process.env.RESEND_API_KEY;

async function main() {
  const ok = (name: string) => console.log(`  ✓ ${name}`);
  const L = await import("../domains/content/links");
  const S = await import("../domains/content/summary");
  const W = await import("../lib/week");
  const { todayBR } = await import("../domains/offers/stage");

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

  // ── Resumo (puro) ─────────────────────────────────────────────────────
  const cw = "2026-10-26";
  const it = (o: Partial<Parameters<typeof S.summarize>[0][number]>) => ({ id: Math.random().toString(36).slice(2), axisId: "a1", weekStart: cw, status: "ideia" as const, title: "t", engagement: null, leads: null, ...o });
  const items = [
    it({ weekStart: "2026-10-26", status: "publicada", engagement: 120, leads: 2 }), it({ weekStart: "2026-10-19", status: "publicada", engagement: 300 }),
    it({ weekStart: "2026-10-12", status: "agendada" }), it({ weekStart: "2026-10-05", status: "rascunho", axisId: "a2" }),
    it({ weekStart: "2026-09-28", status: "publicada", axisId: "a2" }), it({ weekStart: "2026-11-02", status: "ideia", axisId: "a1" }),
    it({ weekStart: "2026-10-19", status: "descartada", axisId: "a3" }),
  ];
  const sm = S.summarize(items, [{ id: "a1" }, { id: "a2" }, { id: "a3" }], cw);
  assert.deepEqual(sm.byStatus, { ideia: 1, rascunho: 1, agendada: 1, publicada: 3, descartada: 1 });
  // janela do ritmo: 05/10 (cw-21) a 26/10 → rascunho(05/10), agendada(12/10), publicada(19/10), publicada(26/10); a de 28/09 fica de fora
  assert.deepEqual(sm.pace, { planned: 4, published: 2, ratio: 0.5 });
  assert.equal(sm.axes.find((a) => a.axisId === "a3")!.gap, true, "descartada não conta: eixo sem conteúdo ativo");
  assert.equal(sm.axes.find((a) => a.axisId === "a1")!.gap, false);
  assert.equal(sm.axes.find((a) => a.axisId === "a2")!.count, 2);
  assert.deepEqual(sm.top.map((t) => t.engagement), [300, 120], "mais engajadas primeiro");
  assert.deepEqual(sm.totals, { engagement: 420, leads: 2 });
  assert.equal(S.summarize([], [{ id: "a1" }], cw).pace.ratio, null, "sem planejado não há razão (nada de divisão por zero)");
  assert.equal(S.summarize([], [{ id: "a1" }], cw).axes[0].gap, false, "com um só eixo não há desequilíbrio a apontar");
  ok("resumo do calendário: ritmo, equilíbrio dos eixos, mais engajadas e totais");

  // ── Com banco ─────────────────────────────────────────────────────────
  const { getDb, schema, closeDb } = await import("../lib/db");
  const { createUser } = await import("../domains/users/service");
  const { createMentee } = await import("../domains/mentees/service");
  const { listTemplates } = await import("../domains/templates/service");
  const { createProgram } = await import("../domains/programs/service");
  const { createOffer } = await import("../domains/offers/service");
  const C = await import("../domains/cadence/service");
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
  const offerX = await createOffer(ctx(mA), progX.id, { revenueSlug: "workshops", name: "Palestras", problem: "Escolas sem porta de entrada comercial", audience: "Mantenedores e diretores" });
  const offerY = await createOffer(ctx(mB), progY.id, { revenueSlug: "workshops", name: "Palestras Y", problem: "Escolas sem porta de entrada comercial", audience: "Mantenedores e diretores" });

  // Eixos
  assert.deepEqual(await K.listAxes(ctx(xU), progX.id), []);
  await must(K.addAxis(ctx(xU), progX.id, { name: "Instituição" }), "Acesso negado");
  await must(K.addAxis(ctx(mB), progX.id, { name: "Instituição" }), "Acesso negado");
  await must(K.addAxis(ctx(mA), progX.id, { name: " " }), "nome do eixo");
  await must(K.addAxis(ctx(mA), progX.id, { name: "x".repeat(81) }), "longo demais");
  const a1 = await K.addAxis(ctx(mA), progX.id, { name: "Instituição", description: "Cultura e gestão escolar" });
  const a2 = await K.addAxis(ctx(mA), progX.id, { name: "Trajetórias de futuro" });
  await K.addAxis(ctx(dir), progX.id, { name: "Território" });
  await must(K.addAxis(ctx(mA), progX.id, { name: "instituição" }), "Já existe");
  await must(K.addExampleAxes(ctx(mA), progX.id), "já tem eixos");
  const ex = await K.addExampleAxes(ctx(mB), progY.id);
  assert.equal(ex, 3);
  assert.equal((await K.listAxes(ctx(yU), progY.id)).length, 3, "eixos de exemplo");
  assert.equal((await K.listAxes(ctx(xU), progX.id)).length, 3, "eixos são por programa");
  await must(K.listAxes(ctx(mB), progX.id), "Acesso negado");
  await must(K.listAxes(ctx(yU), progX.id), "Acesso negado");
  const ren = await K.updateAxis(ctx(mA), a2.id, { name: "Trajetórias", description: "Projeto de vida" });
  assert.equal(ren.name, "Trajetórias");
  await must(K.updateAxis(ctx(mA), a2.id, { name: "Instituição" }), "Já existe");
  await must(K.updateAxis(ctx(xU), a2.id, { name: "x" }), "Acesso negado");
  await must(K.updateAxis(ctx(mA), "00000000-0000-0000-0000-000000000000", { name: "x" }), "não encontrado");
  ok("eixos editáveis por programa: criar, renomear, exemplos, nomes únicos, permissões e isolamento");

  // Itens
  const wk = W.currentWeek();
  const base0 = { weekStart: wk, channel: "linkedin", title: "Por que tanta formação termina antes da sala de aula?", axisId: a1.id, offerId: offerX.id };
  await must(K.createItem(ctx(yU), progX.id, base0), "Acesso negado");
  await must(K.createItem(ctx(mB), progX.id, base0), "Acesso negado");
  await must(K.createItem(ctx(xU), progX.id, { ...base0, channel: "tiktok" }), "Canal");
  await must(K.createItem(ctx(xU), progX.id, { ...base0, title: " " }), "título");
  await must(K.createItem(ctx(xU), progX.id, { ...base0, title: "x".repeat(201) }), "longo demais");
  await must(K.createItem(ctx(xU), progX.id, { ...base0, weekStart: "semana 3" }), "Semana");
  await must(K.createItem(ctx(xU), progX.id, { ...base0, status: "voando" as any }), "Situação");
  await must(K.createItem(ctx(xU), progX.id, { ...base0, axisId: ex === 3 ? (await K.listAxes(ctx(mB), progY.id))[0].id : null }), "Eixo inválido");
  await must(K.createItem(ctx(xU), progX.id, { ...base0, offerId: offerY.id }), "Oferta inválida");
  await must(K.createItem(ctx(xU), progX.id, { ...base0, publishUrl: "javascript:alert(1)" }), "http");
  await must(K.createItem(ctx(xU), progX.id, { ...base0, engagement: -1 }), "inteiro");
  await must(K.createItem(ctx(xU), progX.id, { ...base0, leads: 1.5 }), "inteiro");
  const i1 = await K.createItem(ctx(xU), progX.id, { ...base0, weekStart: W.addDays(wk, 2), thesis: "A cultura precisa oferecer tempo e acompanhamento." });
  assert.equal(i1.weekStart, wk, "a semana é normalizada para a segunda-feira");
  assert.equal(i1.status, "ideia");
  assert.equal(i1.createdBy, xU.id, "mentorado planeja o próprio conteúdo");
  const i2 = await K.createItem(ctx(mA), progX.id, { weekStart: W.addDays(wk, -7), channel: "artigo", title: "Quando o inglês ocupa o centro da promessa", axisId: a2.id, status: "rascunho" });
  const i3 = await K.createItem(ctx(mA), progX.id, { weekStart: wk, channel: "linkedin", title: "O que os espaços da escola denunciam", axisId: a1.id });
  assert.equal((await K.listItems(ctx(xU), progX.id)).length, 3);
  assert.equal((await K.listItems(ctx(mA), progX.id))[0].weekStart, W.addDays(wk, -7), "ordenadas por semana");
  await must(K.listItems(ctx(mB), progX.id), "Acesso negado");
  await must(K.listItems(ctx(yU), progX.id), "Acesso negado");
  ok("calendário: validações, semana normalizada, mentorado e equipe planejam, isolamento");

  // Status e publicação
  const pub = await K.updateItem(ctx(xU), i1.id, { status: "publicada", publishUrl: "https://www.linkedin.com/posts/exemplo", engagement: 150, leads: 2 });
  assert.equal(pub.status, "publicada");
  assert.equal(pub.publishedOn, todayBR(), "ao publicar, a data é preenchida");
  assert.equal(pub.engagement, 150);
  await must(K.updateItem(ctx(xU), i1.id, { publishedOn: W.addDays(todayBR(), 3) }), "futuro");
  await must(K.updateItem(ctx(yU), i1.id, { title: "x" }), "Acesso negado");
  await must(K.updateItem(ctx(mB), i1.id, { title: "x" }), "Acesso negado");
  await must(K.updateItem(ctx(mA), i1.id, { axisId: (await K.listAxes(ctx(mB), progY.id))[0].id }), "Eixo inválido");
  await must(K.updateItem(ctx(mA), "00000000-0000-0000-0000-000000000000", { title: "x" }), "não encontrada");
  const back = await K.updateItem(ctx(mA), i1.id, { status: "agendada" });
  assert.equal(back.publishedOn, null, "sair de 'publicada' limpa a data de publicação");
  await K.updateItem(ctx(mA), i1.id, { status: "publicada", publishedOn: W.addDays(todayBR(), -1) });
  const kept = await K.listItems(ctx(mA), progX.id);
  assert.equal(kept.find((i) => i.id === i1.id)!.publishedOn, W.addDays(todayBR(), -1), "data informada é respeitada");
  await K.updateItem(ctx(mA), i3.id, { status: "publicada" });
  await K.updateItem(ctx(mA), i3.id, { status: "descartada" });
  assert.equal((await K.listItems(ctx(mA), progX.id)).find((i) => i.id === i3.id)!.status, "descartada", "descartar não apaga");
  ok("status: publicar preenche a data, voltar limpa, futuro recusado, descartar não apaga");

  // KPI a partir das publicações
  await K.updateItem(ctx(mA), i3.id, { status: "publicada" });
  const synced = await K.syncKpisFromContent(ctx(xU), progX.id, wk);
  assert.deepEqual(synced, { "posts-linkedin": 2, artigos: 0 }, "2 posts de LinkedIn publicados na semana; artigo estava em outra semana");
  assert.deepEqual((await C.getWeek(ctx(mA), progX.id, wk)).actuals["posts-linkedin"], 2);
  await K.updateItem(ctx(mA), i2.id, { status: "publicada" });
  assert.deepEqual(await K.syncKpisFromContent(ctx(mA), progX.id, W.addDays(wk, -7)), { "posts-linkedin": 0, artigos: 1 });
  await must(K.syncKpisFromContent(ctx(mB), progX.id, wk), "Acesso negado");
  await must(K.syncKpisFromContent(ctx(xU), progX.id, "2026-10-27"), "segunda-feira");
  await must(K.syncKpisFromContent(ctx(xU), progX.id, W.addDays(wk, 7)), "futuras");
  await db.delete(schema.programKpis).where(eq(schema.programKpis.programId, progY.id));
  await must(K.syncKpisFromContent(ctx(mB), progY.id, wk), "não tem os KPIs");
  ok("publicações publicadas alimentam os KPIs da semana (só os que existem no programa)");

  // Remover eixo: publicações ficam sem eixo
  await K.removeAxis(ctx(mA), a2.id);
  assert.equal((await K.listItems(ctx(mA), progX.id)).find((i) => i.id === i2.id)!.axisId, null, "publicação continua, sem eixo");
  assert.equal((await K.listAxes(ctx(mA), progX.id)).length, 2);
  await must(K.removeAxis(ctx(xU), a1.id), "Acesso negado");
  await must(K.removeAxis(ctx(mA), a2.id), "não encontrado");
  ok("remover eixo não apaga publicações");

  // Biblioteca de links
  await must(K.addLink(ctx(yU), progX.id, { title: "x", url: "https://exemplo.com" }), "Acesso negado");
  await must(K.addLink(ctx(mB), progX.id, { title: "x", url: "https://exemplo.com" }), "Acesso negado");
  await must(K.addLink(ctx(xU), progX.id, { title: " ", url: "https://exemplo.com" }), "título");
  await must(K.addLink(ctx(xU), progX.id, { title: "x", url: "javascript:alert(1)" }), "endereço válido");
  await must(K.addLink(ctx(xU), progX.id, { title: "x", url: "https://exemplo.com", category: "c".repeat(61) }), "longo demais");
  const l1 = await K.addLink(ctx(mA), progX.id, { title: "Pasta do programa", url: "https://drive.google.com/drive/folders/1AbCdEf?usp=sharing", category: "Drive", pinned: true });
  const l2 = await K.addLink(ctx(mA), progX.id, { title: "Planilha de KPIs", url: "https://docs.google.com/spreadsheets/d/1XyZ/edit", category: "Drive", pinned: true });
  const l3 = await K.addLink(ctx(xU), progX.id, { title: "Meu LinkedIn", url: "https://www.linkedin.com/in/exemplo", category: "Perfis" });
  assert.equal(l1.kind, "drive-pasta");
  assert.equal(l2.kind, "drive-arquivo");
  assert.equal(l3.kind, "link");
  assert.equal(l3.createdBy, xU.id);
  const libs = await K.listLinks(ctx(xU), progX.id);
  assert.deepEqual(libs.slice(0, 2).map((l) => l.pinned), [true, true], "fixados (acesso rápido) vêm primeiro");
  assert.equal(libs[2].id, l3.id);
  await must(K.listLinks(ctx(mB), progX.id), "Acesso negado");
  assert.equal((await K.listLinks(ctx(yU), progY.id)).length, 0, "biblioteca é por programa");
  // permissões de edição: equipe edita tudo; mentorado só o que ele mesmo criou
  await K.updateLink(ctx(xU), l3.id, { pinned: true, title: "Meu LinkedIn (fixado)" });
  await must(K.updateLink(ctx(xU), l1.id, { pinned: false }), "Acesso negado");
  await must(K.removeLink(ctx(xU), l1.id), "Acesso negado");
  await must(K.updateLink(ctx(yU), l3.id, { pinned: false }), "Acesso negado");
  await must(K.updateLink(ctx(mB), l3.id, { pinned: false }), "Acesso negado");
  const moved = await K.updateLink(ctx(mA), l3.id, { url: "https://drive.google.com/file/d/9/view", category: "Materiais" });
  assert.equal(moved.kind, "drive-arquivo", "trocar o endereço refaz a detecção do tipo");
  await must(K.updateLink(ctx(mA), l3.id, { url: "ftp://x.com/y" }), "endereço válido");
  await must(K.updateLink(ctx(mA), l3.id, { title: " " }), "título");
  await K.removeLink(ctx(xU), l3.id);
  await K.removeLink(ctx(mA), l2.id);
  await must(K.removeLink(ctx(mA), l2.id), "não encontrado");
  assert.equal((await K.listLinks(ctx(mA), progX.id)).length, 1);
  ok("biblioteca: Drive arquivo/pasta detectados, fixados primeiro, mentorado edita só o que criou, equipe edita tudo");

  // Auditoria
  const log = await db.select().from(schema.activityLog);
  const actions = new Set(log.map((l) => l.action));
  for (const a of ["content.add_axis", "content.update_axis", "content.remove_axis", "content.example_axes", "content.create", "content.update", "library.add", "library.update", "library.remove", "cadence.kpis"])
    assert.ok(actions.has(a), `auditoria registra ${a}`);
  const rm = log.find((l) => l.action === "library.remove");
  assert.ok(rm?.beforeJson, "remoção guarda o registro");
  await db.delete(schema.programs).where(eq(schema.programs.id, progX.id));
  for (const t of [schema.contentAxes, schema.contentItems, schema.libraryLinks] as const) assert.equal((await db.select().from(t).where(eq(t.programId, progX.id))).length, 0);
  ok("auditoria e integridade (remover programa limpa eixos, publicações e links)");

  await closeDb();
  console.log("\nOK — conteúdo e biblioteca passaram.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
