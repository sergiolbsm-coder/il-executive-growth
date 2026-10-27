"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveTool, setTemplateTools } from "@/domains/tools/service";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";

export type AdminToolState = { error?: string; ok?: string } | undefined;
const s = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function saveToolAction(_: AdminToolState, f: FormData): Promise<AdminToolState> {
  const actor = toContext(await requireUser());
  const kind = s(f, "kind") === "externa" ? "externa" : "declarativa";
  let fields: unknown = undefined;
  if (kind === "declarativa") {
    try {
      fields = JSON.parse(s(f, "fields") || "[]");
    } catch {
      return { error: "Os campos não estão em JSON válido. Confira vírgulas, aspas e colchetes." };
    }
  }
  const slug = s(f, "slug").trim();
  try {
    await saveTool(actor, {
      slug, name: s(f, "name"), phase: s(f, "phase") as "levantamento", kind, description: s(f, "description"), fields,
      externalUrl: s(f, "externalUrl"), strategic: f.get("strategic") === "on", weight: Number(s(f, "weight") || 1), active: f.get("active") === "on",
      gateKeys: s(f, "gateKeys").split(/[,\s]+/).filter(Boolean),
    });
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/ferramentas");
  redirect(`/admin/ferramentas?t=${slug}&saved=1`);
}

export async function setTemplateToolsAction(templateId: string, _: AdminToolState, f: FormData): Promise<AdminToolState> {
  const actor = toContext(await requireUser());
  try {
    await setTemplateTools(actor, templateId, f.getAll("tools").map(String));
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/ferramentas");
  return { ok: "Ferramentas do template atualizadas (valem para programas novos)." };
}
