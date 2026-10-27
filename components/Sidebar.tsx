"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions";
import type { NavItem } from "@/lib/nav";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administração",
  direcao: "Direção",
  mentor: "Mentor",
  mentorado: "Mentorado",
};

export function Sidebar({ items, user }: { items: NavItem[]; user: { name: string; role: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const groups = [undefined, "Ferramentas", "Operação", "Administração"] as const;

  return (
    <>
      <button className="sidebar-toggle" aria-label="Abrir menu" onClick={() => setOpen(true)}>☰</button>
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-brand">
          <div className="logo-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo-icon" src="/logo-crop.png" alt="Instituto da Liderança" />
          </div>
          <div className="logo-title">IL Executive Growth</div>
        </div>

        <nav className="sidebar-nav">
          {groups.map((g) => {
            const list = items.filter((i) => i.group === g);
            if (!list.length) return null;
            return (
              <div key={g ?? "main"} className="nav-group">
                {g && <div className="nav-group-title">{g}</div>}
                {list.map((i) =>
                  i.status === "soon" ? (
                    <span key={i.href + i.label} className="nav-btn disabled" aria-disabled="true" title="Em breve">
                      <span className="nav-icon">{i.icon}</span>
                      <span>{i.label}</span>
                      <span className="nav-soon">em breve</span>
                    </span>
                  ) : (
                    <Link key={i.href + i.label} href={i.href} className={`nav-btn${isActive(i.href) ? " active" : ""}`}>
                      <span className="nav-icon">{i.icon}</span>
                      <span>{i.label}</span>
                    </Link>
                  ),
                )}
              </div>
            );
          })}
        </nav>

        <div className="user-chip">
          <span className="user-avatar">{user.name.trim().charAt(0).toUpperCase()}</span>
          <span className="user-meta">
            <span className="user-name">{user.name}</span>
            <span className="user-role">{ROLE_LABEL[user.role] ?? user.role}</span>
          </span>
          <form action={logoutAction}>
            <button className="user-exit" title="Sair" aria-label="Sair">🚪</button>
          </form>
        </div>
        <Link href="/trocar-senha" className="nav-link-small">Alterar senha</Link>
      </aside>
    </>
  );
}
