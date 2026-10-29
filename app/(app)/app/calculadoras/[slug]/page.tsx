import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";

const CALCS: Record<string, { title: string; sub: string }> = {
  precificacao: { title: "Calculadora de precificação", sub: "Calcule o preço de uma oferta a partir de custos, margem e impostos." },
  rh: { title: "Calculadoras de RH", sub: "Rescisão, estágio, férias, 13º, folha, horas extras e documentos." },
};

export default async function CalculatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireUser();
  const c = CALCS[slug];
  if (!c) notFound();
  return (
    <>
      <h1>{c.title}</h1>
      <p className="sub">{c.sub}</p>
      <iframe
        src={`/api/calculadoras/${slug}`}
        title={c.title}
        sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-forms"
        style={{ width: "100%", height: "calc(100vh - 170px)", minHeight: 560, border: "1px solid var(--idl-border)", borderRadius: 12, background: "#fff" }}
      />
    </>
  );
}
