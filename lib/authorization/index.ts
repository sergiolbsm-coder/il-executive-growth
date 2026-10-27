import type { MentorScope, UserRole } from "@/lib/db/schema";

/** Contexto do usuário autenticado, derivado da sessão no servidor. */
export interface AuthContext {
  userId: string;
  role: UserRole;
  /** Só vale para mentor: "all" vê toda a carteira; "assigned" só os atribuídos. */
  mentorScope?: MentorScope;
}

export class ForbiddenError extends Error {
  constructor(message = "Acesso negado.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function requireRole(ctx: AuthContext, ...roles: UserRole[]): void {
  if (!roles.includes(ctx.role)) throw new ForbiddenError();
}

export const isStaff = (ctx: AuthContext) => ctx.role !== "mentorado";

/** Gerir usuários (criar, redefinir senha, ativar/desativar, escopo de mentor). */
export const canManageUsers = (ctx: AuthContext) => ctx.role === "admin";

/** Editar templates (catálogo, pirâmide, portões): administração e direção. */
export const canManageTemplates = (ctx: AuthContext) => ctx.role === "admin" || ctx.role === "direcao";

/** Cadastrar mentorados, atribuir mentores e abrir programas. */
export const canCreateMentee = (ctx: AuthContext) => ctx.role === "admin" || ctx.role === "direcao";

export interface MenteeRef {
  userId: string | null;
  mentorIds: string[];
}

/** Carteira inteira: admin, direção e mentor com escopo "todos". Mentor "atribuídos": só os dele. Mentorado: só o próprio. */
export function canViewMentee(ctx: AuthContext, mentee: MenteeRef): boolean {
  if (ctx.role === "admin" || ctx.role === "direcao") return true;
  if (ctx.role === "mentor") return ctx.mentorScope === "all" || mentee.mentorIds.includes(ctx.userId);
  return mentee.userId !== null && mentee.userId === ctx.userId;
}

/** Editar programa (propósito, horas, catálogo e pirâmide do programa): equipe com acesso ao mentorado. Mentorado não edita o plano. */
export const canEditProgram = (ctx: AuthContext, mentee: MenteeRef) => isStaff(ctx) && canViewMentee(ctx, mentee);

/** Notas internas e autoria nunca vão ao mentorado. */
export const canViewInternalFields = (ctx: AuthContext) => isStaff(ctx);

/** Remover registros: somente administração. */
export const canDeleteRecords = (ctx: AuthContext) => ctx.role === "admin";
