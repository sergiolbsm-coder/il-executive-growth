import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { type AuthContext, ForbiddenError, isStaff } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { TICKET_KINDS, type TicketArea, type TicketKind, type TicketStatus, isArea, isKind } from "@/lib/support";
import { sendNotice } from "@/lib/mail";
import { TICKET_AREAS } from "@/lib/support";
import { listMentees } from "@/domains/mentees/service";

const clip = (v: string | null | undefined, max: number, label: string) => {
  const t = (v ?? "").trim();
  if (t.length > max) throw new ValidationError(`${label} excede ${max} caracteres.`);
  return t;
};

/** Mentorados que o ator enxerga (mentorado: o próprio; equipe: conforme a carteira). */
async function visibleMenteeIds(actor: AuthContext) {
  const rows = await listMentees(actor);
  return new Map(rows.map((m) => [m.id, m.fullName]));
}

const excerpt = (t: string) => (t.length > 600 ? `${t.slice(0, 600)}…` : t);
const areaLabel = (a: string) => TICKET_AREAS[a as TicketArea]?.label ?? a;

/** Avisos por e-mail: falha de envio nunca desfaz a ação. */
async function notify(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error("[chamados] aviso por e-mail falhou:", e instanceof Error ? e.message : e);
  }
}

/** E-mails da equipe que enxerga o mentorado: administração, direção, mentores atribuídos e mentores com carteira "todos". */
async function staffEmails(menteeId: string) {
  const db = await getDb();
  const links = await db.select({ mentorId: schema.mentorAssignments.mentorId }).from(schema.mentorAssignments).where(eq(schema.mentorAssignments.menteeId, menteeId));
  const ids = links.map((l) => l.mentorId);
  const rows = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.active, true),
        or(
          inArray(schema.users.role, ["admin", "direcao"]),
          and(eq(schema.users.role, "mentor"), eq(schema.users.mentorScope, "all")),
          ids.length ? inArray(schema.users.id, ids) : undefined,
        ),
      ),
    );
  return rows.map((r) => r.email);
}

async function menteeEmail(menteeId: string) {
  const db = await getDb();
  const [m] = await db.select({ email: schema.mentees.email, userId: schema.mentees.userId }).from(schema.mentees).where(eq(schema.mentees.id, menteeId)).limit(1);
  return m?.userId ? m.email : null; // só quem tem acesso ao sistema recebe (precisa entrar para ver a resposta)
}

export async function createTicket(
  actor: AuthContext,
  input: { kind: string; area: string; title: string; description?: string; pagePath?: string | null; menteeId?: string },
) {
  if (!isKind(input.kind)) throw new ValidationError("Tipo de chamado inválido.");
  if (!isArea(input.area)) throw new ValidationError("Escolha a funcionalidade.");
  const title = clip(input.title, 160, "O título");
  if (!title) throw new ValidationError("Descreva o assunto em poucas palavras.");
  const description = clip(input.description, 4000, "A descrição");
  const visible = await visibleMenteeIds(actor);
  let menteeId = input.menteeId;
  if (!isStaff(actor)) menteeId = [...visible.keys()][0]; // mentorado: sempre o próprio cadastro
  if (!menteeId || !visible.has(menteeId)) throw new ValidationError(isStaff(actor) ? "Escolha o mentorado." : "Seu cadastro de mentorado não foi encontrado.");
  const pagePath = input.pagePath && /^\/[\w\-/[\]?=&.]*$/.test(input.pagePath) ? input.pagePath.slice(0, 200) : null;
  const db = await getDb();
  const [t] = await db
    .insert(schema.supportTickets)
    .values({ menteeId, openedBy: actor.userId, kind: input.kind as TicketKind, area: input.area as TicketArea, title, description: description || null, pagePath })
    .returning();
  await audit({ actorId: actor.userId, entityType: "ticket", entityId: t.id, action: "ticket.create", after: { area: t.area, kind: t.kind } });
  await notify(async () =>
    sendNotice({
      to: await staffEmails(menteeId!),
      subject: `Novo chamado #${t.number} — ${visible.get(menteeId!) ?? "mentorado"}`,
      heading: "Novo chamado de ajuda",
      lines: [`${visible.get(menteeId!) ?? "Mentorado"} · ${areaLabel(t.area)} · ${TICKET_KINDS[t.kind]}`, t.title, ...(t.description ? [excerpt(t.description)] : [])],
      link: { href: `/app/chamados/${t.id}`, label: "Abrir o chamado" },
    }),
  );
  return t;
}

