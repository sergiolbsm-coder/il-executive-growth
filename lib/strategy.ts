// Constantes do quadro de estratégia de vendas — seguro para importar em componentes de cliente.
export const FUNNEL_STAGES = [
  { key: "primeiro_contato", label: "Primeiro contato", hint: "Como abordar e chamar a atenção desse público." },
  { key: "apresentacao", label: "Apresentação", hint: "O que mostrar e qual argumento usar." },
  { key: "fechamento", label: "Fechamento", hint: "Como propor, negociar e fechar." },
  { key: "aquecimento", label: "Aquecimento", hint: "Como manter o interesse de quem ainda não decidiu." },
  { key: "perdido", label: "Perdido", hint: "Perfis que não compraram — registre o motivo." },
  { key: "concluido", label: "Concluído", hint: "Perfis que já compraram ou estratégias encerradas." },
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number]["key"];

export const CARD_KINDS = { cliente: "Tipo de cliente", demanda: "Tipo de demanda" } as const;
export type CardKind = keyof typeof CARD_KINDS;

export const PRIORITIES = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;
export type Priority = keyof typeof PRIORITIES;

export const isStage = (v: string): v is FunnelStage => FUNNEL_STAGES.some((s) => s.key === v);
export const isCardKind = (v: string): v is CardKind => v in CARD_KINDS;
export const isPriority = (v: string): v is Priority => v in PRIORITIES;

/** Colunas em que o cartão recebe lições aprendidas. */
export const LESSON_STAGES: readonly FunnelStage[] = ["perdido", "concluido"];
export const canHaveLessons = (stage: string) => (LESSON_STAGES as readonly string[]).includes(stage);

/** Perguntas sugeridas (o usuário pode escolher uma ou escrever a própria). */
export const LESSON_QUESTIONS: Record<"perdido" | "concluido", string[]> = {
  perdido: [
    "Por que não fechou? (motivo principal)",
    "Em que etapa do funil perdemos o interesse?",
    "Qual objeção real apareceu (e não conseguimos contornar)?",
    "O que faríamos diferente numa próxima abordagem?",
    "Esse perfil ainda vale a pena? Em que condição voltamos a procurá-lo?",
  ],
  concluido: [
    "O que fez o cliente fechar?",
    "Qual argumento ou material foi decisivo?",
    "Quanto tempo levou do primeiro contato ao fechamento?",
    "Que objeção apareceu e como foi respondida?",
    "O que vale repetir com outros clientes desse perfil?",
  ],
};
