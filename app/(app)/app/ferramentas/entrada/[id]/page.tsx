import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntry } from "@/domains/tools/service";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";
import { fmtDateTime } from "@/lib/format";
import { EntryForm, ReviewButton } from "../../forms";

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  let d;
  try {
    d = await getEntry(toContext(user), id);
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof ValidationError) notFound();
    throw e;
  }
  const { entry, tool, program, mentee, offer, canReview, linkedGates } = d;
  return (
    <>
      <p className="sub"><Link href={`/app/ferramentas?p=${program.id}`}>← Ferramentas</Link> · {mentee.fullName} · {program.name}</p>
      <h1>{entry.title || tool.name}</h1>
      <p className="sub">
        {tool.name} {tool.strategic && <span className="badge">estratégica</span>}{" "}
        {entry.status === "concluida" ? (entry.reviewedAt ? <span className="stage-chip sch-cumprida">revisada pela equipe</span> : <span className="stage-chip">concluída — aguardando revisão</span>) : <span className="stage-chip sch-sem-prazo">rascunho</span>}
        {offer && <> · oferta <Link href={`/app/ofertas/${offer.id}`}>{offer.name}</Link></>} · atualizada {fmtDateTime(entry.updatedAt.toISOString())}
      </p>
      {tool.description && <p className="sub">{tool.description}</p>}
      {linkedGates.length > 0 && offer && (
        <div className="msg ok">Ao concluir, esta ferramenta comprova na oferta: {linkedGates.map((g) => g.label).join(" · ")}. {user.role === "mentorado" ? "Os itens ficam pendentes até a equipe confirmar." : ""}</div>
      )}
      <div className="card"><EntryForm entryId={entry.id} fields={tool.fields} data={entry.data} /></div>
      {canReview && entry.status === "concluida" && !entry.reviewedAt && (
        <div className="card">
          <h2 className="h2">Revisão da equipe</h2>
          <p className="sub">Revisar confirma os itens de portão pendentes ligados a esta ferramenta e faz ela contar integralmente no Score.</p>
          <ReviewButton entryId={entry.id} />
        </div>
      )}
    </>
  );
}
