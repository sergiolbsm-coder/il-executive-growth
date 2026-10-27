import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Mantido em sincronia com db/migrations/*.sql (fonte da verdade do DDL).

export const userRole = pgEnum("user_role", ["admin", "direcao", "mentor", "mentorado"]);
export type UserRole = (typeof userRole.enumValues)[number];

export const mentorScope = pgEnum("mentor_scope", ["all", "assigned"]);
export type MentorScope = (typeof mentorScope.enumValues)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  active: boolean("active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  mentorScope: mentorScope("mentor_scope").notNull().default("assigned"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type User = typeof users.$inferSelect;

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityLog = pgTable(
  "activity_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id").references(() => users.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_log_entity_idx").on(t.entityType, t.entityId)],
);

export const programTemplates = pgTable(
  "program_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    segment: text("segment").notNull().default("geral"),
    model: text("model").notNull().default("base"),
    version: integer("version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    scoreWeights: jsonb("score_weights").$type<Record<string, number> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.name, t.version)],
);

export const templateRevenueSources = pgTable(
  "template_revenue_sources",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    templateId: uuid("template_id").notNull().references(() => programTemplates.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    level: integer("level").notNull(),
    sort: integer("sort").notNull().default(0),
    role: text("role"),
    isMotor: boolean("is_motor").notNull().default(false),
  },
  (t) => [unique().on(t.templateId, t.slug)],
);

export const templatePyramidLevels = pgTable(
  "template_pyramid_levels",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    templateId: uuid("template_id").notNull().references(() => programTemplates.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    name: text("name").notNull(),
    volume: text("volume").notNull(),
    ticket: text("ticket").notNull(),
    effort: text("effort").notNull(),
    role: text("role").notNull(),
  },
  (t) => [unique().on(t.templateId, t.level)],
);

export const mentees = pgTable("mentees", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").unique().references(() => users.id),
  fullName: text("full_name").notNull(),
  email: text("email"),
  segment: text("segment"),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mentorAssignments = pgTable(
  "mentor_assignments",
  {
    menteeId: uuid("mentee_id").notNull().references(() => mentees.id, { onDelete: "cascade" }),
    mentorId: uuid("mentor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.menteeId, t.mentorId] }), index("mentor_assignments_mentor_idx").on(t.mentorId)],
);

export const programs = pgTable(
  "programs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    menteeId: uuid("mentee_id").notNull().references(() => mentees.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => programTemplates.id),
    templateVersion: integer("template_version"),
    name: text("name").notNull(),
    model: text("model"),
    purpose: text("purpose"),
    weeklyHours: integer("weekly_hours"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    status: text("status").notNull().default("ativo"),
    scoreWeights: jsonb("score_weights").$type<Record<string, number> | null>(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("programs_mentee_idx").on(t.menteeId)],
);

export const programRevenueSources = pgTable(
  "program_revenue_sources",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    level: integer("level").notNull(),
    sort: integer("sort").notNull().default(0),
    role: text("role"),
    isMotor: boolean("is_motor").notNull().default(false),
  },
  (t) => [unique().on(t.programId, t.slug)],
);

export const programPyramidLevels = pgTable(
  "program_pyramid_levels",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    name: text("name").notNull(),
    volume: text("volume").notNull(),
    ticket: text("ticket").notNull(),
    effort: text("effort").notNull(),
    role: text("role").notNull(),
  },
  (t) => [unique().on(t.programId, t.level)],
);

const gateColumns = {
  stage: integer("stage").notNull(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  kind: text("kind").$type<"manual" | "vendas">().notNull().default("manual"),
  threshold: integer("threshold"),
  required: boolean("required").notNull().default(true),
  sort: integer("sort").notNull().default(0),
};

export const templateGates = pgTable(
  "template_gates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    templateId: uuid("template_id").notNull().references(() => programTemplates.id, { onDelete: "cascade" }),
    ...gateColumns,
  },
  (t) => [unique().on(t.templateId, t.key)],
);

export const programGates = pgTable(
  "program_gates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    ...gateColumns,
  },
  (t) => [unique().on(t.programId, t.key)],
);

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    revenueSlug: text("revenue_slug").notNull(),
    name: text("name").notNull(),
    level: integer("level").notNull(),
    problem: text("problem").notNull(),
    audience: text("audience").notNull(),
    priceNote: text("price_note"),
    wave: integer("wave"),
    dueDate: date("due_date"),
    targetStage: integer("target_stage").notNull().default(3),
    status: text("status").$type<"ativa" | "pausada" | "descartada">().notNull().default("ativa"),
    statusReason: text("status_reason"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("offers_program_idx").on(t.programId)],
);
export type Offer = typeof offers.$inferSelect;

export const offerGateChecks = pgTable(
  "offer_gate_checks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    offerId: uuid("offer_id").notNull().references(() => offers.id, { onDelete: "cascade" }),
    gateKey: text("gate_key").notNull(),
    evidence: text("evidence").notNull(),
    state: text("state").$type<"pendente" | "confirmado">().notNull(),
    checkedBy: uuid("checked_by").references(() => users.id),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.offerId, t.gateKey)],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    offerId: uuid("offer_id").notNull().references(() => offers.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    valueCents: bigint("value_cents", { mode: "number" }).notNull(),
    soldAt: date("sold_at").notNull(),
    channel: text("channel"),
    originOfferId: uuid("origin_offer_id").references(() => offers.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sales_offer_idx").on(t.offerId)],
);

export const mentoringSessions = pgTable(
  "mentoring_sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    heldOn: date("held_on").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    decisions: text("decisions"),
    internalNotes: text("internal_notes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mentoring_sessions_program_idx").on(t.programId, t.heldOn)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => mentoringSessions.id, { onDelete: "set null" }),
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    dueDate: date("due_date"),
    assignee: text("assignee").$type<"mentor" | "mentorado">().notNull().default("mentorado"),
    status: text("status").$type<"aberta" | "concluida" | "cancelada">().notNull().default("aberta"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tasks_program_idx").on(t.programId, t.status)],
);

const kpiColumns = {
  key: text("key").notNull(),
  label: text("label").notNull(),
  grp: text("grp").notNull().default("Prospecção"),
  weeklyTarget: numeric("weekly_target", { precision: 10, scale: 2, mode: "number" }),
  sort: integer("sort").notNull().default(0),
};

export const templateKpis = pgTable(
  "template_kpis",
  { id: uuid("id").primaryKey().default(sql`gen_random_uuid()`), templateId: uuid("template_id").notNull().references(() => programTemplates.id, { onDelete: "cascade" }), ...kpiColumns },
  (t) => [unique().on(t.templateId, t.key)],
);

export const programKpis = pgTable(
  "program_kpis",
  { id: uuid("id").primaryKey().default(sql`gen_random_uuid()`), programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }), ...kpiColumns },
  (t) => [unique().on(t.programId, t.key)],
);

export const kpiEntries = pgTable(
  "kpi_entries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    kpiKey: text("kpi_key").notNull(),
    actual: numeric("actual", { precision: 12, scale: 2, mode: "number" }).notNull(),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.programId, t.weekStart, t.kpiKey)],
);

export const weeklyCheckins = pgTable(
  "weekly_checkins",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    plan: text("plan"),
    done: text("done"),
    result: text("result"),
    adjust: text("adjust"),
    objection: text("objection"),
    bestContent: text("best_content"),
    blocker: text("blocker"),
    traffic: text("traffic").$type<"verde" | "amarelo" | "vermelho">(),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.programId, t.weekStart)],
);

export type ToolField = { key: string; label: string; type: "text" | "textarea" | "number" | "url" | "select" | "checklist"; required?: boolean; options?: string[]; help?: string };

export const tools = pgTable("tools", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  phase: text("phase").$type<"levantamento" | "prototipacao" | "lancamento" | "transversal">().notNull(),
  kind: text("kind").$type<"declarativa" | "externa">().notNull(),
  description: text("description"),
  fields: jsonb("fields").$type<ToolField[]>().notNull().default(sql`'[]'::jsonb`),
  externalUrl: text("external_url"),
  strategic: boolean("strategic").notNull().default(false),
  weight: integer("weight").notNull().default(1),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Tool = typeof tools.$inferSelect;

export const toolGateLinks = pgTable(
  "tool_gate_links",
  { toolSlug: text("tool_slug").notNull().references(() => tools.slug, { onDelete: "cascade", onUpdate: "cascade" }), gateKey: text("gate_key").notNull() },
  (t) => [primaryKey({ columns: [t.toolSlug, t.gateKey] })],
);

export const templateTools = pgTable(
  "template_tools",
  {
    templateId: uuid("template_id").notNull().references(() => programTemplates.id, { onDelete: "cascade" }),
    toolSlug: text("tool_slug").notNull().references(() => tools.slug, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.templateId, t.toolSlug] })],
);

export const programTools = pgTable(
  "program_tools",
  {
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    toolSlug: text("tool_slug").notNull().references(() => tools.slug, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.programId, t.toolSlug] })],
);

export const toolEntries = pgTable(
  "tool_entries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    toolSlug: text("tool_slug").notNull().references(() => tools.slug, { onUpdate: "cascade" }),
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "cascade" }),
    title: text("title"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    status: text("status").$type<"rascunho" | "concluida">().notNull().default("rascunho"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    updatedBy: uuid("updated_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tool_entries_program_idx").on(t.programId, t.toolSlug)],
);

export const scoreSnapshots = pgTable(
  "score_snapshots",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    total: numeric("total", { precision: 5, scale: 1, mode: "number" }).notNull(),
    components: jsonb("components").$type<Record<string, number>>().notNull(),
    weights: jsonb("weights").$type<Record<string, number>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.programId, t.weekStart)],
);
