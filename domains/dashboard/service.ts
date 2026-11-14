import { listMentees } from "@/domains/mentees/service";
import { listOffers, listPendingGates } from "@/domains/offers/service";
import { todayBR } from "@/domains/offers/stage";
import { listPrograms } from "@/domains/programs/service";
import { getScore } from "@/domains/score/service";
import { listTasks } from "@/domains/sessions/service";
import { listTickets } from "@/domains/support/service";
import { type AuthContext, isStaff } from "@/lib/authorization";

/** O que a pessoa precisa fazer agora: a equipe vê pendências da carteira; o mentorado, o próximo passo do plano dele. */
export async function dashboardSummary(actor: AuthContext) {
  const mentees = await listMentees(actor);
  const programs = (await listPrograms(actor, mentees)).filter((p) => p.status === "ativo");
  const today = todayBR();
  const offers = (await Promise.all(programs.map(async (p) => (await listOffers(actor, p.id)).map((o) => ({ ...o, programName: p.name, menteeName: mentees.find((m) => m.id === p.menteeId)?.fullName ?? "" }))))).flat();
  const late = offers.filter((o) => o.status === "ativa" && (o.schedule === "atrasada" || o.schedule === "em-risco")).sort((a, b) => (a.schedule === b.schedule ? 0 : a.schedule === "atrasada" ? -1 : 1));
  const tasks = (await listTasks(actor)).filter((t) => t.status === "aberta");
  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today);

  if (isStaff(actor)) {
    const [pending, tickets] = await Promise.all([listPendingGates(actor), listTickets(actor)]);
    const open = tickets.filter((t) => t.status !== "resolvido");
    return {
      kind: "staff" as const,
      menteeCount: mentees.length,
      programCount: programs.length,
      pending: { count: pending.length, items: pending.slice(0, 5) },
      late: { count: late.length, items: late.slice(0, 5) },
      tickets: { count: open.length, items: open.slice(0, 4) },
      overdue: { count: overdue.length, items: overdue.slice(0, 5) },
    };
  }

  const prog = programs[0] ?? null;
  const score = prog ? await getScore(actor, prog.id) : null;
  const mine = tasks.filter((t) => t.assignee === "mentorado");
  return {
    kind: "mentee" as const,
    program: prog ? { id: prog.id, name: prog.name } : null,
    steps: score ? score.steps.slice(0, 3) : [],
    offers: offers.filter((o) => o.status === "ativa").slice(0, 6),
    awaiting: offers.reduce((s, o) => s + o.pendingChecks, 0),
    tasks: { count: mine.length, items: mine.slice(0, 5), overdue: mine.filter((t) => t.dueDate && t.dueDate < today).length },
  };
}
