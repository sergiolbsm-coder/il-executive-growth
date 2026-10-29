// E-mail transacional via Resend (HTTP, sem SDK) — mesmo padrão do Career Hub e do planner.
// Nunca lança: falha de e-mail não pode desfazer o cadastro; quem chama decide o que fazer.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type MailResult = { sent: true } | { sent: false; reason: "not_configured" | "failed"; detail?: string };

export async function sendAccessEmail(p: { name: string; email: string; tempPassword: string }): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };

  const appUrl = process.env.APP_URL ?? "https://growth.institutodalideranca.com.br";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#24153E">
      <h2 style="color:#391694">IL Executive Growth</h2>
      <p>Olá, ${esc(p.name)}!</p>
      <p>Seu acesso ao IL Executive Growth, do Instituto da Liderança, foi liberado.</p>
      <ul>
        <li><strong>E-mail:</strong> ${esc(p.email)}</li>
        <li><strong>Senha provisória:</strong> ${esc(p.tempPassword)}</li>
      </ul>
      <p><a href="${esc(appUrl)}/login" style="background:#FF0060;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Acessar o Executive Growth</a></p>
      <p style="font-size:13px;color:#6F667E">No primeiro acesso você será solicitado(a) a criar uma nova senha.</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: p.email,
        subject: "Seu acesso ao IL Executive Growth — Instituto da Liderança",
        html,
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      }),
    });
    if (!res.ok) return { sent: false, reason: "failed", detail: `HTTP ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: "failed", detail: e instanceof Error ? e.message : String(e) };
  }
}

/** E-mail genérico (avisos de chamados). Nunca lança; sem RESEND_API_KEY/EMAIL_FROM devolve not_configured. */
export async function sendNotice(p: { to: string[]; subject: string; heading: string; lines: string[]; link?: { href: string; label: string } }): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };
  const to = [...new Set(p.to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!to.length) return { sent: false, reason: "failed", detail: "sem destinatários" };
  const appUrl = process.env.APP_URL ?? "https://growth.institutodalideranca.com.br";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#24153E">
      <h2 style="color:#391694">${esc(p.heading)}</h2>
      ${p.lines.map((l) => `<p style="white-space:pre-wrap">${esc(l)}</p>`).join("")}
      ${p.link ? `<p><a href="${esc(appUrl)}${esc(p.link.href)}" style="background:#FF0060;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">${esc(p.link.label)}</a></p>` : ""}
      <p style="font-size:12px;color:#6F667E">IL Executive Growth — Instituto da Liderança</p>
    </div>`;
  try {
    // um envio por destinatário: ninguém vê o e-mail dos outros
    const results = await Promise.all(
      to.map((addr) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: addr, subject: p.subject, html, ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}) }),
        }),
      ),
    );
    const bad = results.find((r) => !r.ok);
    return bad ? { sent: false, reason: "failed", detail: `HTTP ${bad.status}` } : { sent: true };
  } catch (e) {
    return { sent: false, reason: "failed", detail: e instanceof Error ? e.message : String(e) };
  }
}
