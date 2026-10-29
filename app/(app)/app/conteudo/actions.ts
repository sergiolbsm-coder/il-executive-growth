"use server";

import { revalidatePath } from "next/cache";
import { addLink, removeLink, setLinkDone, updateLink } from "@/domains/content/service";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";

export type ContentState = { error?: string; ok?: string } | undefined;
const s = (f: FormData, k: string) => String(f.get(k) ?? "");

async function guard(fn: () => Promise<unknown>, ok?: string): Promise<ContentState> {
  try {
    await fn();
    revalidatePath("/app/conteudo");
    return ok ? { ok } : undefined;
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

export async function addLinkAction(programId: string, _: ContentState, f: FormData): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => addLink(actor, programId, { title: s(f, "title"), url: s(f, "url"), category: s(f, "category"), description: s(f, "description") }), "Link adicionado.");
}

export async function updateLinkAction(linkId: string, _: ContentState, f: FormData): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => updateLink(actor, linkId, { title: s(f, "title"), url: s(f, "url"), category: s(f, "category"), description: s(f, "description") }), "Link atualizado.");
}

export async function setDoneAction(linkId: string, done: boolean): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => setLinkDone(actor, linkId, done));
}

export async function removeLinkAction(linkId: string): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => removeLink(actor, linkId));
}
