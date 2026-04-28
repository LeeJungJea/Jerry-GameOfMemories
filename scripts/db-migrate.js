const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

loadEnv(path.join(__dirname, "..", ".env"));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is missing. Add it to .env before running migrations.");
  process.exit(1);
}

const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf8");
const statements = schemaSql
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);

async function main() {
  const sql = neon(databaseUrl);

  for (const statement of statements) {
    await sql.query(statement);
  }

  console.log(`Applied ${statements.length} migration statements from db/schema.sql.`);
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
