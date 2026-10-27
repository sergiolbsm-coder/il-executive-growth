import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/app/dashboard");
  return (
    <main className="login">
      <div className="card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-crop.png" alt="Instituto da Liderança" />
        <h1 style={{ textAlign: "center", fontSize: 26 }}>IL Executive Growth</h1>
        <p className="sub" style={{ textAlign: "center" }}>Acompanhamento de mentoria e lançamento de ofertas</p>
        <LoginForm />
      </div>
    </main>
  );
}
