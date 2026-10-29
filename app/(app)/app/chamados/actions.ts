"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addMessage, assumeTicket, createTicket, reopenTicket, resolveTicket } from "@/domains/support/service";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";

export type TicketState = { error?: string; ok?: string } | undefined;

async function guard(fn: () => Promise<unknown>): Promise<TicketState | "done"> {
  try {
    await fn();
    return "done";
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

export async function createTicketAction(_: TicketState, form: FormData): Promise<TicketState> {
  const actor = toContext(await requireUser());
  let id = "";
  const r = await guard(async () => {
    const t = await createTicket(actor, {
      kind: String(form.get("kind") ?? ""),
      area: String(form.get("area") ?? ""),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      pagePath: String(form.get("pagePath") ?? "") || null,
      menteeId: String(form.get("menteeId") ?? "") || undefined,
    });
    id = t.id;
  });
  if (r !== "done") return r;
  revalidatePath("/app/chamados");
  redirect(`/app/chamados/${id}`);
}

export async function replyAction(ticketId: string, _: TicketState, form: FormData): Promise<TicketState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => addMessage(actor, ticketId, { body: String(form.get("body") ?? ""), internal: form.get("internal") === "on" }));
  revalidatePath(`/app/chamados/${ticketId}`);
  revalidatePath("/app/chamados");
  return r === "done" ? { ok: "Mensagem enviada." } : r;
}

export async function resolveAction(ticketId: string, _: TicketState, form: FormData): Promise<TicketState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => resolveTicket(actor, ticketId, String(form.get("solution") ?? "")));
  revalidatePath(`/app/chamados/${ticketId}`);
  revalidatePath("/app/chamados");
  return r === "done" ? { ok: "Chamado resolvido." } : r;
}

export async function assumeAction(ticketId: string): Promise<TicketState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => assumeTicket(actor, ticketId));
  revalidatePath(`/app/chamados/${ticketId}`);
  revalidatePath("/app/chamados");
  return r === "done" ? undefined : r;
}

export async function reopenAction(ticketId: string): Promise<TicketState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => reopenTicket(actor, ticketId));
  revalidatePath(`/app/chamados/${ticketId}`);
  revalidatePath("/app/chamados");
  return r === "done" ? undefined : r;
}
