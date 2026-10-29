"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Botão flutuante "Preciso de ajuda": abre o chamado já indicando a funcionalidade da tela atual. */
export function HelpButton() {
  const pathname = usePathname();
  if (pathname.startsWith("/app/chamados")) return null;
  return (
    <Link href={`/app/chamados/novo?from=${encodeURIComponent(pathname)}`} className="help-fab" title="Pedir ajuda com esta tela">
      ❓ <span>Preciso de ajuda</span>
    </Link>
  );
}
