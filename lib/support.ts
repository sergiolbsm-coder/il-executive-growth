// Constantes dos chamados — seguro para importar em componentes de cliente.
export const TICKET_KINDS = {
  ajuda: "Preciso de ajuda",
  duvida: "Dúvida sobre como usar",
  problema: "Algo não está funcionando",
  sugestao: "Sugestão",
} as const;
export type TicketKind = keyof typeof TICKET_KINDS;

export const TICKET_STATUS = { aberto: "Aberto", em_andamento: "Em andamento", resolvido: "Resolvido" } as const;
export type TicketStatus = keyof typeof TICKET_STATUS;

/** Funcionalidades sobre as quais o mentorado pode pedir ajuda. `path` liga a tela de origem à área. */
export const TICKET_AREAS = {
  painel: { label: "Painel", path: "/app/dashboard" },
  score: { label: "Score de Alavancagem", path: "/app/score" },
  plano: { label: "Meu plano / programa", path: "/app/programas" },
  ofertas: { label: "Ofertas e estágios", path: "/app/ofertas" },
  escala: { label: "Escala do Negócio", path: "/app/escala" },
  conteudo: { label: "Conteúdo (links, atividades e assessments)", path: "/app/conteudo" },
  sessoes: { label: "Sessões e tarefas", path: "/app/sessoes" },
  ferramentas: { label: "Ferramentas", path: "/app/ferramentas" },
  portoes: { label: "Portões (critérios de estágio)", path: "/app/portoes" },
  acesso: { label: "Acesso / senha / e-mail", path: "/login" },
  outro: { label: "Outro assunto", path: "" },
} as const;
export type TicketArea = keyof typeof TICKET_AREAS;

export const isArea = (v: string): v is TicketArea => v in TICKET_AREAS;
export const isKind = (v: string): v is TicketKind => v in TICKET_KINDS;

/** Descobre a funcionalidade a partir da tela em que o mentorado estava. */
export function areaFromPath(path: string | null | undefined): TicketArea {
  if (!path) return "outro";
  for (const [k, a] of Object.entries(TICKET_AREAS)) if (a.path && (path === a.path || path.startsWith(a.path + "/"))) return k as TicketArea;
  if (path.startsWith("/app/mentorados")) return "plano";
  return "outro";
}
