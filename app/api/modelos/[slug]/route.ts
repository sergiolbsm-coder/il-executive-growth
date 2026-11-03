import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth/session";

// Modelos para baixar (planilhas em /content/modelos), só para quem está logado.
const FILES: Record<string, { file: string; name: string }> = {
  "importacao-ofertas": { file: "modelo-importacao-ofertas.xlsx", name: "modelo-importacao-ofertas.xlsx" },
};

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Faça login para acessar.", { status: 401 });
  const { slug } = await params;
  const m = FILES[slug];
  if (!m) return new Response("Não encontrado.", { status: 404 });
  const buf = await readFile(path.join(process.cwd(), "content", "modelos", m.file));
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${m.name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
