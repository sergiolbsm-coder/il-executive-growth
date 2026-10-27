/** Os 7 estágios do ciclo de uma oferta (fixos). Os portões que levam a cada um são editáveis por template/programa. */
export const STAGES = [
  { n: 1, key: "ideia", name: "Ideia", phase: "Levantamento" },
  { n: 2, key: "prototipada", name: "Prototipada", phase: "Prototipação" },
  { n: 3, key: "oferta-pronta", name: "Oferta pronta", phase: "Prototipação" },
  { n: 4, key: "em-prospeccao", name: "Em prospecção", phase: "Lançamento" },
  { n: 5, key: "primeira-venda", name: "Primeira venda", phase: "Lançamento" },
  { n: 6, key: "validada", name: "Validada", phase: "Lançamento" },
  { n: 7, key: "escala", name: "Escala", phase: "Lançamento" },
] as const;

export const stageName = (n: number) => STAGES[n - 1]?.name ?? `Estágio ${n}`;
export const MIN_GATE_STAGE = 2;
export const MAX_GATE_STAGE = 7;
