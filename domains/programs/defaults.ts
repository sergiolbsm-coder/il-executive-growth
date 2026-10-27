import { eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { type AuthContext, ForbiddenError, canEditProgram } from "@/lib/authorization";
import { getDb, schema } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { toRef } from "@/domains/mentees/service";
import { loadProgram } from "./service";

/**
 * Completa o programa com o que o template dele tem e o programa ainda não tem (portões, KPIs, ferramentas, pesos do score).
 * Não altera nem remove nada que o programa já tenha. Útil para programas abertos antes de uma funcionalidade existir.
 */
export async function loadTemplateDefaults(actor: AuthContext, programId: string) {
  const { program, mentee } = await loadProgram(programId);
  if (!canEditProgram(actor, toRef(mentee))) throw new ForbiddenError();
  if (!program.templateId) throw new ValidationError("Este programa não tem template de origem.");
  const db = await getDb();
  const tid = program.templateId;
  const added = { gates: 0, kpis: 0, tools: 0, weights: false };
  await db.transaction(async (tx) => {
    const [tg, pg, tk, pk, tt, pt, [tpl]] = await Promise.all([
      tx.select().from(schema.templateGates).where(eq(schema.templateGates.templateId, tid)),
      tx.select().from(schema.programGates).where(eq(schema.programGates.programId, programId)),
      tx.select().from(schema.templateKpis).where(eq(schema.templateKpis.templateId, tid)),
      tx.select().from(schema.programKpis).where(eq(schema.programKpis.programId, programId)),
      tx.select().from(schema.templateTools).where(eq(schema.templateTools.templateId, tid)),
      tx.select().from(schema.programTools).where(eq(schema.programTools.programId, programId)),
      tx.select().from(schema.programTemplates).where(eq(schema.programTemplates.id, tid)).limit(1),
    ]);
    const gHave = new Set(pg.map((x) => x.key));
    const gNew = tg.filter((g) => !gHave.has(g.key));
    if (gNew.length) await tx.insert(schema.programGates).values(gNew.map((g) => ({ programId, stage: g.stage, key: g.key, label: g.label, kind: g.kind, threshold: g.threshold, required: g.required, sort: g.sort })));
    added.gates = gNew.length;
    const kHave = new Set(pk.map((x) => x.key));
    const kNew = tk.filter((k) => !kHave.has(k.key));
    if (kNew.length) await tx.insert(schema.programKpis).values(kNew.map((k) => ({ programId, key: k.key, label: k.label, grp: k.grp, weeklyTarget: k.weeklyTarget, sort: k.sort })));
    added.kpis = kNew.length;
    const tHave = new Set(pt.map((x) => x.toolSlug));
    const tNew = tt.filter((x) => !tHave.has(x.toolSlug));
    if (tNew.length) await tx.insert(schema.programTools).values(tNew.map((x) => ({ programId, toolSlug: x.toolSlug })));
    added.tools = tNew.length;
    if (!program.scoreWeights && tpl?.scoreWeights) {
      await tx.update(schema.programs).set({ scoreWeights: tpl.scoreWeights }).where(eq(schema.programs.id, programId));
      added.weights = true;
    }
  });
  await audit({ actorId: actor.userId, entityType: "program", entityId: programId, action: "program.load_defaults", after: added });
  return added;
}
