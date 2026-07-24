import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import pool from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
  const sql = readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Seed complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
