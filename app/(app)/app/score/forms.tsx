"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { snapshotAction, updateWeightsAction, type ScoreState } from "./actions";

function Feedback({ state }: { state: ScoreState }) {
  if (!state) return null;
  return (
    <>
      {state.error && <div className="msg err">{state.error}</div>}
      {state.ok && <div className="msg ok">{state.ok}</div>}
    </>
  );
}

export function WeightsForm({ programId, weights, labels }: { programId: string; weights: Record<string, number>; labels: Record<string, string> }) {
  const [state, action] = useActionState(updateWeightsAction.bind(null, programId), undefined);
  return (
    <form action={action}>
      <div className="kgrid">
        {Object.keys(labels).map((k) => (
          <div key={k}><label htmlFor={`w-${k}`}>{labels[k]}</label><input id={`w-${k}`} name={k} inputMode="numeric" defaultValue={weights[k]} /></div>
        ))}
      </div>
      <Feedback state={state} />
      <SubmitButton className="btn sec">Salvar pesos</SubmitButton>
    </form>
  );
}

export function SnapshotButton({ programId }: { programId: string }) {
  const [state, action] = useActionState(snapshotAction.bind(null, programId), undefined);
  return (
    <form action={action}>
      <Feedback state={state} />
      <SubmitButton className="btn sec">Registrar o retrato desta semana</SubmitButton>
    </form>
  );
}
