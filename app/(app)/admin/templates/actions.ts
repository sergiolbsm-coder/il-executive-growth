"use server";

import { revalidatePath } from "next/cache";
import { updateTemplate } from "@/domains/templates/service";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";

export type TemplateState = { error?: string; ok?: string } | undefined;

export async function updateTemplateAction(templateId: string, _: TemplateState, form: FormData): Promise<TemplateState> {
  const actor = toContext(await requireUser());
  try {
    await updateTemplate(actor, templateId, {
      name: String(form.get("name") ?? ""),
      segment: String(form.get("segment") ?? ""),
      model: String(form.get("model") ?? ""),
      notes: String(form.get("notes") ?? ""),
    });
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/templates");
  return { ok: "Template atualizado. Programas já criados não mudam." };
}
