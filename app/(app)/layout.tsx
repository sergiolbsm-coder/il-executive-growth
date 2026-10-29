import { HelpButton } from "@/components/HelpButton";
import { NavProgress } from "@/components/NavProgress";
import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth/session";
import { navFor } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="app-shell">
      <NavProgress />
      <Sidebar items={navFor(user.role)} user={{ name: user.name, role: user.role }} />
      <main className="main">{children}</main>
      {user.role === "mentorado" && <HelpButton />}
    </div>
  );
}
