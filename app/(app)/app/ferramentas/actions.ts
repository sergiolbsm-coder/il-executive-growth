"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createEntry, getEntry, reviewEntry, saveEntry } from "@/domains/tools/service";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";

export type ToolState = { error?: string; ok?: string; warnings?: string[] } | undefined;

export async function createEntryAction(programId: string, slug: string, _: ToolState, f: FormData): Promise<ToolState> {
  const actor = toContext(await requireUser());
  let id: string;
  try {
    id = (await createEntry(actor, programId, slug, { offerId: String(f.get("offerId") ?? "") || null, title: String(f.get("title") ?? "") })).id;
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
  redirect(`/app/ferramentas/entrada/${id}`);
}

/** Lê os campos da ferramenta (definidos no banco) a partir do formulário e salva como rascunho ou conclui. */
export async function saveEntryAction(entryId: string, _: ToolState, f: FormData): Promise<ToolState> {
  const actor = toContext(await requireUser());
  try {
    const { tool } = await getEntry(actor, entryId);
    const data: Record<string, unknown> = {};
    for (const fld of tool.fields) data[fld.key] = fld.type === "checklist" ? f.getAll(`f:${fld.key}`).map(String) : String(f.get(`f:${fld.key}`) ?? "");
    const conclude = String(f.get("intent")) === "conclude";
    const r = await saveEntry(actor, entryId, data, conclude);
    revalidatePath(`/app/ferramentas/entrada/${entryId}`);
    revalidatePath("/app/ferramentas");
    revalidatePath("/app/ofertas");
    revalidatePath("/app/portoes");
    if (!conclude) return { ok: "Rascunho salvo." };
    const gate = r.marked.length ? ` ${r.marked.length} item(ns) de portão comprovado(s) na oferta.` : "";
    return { ok: `Ferramenta concluída.${gate}`, warnings: r.warnings };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

export async function reviewEntryAction(entryId: string): Promise<ToolState> {
  const actor = toContext(await requireUser());
  try {
    const r = await reviewEntry(actor, entryId);
    revalidatePath(`/app/ferramentas/entrada/${entryId}`);
    revalidatePath("/app/ferramentas");
    revalidatePath("/app/ofertas");
    revalidatePath("/app/portoes");
    return { ok: r.confirmed.length ? `Revisada. ${r.confirmed.length} item(ns) de portão confirmado(s).` : "Revisada." };
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}
