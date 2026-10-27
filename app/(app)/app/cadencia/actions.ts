"use server";

import { revalidatePath } from "next/cache";
import { addProgramKpi, listKpis, saveCheckin, saveKpiEntries, updateProgramKpi } from "@/domains/cadence/service";
import { recordSnapshot } from "@/domains/score/service";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";

export type CadState = { error?: string; ok?: string } | undefined;
const s = (f: FormData, k: string) => String(f.get(k) ?? "");

async function guard(fn: () => Promise<unknown>, ok?: string): Promise<CadState> {
  try {
    await fn();
    return ok ? { ok } : undefined;
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

const num = (v: string): number | null => {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
};

/** Campos `kpi:<chave>`: vazio limpa o lançamento daquele KPI na semana. */
export async function saveKpisAction(programId: string, weekStart: string, _: CadState, f: FormData): Promise<CadState> {
  const actor = toContext(await requireUser());
  const values: Record<string, number | null> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("kpi:")) values[k.slice(4)] = num(String(v));
  const r = await guard(() => saveKpiEntries(actor, programId, weekStart, values), "KPIs da semana salvos.");
  revalidatePath("/app/cadencia");
  return r;
}

export async function saveCheckinAction(programId: string, weekStart: string, _: CadState, f: FormData): Promise<CadState> {
  const actor = toContext(await requireUser());
  const traffic = s(f, "traffic");
  const r = await guard(
    () => saveCheckin(actor, programId, weekStart, {
      plan: s(f, "plan"), done: s(f, "done"), result: s(f, "result"), adjust: s(f, "adjust"), objection: s(f, "objection"),
      bestContent: s(f, "bestContent"), blocker: s(f, "blocker"), traffic: traffic ? (traffic as "verde" | "amarelo" | "vermelho") : null,
    }),
    "Check-in salvo.",
  );
  if (!r) return r;
  if (!r.error) await recordSnapshot(actor, programId).catch(() => undefined); // atualiza o histórico do score
  revalidatePath("/app/cadencia");
  revalidatePath("/app/score");
  return r;
}

/** Campos `t:<chave>`: meta semanal (vazio = sem meta). Só grava o que mudou. */
export async function saveTargetsAction(programId: string, _: CadState, f: FormData): Promise<CadState> {
  const actor = toContext(await requireUser());
  const r = await guard(async () => {
    const current = await listKpis(programId);
    for (const k of current) {
      const raw = f.get(`t:${k.key}`);
      if (raw === null) continue;
      const v = num(String(raw));
      if (Number.isNaN(v)) throw new ValidationError(`Meta inválida em "${k.label}".`);
      if (v !== k.weeklyTarget) await updateProgramKpi(actor, programId, k.key, { weeklyTarget: v });
    }
  }, "Metas atualizadas.");
  revalidatePath("/app/cadencia");
  return r;
}

export async function addKpiAction(programId: string, _: CadState, f: FormData): Promise<CadState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => addProgramKpi(actor, programId, { key: s(f, "key"), label: s(f, "label"), grp: s(f, "grp"), weeklyTarget: num(s(f, "weeklyTarget")) }), "KPI acrescentado.");
  revalidatePath("/app/cadencia");
  return r;
}
