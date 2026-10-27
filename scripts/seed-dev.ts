// Seed SINTÉTICO para desenvolvimento local (PGlite). Nomes obviamente fictícios; nada de dados reais.
// Recusa rodar contra banco externo. Senhas geradas e gravadas em .data/dev-credentials.txt (ignorado pelo git).
import { mkdir, writeFile } from "node:fs/promises";
import { createMentee } from "../domains/mentees/service";
import { createProgram } from "../domains/programs/service";
import { listTemplates } from "../domains/templates/service";
import { createUser } from "../domains/users/service";
import { generateTempPassword } from "../lib/auth/core";
import { closeDb } from "../lib/db";

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
  await createProgram(ctx(dir), {
    menteeId: m.mentee.id, templateId: tpl.id, name: "Mentoria Executiva — Exemplo", model: "executive",
    purpose: "Propósito de exemplo: transformar conhecimento em negócio com impacto.", weeklyHours: 6,
    startDate: "2026-10-26", endDate: "2027-04-30",
  });

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
