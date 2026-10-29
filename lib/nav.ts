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
  { label: "Começar", icon: "🧰", href: "/app/ferramentas", roles: all, status: "ready" },
  { label: "Painel", icon: "📊", href: "/app/dashboard", roles: all, status: "ready" },
  { label: "Score de Alavancagem", icon: "🚀", href: "/app/score", roles: all, status: "ready" },
  { label: "Mentorados", icon: "👥", href: "/app/mentorados", roles: staff, status: "ready" },
  { label: "Meu plano", icon: "🧭", href: "/app/mentorados", roles: ["mentorado"], status: "ready" },
  { label: "Ofertas", icon: "🧩", href: "/app/ofertas", roles: all, status: "ready" },
  { label: "Escala do Negócio", icon: "🔺", href: "/app/escala", roles: all, status: "ready" },
  { label: "Conteúdo", icon: "✍️", href: "/app/conteudo", roles: all, status: "ready" },
  { label: "Sessões e tarefas", icon: "✅", href: "/app/sessoes", roles: all, status: "ready" },

  { label: "Pedir ajuda", icon: "🆘", href: "/app/chamados", roles: ["mentorado"], status: "ready" },
  { label: "Calculadora de precificação", icon: "🧮", href: "/app/calculadoras/precificacao", roles: all, status: "ready", group: "Ferramentas" },
  { label: "Calculadoras de RH", icon: "🧾", href: "/app/calculadoras/rh", roles: all, status: "ready", group: "Ferramentas" },

  { label: "Portões a confirmar", icon: "🚪", href: "/app/portoes", roles: staff, status: "ready", group: "Operação" },
  { label: "Chamados e dúvidas", icon: "🆘", href: "/app/chamados", roles: staff, status: "ready", group: "Operação" },
  { label: "Fila Venture", icon: "💡", href: "/app/venture", roles: staff, status: "soon", group: "Operação" },

  { label: "Usuários", icon: "🔑", href: "/admin/usuarios", roles: ["admin"], status: "ready", group: "Administração" },
  { label: "Templates", icon: "📐", href: "/admin/templates", roles: ["admin", "direcao"], status: "ready", group: "Administração" },
  { label: "Ferramentas (cadastro)", icon: "🛠️", href: "/admin/ferramentas", roles: ["admin"], status: "ready", group: "Administração" },
  { label: "Importações", icon: "📥", href: "/admin/importacoes", roles: ["admin"], status: "soon", group: "Administração" },
];

export const navFor = (role: UserRole) => NAV.filter((i) => i.roles.includes(role));