export async function listTickets(actor: AuthContext, opts: { status?: TicketStatus } = {}) {
  const visible = await visibleMenteeIds(actor);
  if (!visible.size) return [];
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.supportTickets)
    .where(and(inArray(schema.supportTickets.menteeId, [...visible.keys()]), opts.status ? eq(schema.supportTickets.status, opts.status) : undefined))
    .orderBy(desc(schema.supportTickets.createdAt));
  const assignees = rows.map((r) => r.assignedTo).filter((v): v is string => !!v);
  const names = assignees.length
    ? new Map((await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, assignees))).map((u) => [u.id, u.name]))
    : new Map<string, string>();
  return rows.map((r) => ({ ...r, menteeName: visible.get(r.menteeId) ?? "—", assigneeName: r.assignedTo ? (names.get(r.assignedTo) ?? null) : null }));
}

export async function getTicket(actor: AuthContext, id: string) {
  const db = await getDb();
  const [t] = await db.select().from(schema.supportTickets).where(eq(schema.supportTickets.id, id)).limit(1);
  const visible = await visibleMenteeIds(actor);
  if (!t || !visible.has(t.menteeId)) throw new ForbiddenError();
  const msgs = await db
    .select({ id: schema.supportMessages.id, body: schema.supportMessages.body, internal: schema.supportMessages.internal, createdAt: schema.supportMessages.createdAt, authorId: schema.supportMessages.authorId, authorName: schema.users.name, authorRole: schema.users.role })
    .from(schema.supportMessages)
    .leftJoin(schema.users, eq(schema.users.id, schema.supportMessages.authorId))
    .where(eq(schema.supportMessages.ticketId, id))
    .orderBy(asc(schema.supportMessages.createdAt));
  const assigneeName = t.assignedTo ? (await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, t.assignedTo)).limit(1))[0]?.name ?? null : null;
  return { ticket: t, menteeName: visible.get(t.menteeId) ?? "—", assigneeName, messages: isStaff(actor) ? msgs : msgs.filter((m) => !m.internal) };
}

/** Responde no chamado. Equipe: assume o chamado se ainda estiver aberto; mentorado: volta a fila se estava resolvido. */
export async function addMessage(actor: AuthContext, ticketId: string, input: { body: string; internal?: boolean }) {
  const { ticket } = await getTicket(actor, ticketId);
  const body = clip(input.body, 4000, "A mensagem");
  if (!body) throw new ValidationError("Escreva a mensagem.");
  const staff = isStaff(actor);
  const db = await getDb();
  await db.insert(schema.supportMessages).values({ ticketId, authorId: actor.userId, body, internal: staff && !!input.internal });
  const set: Partial<typeof schema.supportTickets.$inferInsert> = { updatedAt: new Date() };
  if (staff && !input.internal && ticket.status === "aberto") Object.assign(set, { status: "em_andamento", assignedTo: ticket.assignedTo ?? actor.userId });
  if (!staff && ticket.status === "resolvido") Object.assign(set, { status: "aberto", resolvedAt: null });
  await db.update(schema.supportTickets).set(set).where(eq(schema.supportTickets.id, ticketId));
  await audit({ actorId: actor.userId, entityType: "ticket", entityId: ticketId, action: "ticket.message", after: { internal: staff && !!input.internal } });
  if (staff && input.internal) return; // nota interna não avisa ninguém
  await notify(async () => {
    if (staff) {
      const to = await menteeEmail(ticket.menteeId);
      if (to) await sendNotice({ to: [to], subject: `Resposta ao seu chamado #${ticket.number}`, heading: "A equipe respondeu ao seu chamado", lines: [ticket.title, excerpt(body)], link: { href: `/app/chamados/${ticketId}`, label: "Ver a resposta" } });
    } else {
      const db2 = await getDb();
      const assignee = ticket.assignedTo ? (await db2.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, ticket.assignedTo)).limit(1))[0]?.email : null;
      await sendNotice({ to: assignee ? [assignee] : await staffEmails(ticket.menteeId), subject: `Nova mensagem no chamado #${ticket.number}`, heading: "O mentorado respondeu ao chamado", lines: [ticket.title, excerpt(body)], link: { href: `/app/chamados/${ticketId}`, label: "Abrir o chamado" } });
    }
  });
}

