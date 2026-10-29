import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth/session";

// As calculadoras são páginas estáticas (JS puro, sem backend) guardadas em /content e servidas só a quem está logado.
const FILES: Record<string, string> = { rh: "rh.html", precificacao: "precificacao.html" };

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Faça login para acessar.", { status: 401 });
  const { slug } = await params;
  const file = FILES[slug];
  if (!file) return new Response("Não encontrado.", { status: 404 });
  const html = await readFile(path.join(process.cwd(), "content", "calculadoras", file), "utf8");
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
