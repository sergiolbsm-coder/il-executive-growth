import { listMentees, toRef } from "@/domains/mentees/service";
import { listPrograms, loadProgram } from "@/domains/programs/service";
import { listLinks } from "@/domains/content/service";
import { KIND_ICON, KIND_LABEL, LINK_CATEGORIES, type LinkKind } from "@/domains/content/links";
import { canEditProgram } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDay } from "@/lib/format";
import { ProgramPicker, pickProgram } from "@/components/ProgramPicker";
import { DoneCheck, LinkActions, NewLinkForm } from "./forms";

const HINT: Record<string, string> = {
  Drive: "Pastas e arquivos do Drive, planilhas e modelos do programa.",
  Atividade: "Atividades para fazer. Marque quando concluir.",
  Assessment: "Assessments para responder. Marque quando concluir.",
};

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = toContext(user);
  const mentees = await listMentees(ctx);
  const programs = (await listPrograms(ctx, mentees)).filter((p) => p.status !== "encerrado").map((p) => ({ ...p, menteeName: mentees.find((m) => m.id === p.menteeId)?.fullName }));
  const prog = pickProgram(programs, sp.p);
  if (!prog) return (<><h1>Conteúdo</h1><div className="card"><p className="empty">Nenhum programa ativo por aqui ainda.</p></div></>);

  const [links, { mentee }] = await Promise.all([listLinks(ctx, prog.id), loadProgram(prog.id)]);
  const staff = canEditProgram(ctx, toRef(mentee)) && ctx.role !== "mentorado";
  const doneCount = links.filter((l) => l.done).length;
  const other = links.filter((l) => !(LINK_CATEGORIES as readonly string[]).includes(l.category ?? ""));

  const section = (title: string, list: typeof links) => (
    <div className="card" key={title}>
      <h2 className="h2">{title}</h2>
      {HINT[title] && <p className="sub">{HINT[title]}</p>}
      {list.length === 0 && <p className="empty">Nenhum link ainda.</p>}
      {list.map((l) => (
        <div key={l.id} className={`task${l.done ? " done" : ""}`} style={{ alignItems: "flex-start" }}>
          <div style={{ fontSize: 20 }}>{KIND_ICON[l.kind as LinkKind]}</div>
          <div className="t">
            <a href={l.url} target="_blank" rel="noopener noreferrer"><b>{l.title}</b> ↗</a>
            <div className="opt">{KIND_LABEL[l.kind as LinkKind]}{l.description ? ` · ${l.description}` : ""}</div>
            {l.done && l.doneAt && <div className="opt">✅ feito em {fmtDay(l.doneAt.toISOString().slice(0, 10))}</div>}
          </div>
          <div>
            <DoneCheck linkId={l.id} done={l.done} doneLabel={l.doneAt ? `Marcado em ${fmtDay(l.doneAt.toISOString().slice(0, 10))}` : null} />
            {(staff || l.createdBy === user.id) && <div style={{ marginTop: 8 }}><LinkActions link={{ id: l.id, title: l.title, url: l.url, category: l.category, description: l.description }} /></div>}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <h1>Conteúdo</h1>
      <p className="sub">Links do Drive, atividades e assessments — {prog.menteeName} · {prog.name}</p>
      <ProgramPicker programs={programs} current={prog.id} base="/app/conteudo" />
      {links.length > 0 && (
        <div className="card">
          <div className="row"><h2 className="h2" style={{ margin: 0 }}>Seu progresso</h2> <span className="badge">{doneCount}/{links.length}</span></div>
          <div className="desafios-barra-fundo"><div className="desafios-barra-preenchida" style={{ width: `${Math.round((doneCount / links.length) * 100)}%` }} /></div>
        </div>
      )}
      {LINK_CATEGORIES.map((c) => section(c, links.filter((l) => l.category === c)))}
      {other.length > 0 && section("Outros", other)}
      <div className="card">
        <h2 className="h2">Adicionar link</h2>
        <NewLinkForm programId={prog.id} />
      </div>
    </>
  );
}
