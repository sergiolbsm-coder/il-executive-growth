// Cria o primeiro administrador a partir de variáveis de ambiente (nada hardcoded).
import { createUser } from "../domains/users/service";
import { closeDb } from "../lib/db";

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD.");
  process.exit(1);
}
createUser(null, { name: ADMIN_NAME, email: ADMIN_EMAIL, role: "admin", password: ADMIN_PASSWORD, sendEmail: false })
  .then((g) => console.log(`Administrador criado: ${g.user.email} (troca de senha exigida no 1º acesso)`))
  .then(closeDb)
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
