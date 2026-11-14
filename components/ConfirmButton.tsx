"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Botão que pede confirmação num pop-up do próprio app (no lugar da caixa `confirm()` do navegador):
 * diz o que vai acontecer, tem botão de cancelar e foca o "Cancelar" ao abrir, para evitar toque acidental.
 */
export function ConfirmButton({
  message, confirmLabel, onConfirm, children, className = "btn sec", style, disabled, title = "Confirmar ação",
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  title?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <button type="button" className={className} style={style} disabled={disabled} onClick={() => setOpen(true)}>{children}</button>
      <dialog ref={ref} className="confirm-dialog" aria-labelledby="cd-title" onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && setOpen(false)}>
        <h3 id="cd-title">{title}</h3>
        <p>{message}</p>
        <div className="row">
          <button type="button" className="btn sec" autoFocus onClick={() => setOpen(false)}>Cancelar</button>
          <button type="button" className="btn" style={{ marginTop: 0 }} onClick={() => { setOpen(false); onConfirm(); }}>{confirmLabel}</button>
        </div>
      </dialog>
    </>
  );
}
