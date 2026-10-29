"use server";

import { revalidatePath } from "next/cache";
import { addAxis, addExampleAxes, addLink, createItem, removeAxis, removeLink, syncKpisFromContent, updateAxis, updateItem, updateLink } from "@/domains/content/service";
import type { ContentStatus } from "@/domains/content/summary";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";

export type ContentState = { error?: string; ok?: string } | undefined;
const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const optInt = (v: string): number | null => (v.trim() === "" ? null : Number(v));

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

export async function createItemAction(programId: string, _: ContentState, f: FormData): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => createItem(actor, programId, {
    weekStart: s(f, "weekStart"), channel: s(f, "channel"), title: s(f, "title"), thesis: s(f, "thesis"),
    axisId: s(f, "axisId") || null, offerId: s(f, "offerId") || null, status: (s(f, "status") || "ideia") as ContentStatus,
  }), "Publicação adicionada ao calendário.");
}

export async function updateItemAction(itemId: string, _: ContentState, f: FormData): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => updateItem(actor, itemId, {
    weekStart: s(f, "weekStart"), channel: s(f, "channel"), title: s(f, "title"), thesis: s(f, "thesis"),
    axisId: s(f, "axisId") || null, offerId: s(f, "offerId") || null, status: s(f, "status") as ContentStatus,
    publishUrl: s(f, "publishUrl"), publishedOn: s(f, "publishedOn") || null, engagement: optInt(s(f, "engagement")), leads: optInt(s(f, "leads")),
  }), "Publicação atualizada.");
}

export async function setItemStatusAction(itemId: string, status: ContentStatus): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => updateItem(actor, itemId, { status }));
}

export async function syncKpisAction(programId: string, weekStart: string): Promise<ContentState> {
  const actor = toContext(await requireUser());
  let msg = "";
  const r = await guard(async () => {
    const v = await syncKpisFromContent(actor, programId, weekStart);
    msg = Object.entries(v).map(([k, n]) => `${k === "posts-linkedin" ? "posts de LinkedIn" : "artigos/newsletter"}: ${n}`).join(" · ");
  });
  if (r?.error) return r;
  return { ok: `KPIs da semana atualizados — ${msg}.` };
}

export async function addAxisAction(programId: string, _: ContentState, f: FormData): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => addAxis(actor, programId, { name: s(f, "name"), description: s(f, "description") }), "Eixo criado.");
}

export async function renameAxisAction(axisId: string, _: ContentState, f: FormData): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => updateAxis(actor, axisId, { name: s(f, "name"), description: s(f, "description") }), "Eixo atualizado.");
}

export async function removeAxisAction(axisId: string): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => removeAxis(actor, axisId));
}

export async function exampleAxesAction(programId: string): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => addExampleAxes(actor, programId), "Eixos de exemplo criados. Renomeie e ajuste ao seu posicionamento.");
}

export async function addLinkAction(programId: string, _: ContentState, f: FormData): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => addLink(actor, programId, { title: s(f, "title"), url: s(f, "url"), category: s(f, "category"), description: s(f, "description"), pinned: f.get("pinned") === "on" }), "Link adicionado.");
}

export async function updateLinkAction(linkId: string, _: ContentState, f: FormData): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => updateLink(actor, linkId, { title: s(f, "title"), url: s(f, "url"), category: s(f, "category"), description: s(f, "description"), pinned: f.get("pinned") === "on" }), "Link atualizado.");
}

export async function togglePinAction(linkId: string, pinned: boolean): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => updateLink(actor, linkId, { pinned }));
}

export async function removeLinkAction(linkId: string): Promise<ContentState> {
  const actor = toContext(await requireUser());
  return guard(() => removeLink(actor, linkId));
}
