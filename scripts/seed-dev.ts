// Seed SINTÉTICO para desenvolvimento local (PGlite). Nomes obviamente fictícios; nada de dados reais.
// Recusa rodar contra banco externo. Senhas geradas e gravadas em .data/dev-credentials.txt (ignorado pelo git).
import { mkdir, writeFile } from "node:fs/promises";
import { createMentee } from "../domains/mentees/service";
import { checkGate, createOffer, recordSale } from "../domains/offers/service";
import { todayBR } from "../domains/offers/stage";
import { createProgram } from "../domains/programs/service";
import { createSession, createTask } from "../domains/sessions/service";
import { saveCheckin, saveKpiEntries } from "../domains/cadence/service";
import { createEntry, saveEntry } from "../domains/tools/service";
import { currentWeek } from "../lib/week";
import { listTemplates } from "../domains/templates/service";
import { createUser } from "../domains/users/service";
import { generateTempPassword } from "../lib/auth/core";
import { closeDb, getDb, schema } from "../lib/db";

async function main() {
  if (process.env.DATABASE_URL) throw new Error("seed:dev só roda no banco local (PGlite). Remova DATABASE_URL.");
  const pw = generateTempPassword();
  const mk = (name: string, email: string, role: "admin" | "direcao" | "mentor") =>
    createUser(null, { name, email, role, password: pw, sendEmail: false }).then((g) => g.user);

  const admin = await mk("Admin Dev", "admin@exemplo.invalid", "admin");
  const dir = await mk("Direção Dev", "direcao@exemplo.invalid", "direcao");
  const mentor = await mk("Mentora Exemplo", "mentora@exemplo.invalid", "mentor");
  const ctx = (u: { id: string; role: any }) => ({ userId: u.id, role: u.role });

  const m = await createMentee(ctx(dir), {
    fullName: "Mentorado Exemplo (fictício)", email: "mentorado@exemplo.invalid", segment: "educacao",
    mentorIds: [mentor.id], createAccess: true, sendEmail: false,
  });
  await createMentee(ctx(dir), { fullName: "Pré-cadastro Exemplo (fictício)", segment: "financas", mentorIds: [mentor.id] });

  const [tpl] = await listTemplates(ctx(admin));
  const prog = await createProgram(ctx(dir), {
    menteeId: m.mentee.id, templateId: tpl.id, name: "Mentoria Executiva — Exemplo", model: "executive",
    purpose: "Propósito de exemplo: transformar conhecimento em negócio com impacto.", weeklyHours: 6,
    startDate: "2026-10-26", endDate: "2027-04-30",
  });

  // Ofertas de exemplo em estágios diferentes (para ver o painel e o mapa)
  const mc = ctx(mentor);
  const today = todayBR();
  const shift = (n: number) => new Date(Date.parse(today + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
  const soon = shift(20);
  const late = shift(-5);
  const o1 = await createOffer(mc, prog.id, { revenueSlug: "workshops", name: "Palestras (exemplo)", problem: "Escolas sem porta de entrada comercial", audience: "Mantenedores e diretores", targetStage: 4, dueDate: late, wave: 1 });
  for (const k of ["ficha-1-pagina", "preco", "pitch", "proposta", "material-entrega"]) await checkGate(mc, o1.id, k, `Evidência de exemplo: ${k}`);
  const o2 = await createOffer(mc, prog.id, { revenueSlug: "instituicoes", name: "Diagnóstico (exemplo)", problem: "Gestão escolar travada", audience: "Escolas privadas", targetStage: 5, dueDate: soon, wave: 1 });
  for (const k of ["ficha-1-pagina", "preco", "pitch", "proposta", "material-entrega", "canal-aquisicao", "metas-semanais"]) await checkGate(mc, o2.id, k, `Evidência de exemplo: ${k}`);
  await recordSale(mc, o2.id, { clientName: "Escola Exemplo (fictícia)", valueCents: 250000, soldAt: today, channel: "LinkedIn", originOfferId: o1.id });
  const o3 = await createOffer(mc, prog.id, { revenueSlug: "conselhos", name: "Advisory (exemplo)", problem: "Decisões estratégicas sem apoio", audience: "Mantenedores", targetStage: 3, wave: 3 });

  // Sessões, tarefas, cadência e ferramentas de exemplo
  const sess = await createSession(mc, prog.id, { heldOn: today, title: "Kick-off (exemplo)", summary: "Alinhamos o propósito e o portfólio de ofertas.", decisions: "Começar por palestras e diagnóstico.", internalNotes: "Nota interna de exemplo: mentorada ainda insegura com preço." });
  await createTask(mc, prog.id, { title: "Enviar a ficha do Advisory", dueDate: shift(3), sessionId: sess.id, offerId: o3.id });
  await createTask(mc, prog.id, { title: "Revisar o pitch das palestras", assignee: "mentor", dueDate: shift(-2) });
  const wk = currentWeek();
  await saveKpiEntries(mc, prog.id, wk, { conexoes: 12, "contatos-diretos": 6, "reunioes-realizadas": 2, "posts-linkedin": 3, comentarios: 7 });
  await saveCheckin(mc, prog.id, wk, { plan: "Prospectar 20 contas", done: "Prospectei 12", result: "2 reuniões", adjust: "Mais contatos pela manhã", objection: "Preço", traffic: "amarelo" });
  const ficha = await createEntry(mc, prog.id, "sintese-profissional", { title: "Síntese (exemplo)" });
  await saveEntry(mc, ficha.id, { problemas: "Ajudei escolas a estruturar produtos.", especialidades: "Produtos educacionais e expansão.", resultados: "Crescimento de 47% na área B2B." }, true);
  const e2 = await createEntry(mc, prog.id, "ficha-oferta", { offerId: o3.id });
  await saveEntry(mc, e2.id, { publico: "Mantenedores" }, false);

  // Em desenvolvimento, não exige a troca de senha a cada seed
  await (await getDb()).update(schema.users).set({ mustChangePassword: false });

  await mkdir(".data", { recursive: true });
  await writeFile(
    ".data/dev-credentials.txt",
    `Senha de TODOS os usuários de desenvolvimento: ${pw}\nadmin@exemplo.invalid · direcao@exemplo.invalid · mentora@exemplo.invalid · mentorado@exemplo.invalid\n(Mentorado: senha provisória gerada à parte — redefina como admin.)\n`,
  );
  // O mentorado foi criado com senha gerada própria; usa a mesma para facilitar o teste local.
  const { resetPassword } = await import("../domains/users/service");
  await resetPassword(ctx(admin), m.grant!.user.id, { password: pw, sendEmail: false });
  console.log("Seed de desenvolvimento aplicado. Credenciais em .data/dev-credentials.txt");
}

main().then(closeDb).catch(async (e) => {
  console.error(e.message ?? e);
  await closeDb().catch(() => {});
  process.exit(1);
});
