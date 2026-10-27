"use server";

import { revalidatePath } from "next/cache";
import { updateProgram } from "@/domains/programs/service";
import { ValidationError } from "@/lib/errors";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";

export type ProgramState = { error?: string; ok?: string } | undefined;

export async function updateProgramAction(programId: string, _: ProgramState, form: FormData): Promise<ProgramState> {
  const actor = toContext(await requireUser());
  const hours = String(form.get("weeklyHours") ?? "").trim();
  try {
    await updateProgram(actor, programId, {
      name: String(form.get("name") ?? ""),
      purpose: String(form.get("purpose") ?? ""),
      weeklyHours: hours ? Number(hours) : null,
      startDate: String(form.get("startDate") ?? "") || null,
      endDate: String(form.get("endDate") ?? "") || null,
      status: String(form.get("status") ?? "ativo"),
    });
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/app/programas/${programId}`);
  return { ok: "Programa atualizado." };
}
