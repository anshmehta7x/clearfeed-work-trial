import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import type { Pool } from 'pg';
import pool from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Apply seed.sql. Does not close the pool (safe for tests). */
export async function seedDatabase(db: Pool = pool): Promise<void> {
  const sql = readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
  await db.query(sql);
}

async function main() {
  try {
    await seedDatabase();
    console.log('Seed complete.');
  } finally {
    await pool.end();
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
