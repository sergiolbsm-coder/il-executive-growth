import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { type AuthContext, ForbiddenError, canEditProgram, canViewMentee, isStaff } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { isIsoDate } from "@/lib/week";
import { listMentees, toRef } from "@/domains/mentees/service";
import { loadProgram } from "@/domains/programs/service";

const MAX_TEXT = 8000;
const clip = (s: string | undefined | null, what: string) => {
  const v = (s ?? "").trim();
  if (v.length > MAX_TEXT) throw new ValidationError(`${what} é longo demais (máx. ${MAX_TEXT} caracteres).`);
  return v || null;
};

async function editableProgram(actor: AuthContext, programId: string) {
  const { program, mentee } = await loadProgram(programId);
  if (!canEditProgram(actor, toRef(mentee))) throw new ForbiddenError();
  return program;
}

export interface SessionInput {
  heldOn: string;
  title: string;
  summary?: string;
  decisions?: string;
  internalNotes?: string;
}

/** Registra uma sessão de mentoria (somente equipe com acesso). Notas internas nunca vão ao mentorado. */
export async function createSession(actor: AuthContext, programId: string, input: SessionInput) {
  await editableProgram(actor, programId);
  if (!input.title.trim()) throw new ValidationError("Informe o título da sessão.");
  if (!isIsoDate(input.heldOn)) throw new ValidationError("Informe a data da sessão.");
  const db = await getDb();
  const [s] = await db
    .insert(schema.mentoringSessions)
    .values({
      programId, heldOn: input.heldOn, title: input.title.trim(), summary: clip(input.summary, "A ata"),
      decisions: clip(input.decisions, "As decisões"), internalNotes: clip(input.internalNotes, "As notas internas"), createdBy: actor.userId,
    })
    .returning();
  await audit({ actorId: actor.userId, entityType: "session", entityId: s.id, action: "session.create", after: { programId, heldOn: s.heldOn, title: s.title } });
  return s;
}

export async function updateSession(actor: AuthContext, sessionId: string, patch: Partial<SessionInput>) {
  const db = await getDb();
  const [before] = await db.select().from(schema.mentoringSessions).where(eq(schema.mentoringSessions.id, sessionId)).limit(1);
  if (!before) throw new ValidationError("Sessão não encontrada.");
  await editableProgram(actor, before.programId);
  const set: Partial<typeof schema.mentoringSessions.$inferInsert> = {};
  if (patch.title !== undefined) {
    if (!patch.title.trim()) throw new ValidationError("Informe o título da sessão.");
    set.title = patch.title.trim();
  }
  if (patch.heldOn !== undefined) {
    if (!isIsoDate(patch.heldOn)) throw new ValidationError("Data inválida.");
    set.heldOn = patch.heldOn;
  }
  if (patch.summary !== undefined) set.summary = clip(patch.summary, "A ata");
  if (patch.decisions !== undefined) set.decisions = clip(patch.decisions, "As decisões");
  if (patch.internalNotes !== undefined) set.internalNotes = clip(patch.internalNotes, "As notas internas");
  if (!Object.keys(set).length) return before;
  const [after] = await db.update(schema.mentoringSessions).set({ ...set, updatedAt: new Date() }).where(eq(schema.mentoringSessions.id, sessionId)).returning();
  await audit({ actorId: actor.userId, entityType: "session", entityId: sessionId, action: "session.update", before: { title: before.title, heldOn: before.heldOn }, after: { fields: Object.keys(set) } });
  return after;
}

/** Sessões dos programas que o usuário vê. Para o mentorado, `internalNotes` vem sempre nulo. */
export async function listSessions(actor: AuthContext, programId?: string) {
  const db = await getDb();
  let ids: string[];
  if (programId) {
    const { mentee } = await loadProgram(programId);
    if (!canViewMentee(actor, toRef(mentee))) throw new ForbiddenError();
    ids = [programId];
  } else {
    const visible = await listMentees(actor);
    if (!visible.length) return [];
    ids = (await db.select({ id: schema.programs.id }).from(schema.programs).where(inArray(schema.programs.menteeId, visible.map((m) => m.id)))).map((p) => p.id);
  }
  if (!ids.length) return [];
  const rows = await db
    .select({ s: schema.mentoringSessions, programName: schema.programs.name, menteeName: schema.mentees.fullName })
    .from(schema.mentoringSessions)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.mentoringSessions.programId))
    .innerJoin(schema.mentees, eq(schema.mentees.id, schema.programs.menteeId))
    .where(inArray(schema.mentoringSessions.programId, ids))
    .orderBy(desc(schema.mentoringSessions.heldOn), desc(schema.mentoringSessions.createdAt));
  const staff = isStaff(actor);
  return rows.map((r) => ({ ...r.s, internalNotes: staff ? r.s.internalNotes : null, programName: r.programName, menteeName: r.menteeName }));
}

