import { closeDb, getDb } from "../lib/db";

// getDb() aplica as migrations pendentes ao conectar.
getDb()
  .then(() => console.log("migrations aplicadas"))
  .then(closeDb)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
