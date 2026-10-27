import { requireUser } from "@/lib/auth/session";
import { PasswordForm } from "./form";

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <main className="login">
      <div className="card">
        <h1 style={{ fontSize: 26 }}>Crie sua senha</h1>
        <p className="sub">
          {user.mustChangePassword ? "Por segurança, defina uma nova senha antes de continuar." : "Altere sua senha de acesso."}
        </p>
        <PasswordForm />
      </div>
    </main>
  );
}