export interface TaskInput {
  title: string;
  dueDate?: string | null;
  assignee?: "mentor" | "mentorado";
  sessionId?: string | null;
  offerId?: string | null;
}

/** Cria tarefa (equipe). Sessão e oferta, se informadas, precisam ser do mesmo programa. */
export async function createTask(actor: AuthContext, programId: string, input: TaskInput) {
  await editableProgram(actor, programId);
  const title = input.title.trim();
  if (!title) throw new ValidationError("Informe a tarefa.");
  if (title.length > 500) throw new ValidationError("A tarefa é longa demais (máx. 500 caracteres).");
  if (input.dueDate && !isIsoDate(input.dueDate)) throw new ValidationError("Data inválida.");
  if (input.assignee && !["mentor", "mentorado"].includes(input.assignee)) throw new ValidationError("Responsável inválido.");
  const db = await getDb();
  if (input.sessionId) {
    const [x] = await db.select().from(schema.mentoringSessions).where(and(eq(schema.mentoringSessions.id, input.sessionId), eq(schema.mentoringSessions.programId, programId))).limit(1);
    if (!x) throw new ValidationError("Sessão inválida (precisa ser do mesmo programa).");
  }
  if (input.offerId) {
    const [x] = await db.select().from(schema.offers).where(and(eq(schema.offers.id, input.offerId), eq(schema.offers.programId, programId))).limit(1);
    if (!x) throw new ValidationError("Oferta inválida (precisa ser do mesmo programa).");
  }
  const [t] = await db
    .insert(schema.tasks)
    .values({ programId, title, dueDate: input.dueDate || null, assignee: input.assignee ?? "mentorado", sessionId: input.sessionId || null, offerId: input.offerId || null, createdBy: actor.userId })
    .returning();
  await audit({ actorId: actor.userId, entityType: "task", entityId: t.id, action: "task.create", after: { programId, title, assignee: t.assignee, dueDate: t.dueDate } });
  return t;
}

/**
 * Muda a situação da tarefa. Equipe: qualquer (aberta/concluída/cancelada). Mentorado: só conclui ou reabre as
 * tarefas dele (responsável = mentorado), nunca cancela.
 */
export async function setTaskStatus(actor: AuthContext, taskId: string, status: "aberta" | "concluida" | "cancelada") {
  if (!["aberta", "concluida", "cancelada"].includes(status)) throw new ValidationError("Situação inválida.");
  const db = await getDb();
  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
  if (!task) throw new ValidationError("Tarefa não encontrada.");
  const { mentee } = await loadProgram(task.programId);
  const staff = canEditProgram(actor, toRef(mentee));
  const own = actor.role === "mentorado" && canViewMentee(actor, toRef(mentee)) && task.assignee === "mentorado" && status !== "cancelada";
  if (!staff && !own) throw new ForbiddenError();
  await db.update(schema.tasks).set({ status, completedAt: status === "concluida" ? new Date() : null, updatedAt: new Date() }).where(eq(schema.tasks.id, taskId));
  await audit({ actorId: actor.userId, entityType: "task", entityId: taskId, action: "task.status", before: { status: task.status }, after: { status } });
}

/** Tarefas dos programas visíveis; abertas primeiro, por prazo. */
export async function listTasks(actor: AuthContext, programId?: string) {
  const db = await getDb();
  let ids: string[];
  if (programId) {
    const { mentee } = await loadProgram(programId);
    if (!canViewMentee(actor, toRef(mentee))) throw new ForbiddenError();
    ids = [programId];
  } else {
    const visible = await listMentees(actor);
    if (!visible.length) return [];
    ids = (await db.select({ id: schema.programs.id }).from(schema.programs).where(inArray(schema.programs.menteeId, visible.map((m) => m.id)))).map((p) => p.id);
  }
  if (!ids.length) return [];
  const rows = await db
    .select({ t: schema.tasks, programName: schema.programs.name, menteeName: schema.mentees.fullName, offerName: schema.offers.name })
    .from(schema.tasks)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.tasks.programId))
    .innerJoin(schema.mentees, eq(schema.mentees.id, schema.programs.menteeId))
    .leftJoin(schema.offers, eq(schema.offers.id, schema.tasks.offerId))
    .where(inArray(schema.tasks.programId, ids))
    .orderBy(asc(schema.tasks.dueDate), asc(schema.tasks.createdAt));
  const rank = (s: string) => (s === "aberta" ? 0 : s === "concluida" ? 1 : 2);
  return rows
    .map((r) => ({ ...r.t, programName: r.programName, menteeName: r.menteeName, offerName: r.offerName }))
    .sort((a, b) => rank(a.status) - rank(b.status) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}
