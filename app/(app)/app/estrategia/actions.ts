"use server";

import { revalidatePath } from "next/cache";
import { addLesson, createCard, moveCard, removeCard, removeLesson, updateCard, updateLesson } from "@/domains/strategy/service";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";

export type StrategyState = { error?: string; ok?: string } | undefined;
const s = (f: FormData, k: string) => String(f.get(k) ?? "");

async function guard(fn: () => Promise<unknown>, ok?: string): Promise<StrategyState> {
  try {
    await fn();
    revalidatePath("/app/estrategia");
    return ok ? { ok } : undefined;
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

const fields = (f: FormData) => ({ kind: s(f, "kind"), title: s(f, "title"), description: s(f, "description"), approach: s(f, "approach"), objection: s(f, "objection"), materialUrl: s(f, "materialUrl"), priority: s(f, "priority") });

export async function createCardAction(offerId: string, _: StrategyState, f: FormData): Promise<StrategyState> {
  const actor = toContext(await requireUser());
  return guard(() => createCard(actor, offerId, { ...fields(f), stage: s(f, "stage") || "primeiro_contato" }), "Cartão adicionado.");
}

export async function updateCardAction(cardId: string, _: StrategyState, f: FormData): Promise<StrategyState> {
  const actor = toContext(await requireUser());
  return guard(() => updateCard(actor, cardId, fields(f)), "Cartão atualizado.");
}

export async function moveCardAction(cardId: string, stage: string): Promise<StrategyState> {
  const actor = toContext(await requireUser());
  return guard(() => moveCard(actor, cardId, stage));
}

export async function removeCardAction(cardId: string): Promise<StrategyState> {
  const actor = toContext(await requireUser());
  return guard(() => removeCard(actor, cardId));
}

export async function addLessonAction(cardId: string, _: StrategyState, f: FormData): Promise<StrategyState> {
  const actor = toContext(await requireUser());
  const q = s(f, "questionPick") === "__outra" ? s(f, "questionCustom") : s(f, "questionPick");
  return guard(() => addLesson(actor, cardId, { question: q, answer: s(f, "answer") }), "Lição registrada.");
}

export async function updateLessonAction(lessonId: string, _: StrategyState, f: FormData): Promise<StrategyState> {
  const actor = toContext(await requireUser());
  return guard(() => updateLesson(actor, lessonId, { question: s(f, "question"), answer: s(f, "answer") }), "Lição atualizada.");
}

export async function removeLessonAction(lessonId: string): Promise<StrategyState> {
  const actor = toContext(await requireUser());
  return guard(() => removeLesson(actor, lessonId));
}
