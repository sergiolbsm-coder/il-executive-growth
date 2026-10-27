import Link from "next/link";

type P = { id: string; name: string };

/** Escolhe o programa a partir do parâmetro `p` (cai no primeiro). */
export function pickProgram<T extends P>(programs: T[], requested?: string): T | null {
  return programs.find((p) => p.id === requested) ?? programs[0] ?? null;
}

/** Abas de programa (só aparece com mais de um). `extra` preserva outros parâmetros da URL (ex.: semana). */
export function ProgramPicker({ programs, current, base, extra = {} }: { programs: (P & { menteeName?: string })[]; current: string; base: string; extra?: Record<string, string> }) {
  if (programs.length < 2) return null;
  return (
    <div className="row" style={{ marginBottom: 14 }}>
      {programs.map((p) => {
        const q = new URLSearchParams({ ...extra, p: p.id }).toString();
        return (
          <Link key={p.id} href={`${base}?${q}`} className={`btn sec${p.id === current ? " on" : ""}`} style={p.id === current ? { background: "var(--idl-purple)", color: "#fff", borderColor: "var(--idl-purple)" } : undefined}>
            {p.menteeName ? `${p.menteeName} · ` : ""}{p.name}
          </Link>
        );
      })}
    </div>
  );
}
