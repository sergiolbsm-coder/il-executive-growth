"use server";

import { revalidatePath } from "next/cache";
import { loadTemplateDefaults } from "@/domains/programs/defaults";
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

export async function loadDefaultsAction(programId: string): Promise<ProgramState> {
  const actor = toContext(await requireUser());
  try {
    const a = await loadTemplateDefaults(actor, programId);
    revalidatePath(`/app/programas/${programId}`);
    const parts = [a.gates && `${a.gates} portão(ões)`, a.kpis && `${a.kpis} KPI(s)`, a.tools && `${a.tools} ferramenta(s)`, a.weights && "pesos do score"].filter(Boolean);
    return { ok: parts.length ? `Carregado do template: ${parts.join(", ")}.` : "O programa já tem tudo o que o template oferece." };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}
