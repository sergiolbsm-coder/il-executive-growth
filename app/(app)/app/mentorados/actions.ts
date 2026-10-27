"use server";

import { revalidatePath } from "next/cache";
import { assignMentors, createMentee } from "@/domains/mentees/service";
import { createProgram } from "@/domains/programs/service";
import { ValidationError } from "@/lib/errors";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";

const UUID = /^[0-9a-f-]{36}$/i;

export type MenteeState = { error?: string; ok?: string; tempPassword?: string } | undefined;

async function guard<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

export async function createMenteeAction(_: MenteeState, form: FormData): Promise<MenteeState> {
  const actor = toContext(await requireUser());
  const r = await guard(() =>
    createMentee(actor, {
      fullName: String(form.get("fullName") ?? ""),
      email: String(form.get("email") ?? ""),
      segment: String(form.get("segment") ?? ""),
      mentorIds: form.getAll("mentorIds").map(String).filter((v) => UUID.test(v)),
      createAccess: form.get("createAccess") === "on",
    }),
  );
  revalidatePath("/app/mentorados");
  if ("error" in r) return r;
  if (!r.grant) return { ok: "Mentorado cadastrado (sem acesso)." };
  return {
    ok: r.grant.mail.sent ? "Mentorado cadastrado. E-mail de liberação enviado." : "Mentorado cadastrado. E-mail não enviado — repasse a senha provisória por outro canal:",
    tempPassword: r.grant.mail.sent ? undefined : r.grant.tempPassword,
  };
}

export async function assignMentorsAction(menteeId: string, _: MenteeState, form: FormData): Promise<MenteeState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => assignMentors(actor, menteeId, form.getAll("mentorIds").map(String).filter((v) => UUID.test(v))));
  revalidatePath(`/app/mentorados/${menteeId}`);
  return r && "error" in r ? r : { ok: "Mentores atualizados." };
}

export async function createProgramAction(menteeId: string, _: MenteeState, form: FormData): Promise<MenteeState> {
  const actor = toContext(await requireUser());
  const hours = String(form.get("weeklyHours") ?? "").trim();
  const r = await guard(() =>
    createProgram(actor, {
      menteeId,
      templateId: String(form.get("templateId") ?? ""),
      name: String(form.get("name") ?? ""),
      model: String(form.get("model") ?? ""),
      purpose: String(form.get("purpose") ?? ""),
      weeklyHours: hours ? Number(hours) : null,
      startDate: String(form.get("startDate") ?? ""),
      endDate: String(form.get("endDate") ?? ""),
    }),
  );
  revalidatePath(`/app/mentorados/${menteeId}`);
  return "error" in r ? r : { ok: "Programa aberto a partir do template." };
}
