import { listMentees } from "@/domains/mentees/service";
import { listOffers } from "@/domains/offers/service";
import { listPrograms } from "@/domains/programs/service";
import { addDays, currentWeek, weekLabel } from "@/lib/week";
import { listAxes, listItems, listLinks } from "@/domains/content/service";
import { KIND_ICON, KIND_LABEL, type LinkKind } from "@/domains/content/links";
import { CHANNEL_LABEL, STATUS_LABEL, summarize, type Channel, type ContentStatus } from "@/domains/content/summary";
import { canEditProgram, isStaff } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { fmtDay } from "@/lib/format";
import { ProgramPicker, pickProgram } from "@/components/ProgramPicker";
import { loadProgram } from "@/domains/programs/service";
import { toRef } from "@/domains/mentees/service";
import { AddAxisForm, AxisRow, ExampleAxesButton, ItemEditForm, LinkActions, NewItemForm, NewLinkForm, StatusSelect, SyncButton } from "./forms";

const STATUS_CLASS: Record<ContentStatus, string> = { ideia: "tl-sem-meta", rascunho: "tl-amarelo", agendada: "tl-amarelo", publicada: "tl-verde", descartada: "tl-sem-meta" };

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = toContext(user);
  const mentees = await listMentees(ctx);
  const programs = (await listPrograms(ctx, mentees)).filter((p) => p.status !== "encerrado").map((p) => ({ ...p, menteeName: mentees.find((m) => m.id === p.menteeId)?.fullName }));
  const prog = pickProgram(programs, sp.p);
  if (!prog) return (<><h1>Conteúdo</h1><div className="card"><p className="empty">Nenhum programa ativo por aqui ainda.</p></div></>);

  const [axes, items, links, offers, { mentee }] = await Promise.all([listAxes(ctx, prog.id), listItems(ctx, prog.id), listLinks(ctx, prog.id), listOffers(ctx, prog.id), loadProgram(prog.id)]);
  const staff = canEditProgram(ctx, toRef(mentee)) && isStaff(ctx);
  const now = currentWeek();
  const sum = summarize(items.map((i) => ({ id: i.id, axisId: i.axisId, weekStart: i.weekStart, status: i.status, title: i.title, engagement: i.engagement, leads: i.leads })), axes, now);
  const axesOpt = axes.map((a) => ({ id: a.id, name: a.name }));
  const offersOpt = offers.filter((o) => o.status === "ativa").map((o) => ({ id: o.id, name: o.name }));
  const axisName = (id: string | null) => axes.find((a) => a.id === id)?.name ?? null;
  const offerName = (id: string | null) => offers.find((o) => o.id === id)?.name ?? null;

  const cutoff = addDays(now, -28);
  const recent = items.filter((i) => i.weekStart >= cutoff);
  const older = items.filter((i) => i.weekStart < cutoff);
  const weeks = [...new Set(recent.map((i) => i.weekStart))].sort();
  const pinned = links.filter((l) => l.pinned);
  const cats = [...new Set(links.map((l) => l.category ?? "Sem categoria"))].sort();
  const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);

  const renderItem = (i: (typeof items)[number]) => (
    <div key={i.id} className="task" style={{ alignItems: "flex-start" }}>
      <div className="t">
        <b>{i.title}</b> {i.publishUrl && <a href={i.publishUrl} target="_blank" rel="noopener noreferrer" title="Abrir a publicação">↗</a>}
        <div className="opt">
          {CHANNEL_LABEL[i.channel as Channel] ?? i.channel}
          {axisName(i.axisId) ? ` · ${axisName(i.axisId)}` : ""}{offerName(i.offerId) ? ` · alimenta: ${offerName(i.offerId)}` : ""}
          {i.status === "publicada" && i.publishedOn ? ` · publicada em ${fmtDay(i.publishedOn)}` : ""}
          {i.engagement != null ? ` · ${i.engagement} interações` : ""}{i.leads != null ? ` · ${i.leads} convite(s)/reunião(ões)` : ""}
        </div>
        {i.thesis && <div className="opt" style={{ fontStyle: "italic" }}>{i.thesis}</div>}
        <details style={{ marginTop: 4 }}><summary style={{ cursor: "pointer", fontSize: 12 }}>Editar</summary><ItemEditForm item={i} axes={axesOpt} offers={offersOpt} /></details>
      </div>
      <div style={{ textAlign: "right" }}><span className={`tl ${STATUS_CLASS[i.status]}`}>{STATUS_LABEL[i.status]}</span><div style={{ marginTop: 6 }}><StatusSelect itemId={i.id} status={i.status} /></div></div>
    </div>
  );

  return (
    <>
      <h1>Conteúdo</h1>
      <p className="sub">Calendário editorial, eixos e biblioteca de links — {prog.menteeName} · {prog.name}</p>
      <ProgramPicker programs={programs} current={prog.id} base="/app/conteudo" />

      <div className="card">
        <h2 className="h2">Acessos rápidos</h2>
        {pinned.length === 0 ? (
          <p className="empty">Nenhum link fixado. Fixe na biblioteca abaixo as pastas e arquivos que você mais usa (Drive, planilhas, modelos).</p>
        ) : (
          <div className="grid">
            {pinned.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="card" style={{ margin: 0, textDecoration: "none", display: "block" }} title={l.description ?? l.url}>
                <div style={{ fontSize: 26 }}>{KIND_ICON[l.kind as LinkKind]}</div>
                <b style={{ color: "var(--idl-purple-dark)" }}>{l.title}</b>
                <div className="opt">{KIND_LABEL[l.kind as LinkKind]}{l.category ? ` · ${l.category}` : ""} ↗</div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="h2">Visão do calendário</h2>
        <div className="meters">
          <div className="meter"><b>{sum.byStatus.publicada}</b><span>publicadas</span></div>
          <div className="meter"><b>{sum.byStatus.agendada + sum.byStatus.rascunho}</b><span>em produção / agendadas</span></div>
          <div className="meter"><b>{sum.byStatus.ideia}</b><span>ideias</span></div>
          <div className="meter"><b>{sum.pace.published}/{sum.pace.planned}</b><span>ritmo · últimas 4 semanas ({pct(sum.pace.ratio)})</span></div>
          <div className="meter"><b>{sum.totals.engagement}</b><span>interações · {sum.totals.leads} convite(s)/reunião(ões)</span></div>
        </div>
        {axes.length > 0 && (
          <table style={{ marginTop: 10 }}>
            <thead><tr><th>Eixo</th><th>Publicações (8 sem. atrás a 4 à frente)</th><th>Publicadas</th><th></th></tr></thead>
            <tbody>
              {sum.axes.map((a) => (
                <tr key={a.axisId}><td>{axisName(a.axisId)}</td><td>{a.count}</td><td>{a.published}</td><td>{a.gap ? <span className="tl tl-vermelho">sem conteúdo no período</span> : null}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {sum.top.length > 0 && <p className="sub" style={{ margin: "12px 0 0" }}>Mais engajadas: {sum.top.map((t) => `${t.title} (${t.engagement})`).join(" · ")}</p>}
      </div>

      <div className="card">
        <h2 className="h2">Calendário editorial</h2>
        {items.length === 0 && <p className="empty">Nenhuma publicação planejada ainda. Adicione a primeira abaixo.</p>}
        {weeks.map((w) => (
          <div key={w} style={{ marginBottom: 12 }}>
            <h3 style={{ margin: "10px 0 4px", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--idl-text-muted)" }}>
              {weekLabel(w)} {w === now && <span className="badge">esta semana</span>}
            </h3>
            {recent.filter((i) => i.weekStart === w).map(renderItem)}
          </div>
        ))}
        {older.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Semanas anteriores ({older.length})</summary>
            {older.slice().reverse().map(renderItem)}
          </details>
        )}
        <div style={{ marginTop: 14 }}><SyncButton programId={prog.id} week={now} /></div>
      </div>

      <div className="card">
        <h2 className="h2">Nova publicação</h2>
        <NewItemForm programId={prog.id} week={now} axes={axesOpt} offers={offersOpt} />
      </div>

      <div className="card">
        <h2 className="h2">Eixos de conteúdo</h2>
        <p className="sub">Editáveis por programa: nomeie os temas que sustentam o seu posicionamento.</p>
        {axes.length === 0 ? (
          <>
            <p className="empty">Nenhum eixo definido.</p>
            {staff && <ExampleAxesButton programId={prog.id} />}
          </>
        ) : axes.map((a) => <AxisRow key={a.id} axis={{ id: a.id, name: a.name, description: a.description }} canEdit={staff} />)}
        {staff && <div style={{ marginTop: 12 }}><AddAxisForm programId={prog.id} /></div>}
      </div>

      <div className="card">
        <h2 className="h2">Biblioteca de links</h2>
        <p className="sub">Pastas e arquivos do Drive e outros endereços do programa. Os links abrem em outra aba; o sistema não lê o conteúdo do Drive.</p>
        {links.length === 0 && <p className="empty">Nenhum link ainda.</p>}
        {cats.map((c) => {
          const list = links.filter((l) => (l.category ?? "Sem categoria") === c);
          if (!list.length) return null;
          return (
            <div key={c}>
              <h3 style={{ margin: "14px 0 6px", fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--idl-text-muted)" }}>{c}</h3>
              {list.map((l) => (
                <div key={l.id} className="task">
                  <div style={{ fontSize: 20 }}>{KIND_ICON[l.kind as LinkKind]}</div>
                  <div className="t">
                    <a href={l.url} target="_blank" rel="noopener noreferrer"><b>{l.title}</b></a> {l.pinned && <span className="badge">acesso rápido</span>}
                    <div className="opt">{KIND_LABEL[l.kind as LinkKind]}{l.description ? ` · ${l.description}` : ""}</div>
                  </div>
                  <LinkActions link={{ id: l.id, title: l.title, url: l.url, category: l.category, description: l.description, pinned: l.pinned }} canManage={staff || l.createdBy === user.id} />
                </div>
              ))}
            </div>
          );
        })}
        <div style={{ marginTop: 16 }}><h3 style={{ margin: "0 0 6px" }}>Adicionar link</h3><NewLinkForm programId={prog.id} categories={cats.filter((c) => c !== "Sem categoria")} /></div>
      </div>
    </>
  );
}
