"use server";

import { revalidatePath } from "next/cache";
import { createSession, createTask, setTaskStatus } from "@/domains/sessions/service";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";

export type SessState = { error?: string; ok?: string } | undefined;
const s = (f: FormData, k: string) => String(f.get(k) ?? "");

async function guard(fn: () => Promise<unknown>, ok?: string): Promise<SessState> {
  try {
    await fn();
    return ok ? { ok } : undefined;
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

export async function createSessionAction(_: SessState, f: FormData): Promise<SessState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => createSession(actor, s(f, "programId"), { heldOn: s(f, "heldOn"), title: s(f, "title"), summary: s(f, "summary"), decisions: s(f, "decisions"), internalNotes: s(f, "internalNotes") }), "Sessão registrada.");
  revalidatePath("/app/sessoes");
  return r;
}

export async function createTaskAction(_: SessState, f: FormData): Promise<SessState> {
  const actor = toContext(await requireUser());
  const r = await guard(
    () => createTask(actor, s(f, "programId"), { title: s(f, "title"), dueDate: s(f, "dueDate") || null, assignee: s(f, "assignee") === "mentor" ? "mentor" : "mentorado", sessionId: s(f, "sessionId") || null }),
    "Tarefa criada.",
  );
  revalidatePath("/app/sessoes");
  return r;
}

export async function setTaskStatusAction(taskId: string, status: "aberta" | "concluida" | "cancelada"): Promise<SessState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => setTaskStatus(actor, taskId, status));
  revalidatePath("/app/sessoes");
  return r;
}
