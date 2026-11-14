import Link from "next/link";

export default function NotFound() {
  return (
    <div className="login">
      <div className="card" style={{ maxWidth: 440, textAlign: "center" }}>
        <h1>Página não encontrada</h1>
        <p className="sub">O endereço não existe ou você não tem acesso a ele. Confira o link ou volte para o início.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/app/dashboard" className="btn" style={{ marginTop: 0, textDecoration: "none" }}>Ir para o Painel</Link>
          <Link href="/login" className="btn sec">Entrar de novo</Link>
        </div>
      </div>
    </div>
  );
}
