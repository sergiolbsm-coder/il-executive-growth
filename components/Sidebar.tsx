"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions";
import { Icon } from "@/components/Icon";
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
      <button className="sidebar-toggle" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" size={20} /></button>
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={`sidebar${open ? " open" : ""}`} aria-label="Menu principal">
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
                {list.map((i) => (
                  <Link key={i.href + i.label} href={i.href} className={`nav-btn${isActive(i.href) ? " active" : ""}`} aria-current={isActive(i.href) ? "page" : undefined}>
                    <span className="nav-icon"><Icon name={i.icon} /></span>
                    <span>{i.label}</span>
                  </Link>
                ))}
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
          <form autoComplete="off" action={logoutAction}>
            <button className="user-exit" title="Sair" aria-label="Sair"><Icon name="logout" /></button>
          </form>
        </div>
        <Link href="/trocar-senha" className="nav-link-small">Alterar senha</Link>
      </aside>
    </>
  );
}
