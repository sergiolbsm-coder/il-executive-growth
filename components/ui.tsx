"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden />;
}

/**
 * Botão de envio com feedback: mostra spinner + rótulo "Salvando…" e uma barra de progresso enquanto a
 * ação do servidor roda, e fica desabilitado para evitar clique duplo. Use dentro de <form action={…}>.
 */
export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
  className = "btn",
  name,
  value,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending, data } = useFormStatus();
  // com vários botões de envio no mesmo formulário, só o clicado mostra o progresso
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <span className="submit-wrap">
      <button className={className} name={name} value={value} disabled={pending || disabled} aria-busy={mine}>
        {mine ? (
          <>
            <Spinner /> {pendingLabel}
          </>
        ) : (
          children
        )}
      </button>
      {mine && <span className="progress" role="progressbar" aria-label={pendingLabel} />}
    </span>
  );
}

/** Indicador de estado de uma ação disparada por clique (useTransition): … → ✓ salvo (some) | ⚠ erro. */
export function SaveState({ pending, ok, error }: { pending: boolean; ok?: string; error?: string }) {
  const [showOk, setShowOk] = useState(false);
  useEffect(() => {
    if (!ok || pending) return;
    setShowOk(true);
    const t = setTimeout(() => setShowOk(false), 2500);
    return () => clearTimeout(t);
  }, [ok, pending]);
  if (pending) return <span className="state saving"><Spinner size={12} /> salvando…</span>;
  if (error) return <span className="state err-txt" title={error}>⚠ {error}</span>;
  if (showOk) return <span className="state saved">✓ salvo</span>;
  return null;
}
