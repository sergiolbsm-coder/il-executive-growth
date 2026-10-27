"use server";

import { revalidatePath } from "next/cache";
import { recordSnapshot, updateScoreWeights } from "@/domains/score/service";
import { SCORE_KEYS } from "@/domains/score/compute";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";

export type ScoreState = { error?: string; ok?: string } | undefined;

async function guard(fn: () => Promise<unknown>, ok: string): Promise<ScoreState> {
  try {
    await fn();
    return { ok };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

export async function updateWeightsAction(programId: string, _: ScoreState, f: FormData): Promise<ScoreState> {
  const actor = toContext(await requireUser());
  const w: Record<string, number> = {};
  for (const k of SCORE_KEYS) w[k] = Number(String(f.get(k) ?? "0").replace(",", "."));
  const r = await guard(() => updateScoreWeights(actor, programId, w), "Pesos atualizados (normalizados para somar 100).");
  revalidatePath("/app/score");
  return r;
}

export async function snapshotAction(programId: string, _: ScoreState): Promise<ScoreState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => recordSnapshot(actor, programId), "Retrato da semana registrado.");
  revalidatePath("/app/score");
  return r;
}
