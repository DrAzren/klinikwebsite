/**
 * Database CLI.
 *   npm run db:migrate                 apply migrations (DATABASE_URL or local PGlite)
 *   npm run db:seed                    reference data + initial CMS content (production-safe)
 *   npm run db:reset-demo              delete local PGlite data (dev only)
 *   npm run staff:create-admin -- --username ceo --email ceo@clinic --name "Full Name"
 */
import { rmSync } from "node:fs";
import { getDb } from "../src/lib/db";
import { runMigrations } from "../src/lib/db/migrate";
import { seedContent, seedReference } from "../src/lib/db/seed";
import { createStaffUser } from "../src/lib/auth/service";
import { generateTempPassword } from "../src/lib/auth/password";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "reset-demo") {
    if (process.env.DATABASE_URL) throw new Error("reset-demo only works with the local PGlite database");
    rmSync(process.env.PGLITE_DIR ?? ".data/pglite", { recursive: true, force: true });
    console.log("Local demo database removed. It will be recreated and re-seeded on next start.");
    return;
  }
  const db = await getDb();
  if (cmd === "migrate") {
    const applied = await runMigrations(db);
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
  } else if (cmd === "seed") {
    await runMigrations(db);
    await seedReference(db);
    console.log((await seedContent(db)) ? "Seeded reference data and initial content." : "Reference data ensured; CMS already has content.");
  } else if (cmd === "create-admin") {
    const username = arg("username");
    const email = arg("email");
    const name = arg("name");
    if (!username || !email || !name) throw new Error('Usage: --username <u> --email <e> --name "<full name>"');
    const temp = generateTempPassword();
    await createStaffUser(db, { id: null as unknown as string, label: "cli" }, { username, email, fullName: name, role: "super_admin", tempPassword: temp });
    console.log(`Super Admin "${username}" created.\nTemporary password (shown once): ${temp}\nThey must change it and enrol MFA at first login.`);
  } else {
    console.log("Commands: migrate | seed | reset-demo | create-admin");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