/** Equipe assume o chamado. */
export async function assumeTicket(actor: AuthContext, ticketId: string) {
  if (!isStaff(actor)) throw new ForbiddenError();
  const { ticket } = await getTicket(actor, ticketId);
  if (ticket.status === "resolvido") throw new ValidationError("Chamado já resolvido.");
  const db = await getDb();
  await db.update(schema.supportTickets).set({ status: "em_andamento", assignedTo: actor.userId, updatedAt: new Date() }).where(eq(schema.supportTickets.id, ticketId));
  await audit({ actorId: actor.userId, entityType: "ticket", entityId: ticketId, action: "ticket.assume" });
}

/** Equipe resolve com a solução (visível ao mentorado e reaproveitada no painel de dúvidas). */
export async function resolveTicket(actor: AuthContext, ticketId: string, solution: string) {
  if (!isStaff(actor)) throw new ForbiddenError();
  const { ticket } = await getTicket(actor, ticketId);
  const sol = clip(solution, 4000, "A solução");
  if (!sol) throw new ValidationError("Registre a solução/resposta ao resolver.");
  const db = await getDb();
  await db
    .update(schema.supportTickets)
    .set({ status: "resolvido", solution: sol, resolvedAt: new Date(), assignedTo: actor.userId, updatedAt: new Date() })
    .where(eq(schema.supportTickets.id, ticketId));
  await audit({ actorId: actor.userId, entityType: "ticket", entityId: ticketId, action: "ticket.resolve" });
  await notify(async () => {
    const to = await menteeEmail(ticket.menteeId);
    if (to) await sendNotice({ to: [to], subject: `Chamado #${ticket.number} resolvido`, heading: "Seu chamado foi resolvido", lines: [ticket.title, `Solução:\n${excerpt(sol)}`], link: { href: `/app/chamados/${ticketId}`, label: "Ver o chamado" } });
  });
}

export async function reopenTicket(actor: AuthContext, ticketId: string) {
  await getTicket(actor, ticketId);
  const db = await getDb();
  await db.update(schema.supportTickets).set({ status: "aberto", resolvedAt: null, updatedAt: new Date() }).where(eq(schema.supportTickets.id, ticketId));
  await audit({ actorId: actor.userId, entityType: "ticket", entityId: ticketId, action: "ticket.reopen" });
}

/** Painel da equipe: volume por situação, dúvidas mais frequentes por funcionalidade e soluções já registradas. */
export async function supportPanel(actor: AuthContext) {
  if (!isStaff(actor)) throw new ForbiddenError();
  const all = await listTickets(actor);
  const byStatus = { aberto: 0, em_andamento: 0, resolvido: 0 } as Record<TicketStatus, number>;
  const byArea = new Map<string, { total: number; abertos: number }>();
  for (const t of all) {
    byStatus[t.status]++;
    const a = byArea.get(t.area) ?? { total: 0, abertos: 0 };
    a.total++;
    if (t.status !== "resolvido") a.abertos++;
    byArea.set(t.area, a);
  }
  const resolved = all.filter((t) => t.status === "resolvido" && t.resolvedAt);
  const avgHours = resolved.length ? Math.round(resolved.reduce((s, t) => s + (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 36e5, 0) / resolved.length) : null;
  return {
    total: all.length,
    byStatus,
    avgHours,
    areas: [...byArea.entries()].map(([area, v]) => ({ area, ...v })).sort((a, b) => b.total - a.total),
    solutions: all.filter((t) => t.status === "resolvido" && t.solution),
  };
}
