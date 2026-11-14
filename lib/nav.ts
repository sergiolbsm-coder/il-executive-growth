import type { UserRole } from "@/lib/db/schema";

export interface NavItem {
  label: string;
  icon: string;
  href: string;
  roles: UserRole[];
  /** `soon` = funcionalidade prevista no roadmap, exibida desabilitada. */
  status: "ready" | "soon";
  group?: "Ferramentas" | "Operação" | "Administração";
}

const staff: UserRole[] = ["admin", "direcao", "mentor"];
const all: UserRole[] = ["admin", "direcao", "mentor", "mentorado"];

// Novos painéis e ferramentas entram aqui: basta adicionar o item (e a rota).
export const NAV: NavItem[] = [
  { label: "Começar", icon: "start", href: "/app/ferramentas", roles: all, status: "ready" },
  { label: "Painel", icon: "dashboard", href: "/app/dashboard", roles: all, status: "ready" },
  { label: "Score de Alavancagem", icon: "score", href: "/app/score", roles: all, status: "ready" },
  { label: "Mentorados", icon: "users", href: "/app/mentorados", roles: staff, status: "ready" },
  { label: "Meu plano", icon: "plan", href: "/app/mentorados", roles: ["mentorado"], status: "ready" },
  { label: "Ofertas", icon: "offers", href: "/app/ofertas", roles: all, status: "ready" },
  { label: "Estratégia de vendas", icon: "strategy", href: "/app/estrategia", roles: all, status: "ready" },
  { label: "Escala do Negócio", icon: "scale", href: "/app/escala", roles: all, status: "ready" },
  { label: "Conteúdo", icon: "content", href: "/app/conteudo", roles: all, status: "ready" },
  { label: "Sessões e tarefas", icon: "sessions", href: "/app/sessoes", roles: all, status: "ready" },

  { label: "Pedir ajuda", icon: "chat", href: "/app/chamados", roles: ["mentorado"], status: "ready" },
  { label: "Calculadora de precificação", icon: "calc", href: "/app/calculadoras/precificacao", roles: all, status: "ready", group: "Ferramentas" },
  { label: "Calculadoras de RH", icon: "receipt", href: "/app/calculadoras/rh", roles: all, status: "ready", group: "Ferramentas" },

  { label: "Itens a confirmar", icon: "confirm", href: "/app/portoes", roles: staff, status: "ready", group: "Operação" },
  { label: "Chamados e dúvidas", icon: "chat", href: "/app/chamados", roles: staff, status: "ready", group: "Operação" },
  { label: "Fila Venture", icon: "dashboard", href: "/app/venture", roles: staff, status: "soon", group: "Operação" },

  { label: "Usuários", icon: "key", href: "/admin/usuarios", roles: ["admin"], status: "ready", group: "Administração" },
  { label: "Templates", icon: "template", href: "/admin/templates", roles: ["admin", "direcao"], status: "ready", group: "Administração" },
  { label: "Ferramentas (cadastro)", icon: "tools", href: "/admin/ferramentas", roles: ["admin"], status: "ready", group: "Administração" },
  { label: "Importações", icon: "content", href: "/admin/importacoes", roles: ["admin"], status: "soon", group: "Administração" },
];

/** Itens "em breve" ficam fora do menu: o usuário não precisa ver o roadmap interno. */
export const navFor = (role: UserRole) => NAV.filter((i) => i.roles.includes(role) && i.status === "ready");
