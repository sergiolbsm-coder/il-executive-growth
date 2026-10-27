import { Sidebar } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth/session";
import { navFor } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="app-shell">
      <Sidebar items={navFor(user.role)} user={{ name: user.name, role: user.role }} />
      <main className="main">{children}</main>
    </div>
  );
}
