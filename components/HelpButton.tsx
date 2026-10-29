"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { quickTicketAction } from "@/app/(app)/app/chamados/actions";
import { SubmitButton } from "@/components/ui";
import { TICKET_AREAS, TICKET_KINDS, areaFromPath } from "@/lib/support";

/**
 * Botão flutuante "Preciso de ajuda": abre um pop-up sobre a tela atual, já com a funcionalidade escolhida,
 * para o mentorado descrever a dúvida na hora (sem sair da tela e esquecer o que queria perguntar).
 */
export function HelpButton() {
  const pathname = usePathname();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(quickTicketAction, undefined);
  const [round, setRound] = useState(0); // zera o formulário ao abrir outro chamado

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (pathname.startsWith("/app/chamados")) return null;
  const close = () => {
    setOpen(false);
    if (state?.created) setRound((r) => r + 1);
  };

  return (
    <>
      <button type="button" className="help-fab" onClick={() => setOpen(true)} title="Pedir ajuda com esta tela">
        ❓ <span>Preciso de ajuda</span>
      </button>
      <dialog ref={ref} className="help-dialog" onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && close()}>
        {state?.created ? (
          <div>
            <h2 className="h2">✅ Chamado #{state.created.number} enviado</h2>
            <p className="sub">A equipe vai responder por aqui e por e-mail. Você pode continuar de onde parou.</p>
            <div className="row">
              <button type="button" className="btn" onClick={close}>Voltar para a tela</button>
              <Link href={`/app/chamados/${state.created.id}`} className="btn sec" onClick={() => setOpen(false)}>Ver o chamado</Link>
            </div>
          </div>
        ) : (
          <form action={action} key={round}>
            <h2 className="h2">Preciso de ajuda</h2>
            <p className="sub" style={{ marginTop: 0 }}>Anote agora, sem sair da tela: a equipe recebe também a página em que você estava.</p>
            <input type="hidden" name="pagePath" value={pathname} />
            <label htmlFor="help-area">Sobre qual funcionalidade?</label>
            <select id="help-area" name="area" defaultValue={areaFromPath(pathname)}>
              {Object.entries(TICKET_AREAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <label htmlFor="help-kind">O que você precisa?</label>
            <select id="help-kind" name="kind" defaultValue="duvida">
              {Object.entries(TICKET_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label htmlFor="help-title">Assunto (resumo em uma frase)</label>
            <input id="help-title" name="title" maxLength={160} required placeholder="Ex.: não sei como marcar o portão" />
            <label htmlFor="help-desc">Detalhes — descreva ou cole aqui a mensagem que apareceu</label>
            <textarea id="help-desc" name="description" rows={5} maxLength={4000} />
            {state?.error && <div className="msg err">{state.error}</div>}
            <div className="row" style={{ marginTop: 12 }}>
              <SubmitButton pendingLabel="Enviando…">Enviar chamado</SubmitButton>
              <button type="button" className="btn sec" onClick={close}>Cancelar</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
