import { STAGES, stageName } from "@/lib/stages";
import { SCHEDULE_LABEL, type ScheduleStatus } from "@/domains/offers/stage";

/** Régua dos 7 estágios: concluídos em turquesa, atual em magenta. */
export function StageBar({ stage, compact = false }: { stage: number; compact?: boolean }) {
  return (
    <div className={`stagebar${compact ? " compact" : ""}`} role="img" aria-label={`Estágio ${stage} de 7: ${stageName(stage)}`}>
      {STAGES.map((s) => (
        <span key={s.n} className={`step${s.n < stage ? " done" : ""}${s.n === stage ? " current" : ""}`} title={`${s.n}. ${s.name} (${s.phase})`}>
          {!compact && <i>{s.name}</i>}
        </span>
      ))}
    </div>
  );
}

export function ScheduleBadge({ status }: { status: ScheduleStatus }) {
  return <span className={`stage-chip sch-${status}`}>{SCHEDULE_LABEL[status]}</span>;
}
