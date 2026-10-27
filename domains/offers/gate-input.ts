import { ValidationError } from "@/lib/errors";
import { MAX_GATE_STAGE, MIN_GATE_STAGE } from "@/lib/stages";

const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface GatePatch {
  label?: string;
  stage?: number;
  required?: boolean;
  threshold?: number | null;
}

export interface NewGate {
  key: string;
  label: string;
  stage: number;
  kind?: "manual" | "vendas";
  threshold?: number | null;
  required?: boolean;
}

const isStage = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= MIN_GATE_STAGE && (n as number) <= MAX_GATE_STAGE;
const isThreshold = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1;

/** Valida e normaliza a edição de um portão existente. `kind` é o do portão (não muda): vendas exige limiar. */
export function cleanGatePatch(patch: GatePatch, kind: "manual" | "vendas") {
  const out: GatePatch = {};
  if (patch.label !== undefined) {
    const l = patch.label.trim();
    if (!l) throw new ValidationError("O rótulo do portão não pode ficar vazio.");
    out.label = l;
  }
  if (patch.stage !== undefined) {
    if (!isStage(patch.stage)) throw new ValidationError("O estágio do portão deve ser de 2 a 7.");
    out.stage = patch.stage;
  }
  if (patch.required !== undefined) out.required = !!patch.required;
  if (patch.threshold !== undefined) {
    if (patch.threshold === null) {
      if (kind === "vendas") throw new ValidationError("Portão de vendas exige um número mínimo.");
      out.threshold = null;
    } else {
      if (!isThreshold(patch.threshold)) throw new ValidationError("O mínimo deve ser um número inteiro maior que zero.");
      if (kind === "manual") throw new ValidationError("Só portões de vendas têm número mínimo.");
      out.threshold = patch.threshold;
    }
  }
  return out;
}

/** Valida um portão novo (identificador, rótulo, estágio e, se for de vendas, o mínimo). */
export function cleanNewGate(g: NewGate) {
  if (!KEY.test(g.key)) throw new ValidationError("Identificador inválido (use minúsculas, números e hífen).");
  const label = g.label.trim();
  if (!label) throw new ValidationError("Informe o rótulo do portão.");
  if (!isStage(g.stage)) throw new ValidationError("O estágio do portão deve ser de 2 a 7.");
  const kind = g.kind ?? "manual";
  if (kind === "vendas" && !isThreshold(g.threshold)) throw new ValidationError("Portão de vendas exige um número mínimo (inteiro maior que zero).");
  if (kind === "manual" && g.threshold != null) throw new ValidationError("Só portões de vendas têm número mínimo.");
  return { key: g.key, label, stage: g.stage, kind, threshold: kind === "vendas" ? g.threshold! : null, required: g.required ?? true };
}
