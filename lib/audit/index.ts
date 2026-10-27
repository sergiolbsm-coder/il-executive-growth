import { getDb, schema } from "@/lib/db";

export async function audit(entry: {
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}) {
  const db = await getDb();
  await db.insert(schema.activityLog).values({
    actorId: entry.actorId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    beforeJson: entry.before ?? null,
    afterJson: entry.after ?? null,
  });
}
