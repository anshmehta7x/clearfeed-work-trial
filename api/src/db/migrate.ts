import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import pool from "./pool.js";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

type QueryFn = <T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
) => Promise<QueryResult<T>>;

function toDownFile(upFile: string): string {
  if (!upFile.endsWith(".up.sql")) {
    throw new Error(`Expected an .up.sql migration id, got: ${upFile}`);
  }
  return upFile.replace(/\.up\.sql$/, ".down.sql");
}

async function ensureMigrationsTable(query: QueryFn): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function listAppliedMigrations(query: QueryFn): Promise<string[]> {
  const result = await query<{ id: string }>(
    "SELECT id FROM schema_migrations ORDER BY id",
  );
  return result.rows.map((row) => row.id);
}

async function listUpMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith(".up.sql")).sort();
}

async function readMigrationSql(fileName: string): Promise<string> {
  const filePath = path.join(MIGRATIONS_DIR, fileName);
  await access(filePath);
  return readFile(filePath, "utf8");
}

async function migrateUp(client: PoolClient): Promise<void> {
  const query: QueryFn = (sql, params) => client.query(sql, params);

  await ensureMigrationsTable(query);
  const applied = new Set(await listAppliedMigrations(query));
  const files = await listUpMigrationFiles();

  let appliedCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file}`);
      continue;
    }

    const sql = await readMigrationSql(file);
    console.log(`up    ${file}`);

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
      appliedCount += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log(
    appliedCount === 0
      ? "No pending migrations"
      : `Applied ${appliedCount} migration(s)`,
  );
}

async function migrateDown(client: PoolClient): Promise<void> {
  const query: QueryFn = (sql, params) => client.query(sql, params);

  await ensureMigrationsTable(query);
  const applied = await listAppliedMigrations(query);

  if (applied.length === 0) {
    console.log("No applied migrations to roll back");
    return;
  }

  // Reverse lexical order so dependents drop before parents (004 → 001).
  const files = [...applied].sort().reverse();
  let rolledBackCount = 0;

  for (const upFile of files) {
    const downFile = toDownFile(upFile);
    const sql = await readMigrationSql(downFile);
    console.log(`down  ${downFile}`);

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("DELETE FROM schema_migrations WHERE id = $1", [upFile]);
      await client.query("COMMIT");
      rolledBackCount += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log(`Rolled back ${rolledBackCount} migration(s)`);
}

async function main(): Promise<void> {
  const direction = process.argv[2];

  if (direction !== "up" && direction !== "down") {
    console.error("Usage: migrate <up|down>");
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    if (direction === "up") {
      await migrateUp(client);
    } else {
      await migrateDown(client);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
