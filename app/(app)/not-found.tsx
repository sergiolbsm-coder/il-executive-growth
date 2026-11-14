import Link from "next/link";

export default function AppNotFound() {
  return (
    <>
      <h1>Não encontramos esta página</h1>
      <p className="sub">O item pode ter sido removido, ou você não tem acesso a ele.</p>
      <div className="card">
        <div className="row">
          <Link href="/app/dashboard" className="btn" style={{ marginTop: 0, textDecoration: "none" }}>Ir para o Painel</Link>
          <Link href="/app/ofertas" className="btn sec">Ver ofertas</Link>
        </div>
      </div>
    </>
  );
}
