"use client";

import { useState, useTransition } from "react";
import { SaveState } from "@/components/ui";
import { confirmGateAction, uncheckGateAction, type OfferState } from "../ofertas/actions";

/** Confirmar (ou devolver) um item que o mentorado marcou. */
export function ConfirmButtons({ offerId, gateKey }: { offerId: string; gateKey: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<OfferState>();
  const run = (fn: () => Promise<OfferState>) => start(async () => setRes(await fn()));
  return (
    <div className="row">
      <button className="btn sec" disabled={pending} onClick={() => run(() => confirmGateAction(offerId, gateKey))}>Confirmar</button>
      <button className="btn sec" disabled={pending} onClick={() => confirm("Devolver este item ao mentorado (desmarcar)?") && run(() => uncheckGateAction(offerId, gateKey))}>Devolver</button>
      <SaveState pending={pending} error={res?.error} />
    </div>
  );
}
