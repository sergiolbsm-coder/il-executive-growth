// Regras PURAS dos links da biblioteca (sem banco): validação do endereço e detecção de Google Drive.

export type LinkKind = "drive-arquivo" | "drive-pasta" | "link";

const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com", "sheets.google.com", "slides.google.com", "forms.google.com"]);

/** Aceita só http(s) (nunca javascript:, data:, file:…), sem espaços, até 2000 caracteres. Devolve a URL normalizada ou null. */
export function normalizeUrl(input: string): string | null {
  const s = input.trim();
  if (!s || s.length > 2000 || /\s/.test(s) || !/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Pasta do Drive (/drive/folders/…, /folders/…) · arquivo do Drive/Docs/Sheets/Slides/Forms · qualquer outro link. */
export function detectKind(url: string): LinkKind {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "link";
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (!DRIVE_HOSTS.has(host)) return "link";
  return /\/folders\//.test(u.pathname) ? "drive-pasta" : "drive-arquivo";
}

export const KIND_LABEL: Record<LinkKind, string> = { "drive-arquivo": "Drive · arquivo", "drive-pasta": "Drive · pasta", link: "Link" };
export const KIND_ICON: Record<LinkKind, string> = { "drive-arquivo": "📄", "drive-pasta": "📁", link: "🔗" };

/** Tipos de link da biblioteca (o campo "category" guarda um deles). */
export const LINK_CATEGORIES = ["Drive", "Atividade", "Assessment"] as const;
export type LinkCategory = (typeof LINK_CATEGORIES)[number];
export const isLinkCategory = (v: string): v is LinkCategory => (LINK_CATEGORIES as readonly string[]).includes(v);
