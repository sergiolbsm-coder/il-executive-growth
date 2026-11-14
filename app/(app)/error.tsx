"use client";

import Link from "next/link";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <h1>Algo deu errado</h1>
      <p className="sub">Não foi possível carregar esta tela. Seus dados não foram alterados.</p>
      <div className="card" role="alert">
        <div className="row">
          <button type="button" className="btn" style={{ marginTop: 0 }} onClick={reset}>Tentar de novo</button>
          <Link href="/app/dashboard" className="btn sec">Ir para o Painel</Link>
        </div>
        <p className="sub" style={{ margin: "12px 0 0" }}>Se continuar, use “Preciso de ajuda” ou avise o seu mentor.</p>
      </div>
    </>
  );
}
