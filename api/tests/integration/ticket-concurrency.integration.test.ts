import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/db/pool.js';
import { seedDatabase } from '../../src/db/seed.js';

const COMPANY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AGENT_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const AGENT_B_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

const ticketId = (suffix: number) =>
  `bbbbbbbb-bbbb-4bbb-8bbb-${suffix.toString().padStart(12, '0')}`;
const assignUrl = (id: string) => `/companies/${COMPANY_ID}/tickets/${id}/assign`;
const closeUrl = (id: string) => `/companies/${COMPANY_ID}/tickets/${id}/close`;

async function deleteTestData(): Promise<void> {
  await pool.query('DELETE FROM ticket WHERE company_id = $1', [COMPANY_ID]);
  await pool.query(
    `DELETE FROM availability_window
     WHERE agent_id IN ($1, $2)`,
    [AGENT_A_ID, AGENT_B_ID]
  );
  await pool.query('DELETE FROM agent WHERE company_id = $1', [COMPANY_ID]);
  await pool.query('DELETE FROM company WHERE id = $1', [COMPANY_ID]);
}

async function insertTickets(ids: string[]): Promise<void> {
  for (const id of ids) {
    await pool.query('INSERT INTO ticket (id, company_id) VALUES ($1, $2)', [
      id,
      COMPANY_ID,
    ]);
  }
}

describe('PostgreSQL ticket concurrency', () => {
  beforeAll(async () => {
    await deleteTestData();
    await pool.query('INSERT INTO company (id, name) VALUES ($1, $2)', [
      COMPANY_ID,
      'Concurrency Test Company',
    ]);
    await pool.query(
      `INSERT INTO agent (id, company_id, name, utc_offset_minutes)
       VALUES ($1, $3, 'Agent A', 0), ($2, $3, 'Agent B', 0)`,
      [AGENT_A_ID, AGENT_B_ID, COMPANY_ID]
    );

    // Seven one-day circular windows make both agents available all week.
    for (const agentId of [AGENT_A_ID, AGENT_B_ID]) {
      for (let day = 0; day < 7; day++) {
        await pool.query(
          `INSERT INTO availability_window
             (agent_id, start_minute_utc, duration_minutes)
           VALUES ($1, $2, 1440)`,
          [agentId, day * 1440]
        );
      }
    }
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM ticket WHERE company_id = $1', [COMPANY_ID]);
    await pool.query(
      'UPDATE agent SET last_assigned_at = NULL WHERE company_id = $1',
      [COMPANY_ID]
    );
  });

  afterAll(async () => {
    await deleteTestData();
    // Restore demo seed data for local UI / manual testing on the shared DB.
    await seedDatabase(pool);
    await pool.end();
  });

  it('serializes concurrent assignments for different tickets and balances density', async () => {
    const ids = Array.from({ length: 6 }, (_, index) => ticketId(index + 1));
    await insertTickets(ids);

    const responses = await Promise.all(ids.map((id) => request(app).post(assignUrl(id))));

    expect(responses.every((response) => response.status === 200)).toBe(true);
    const { rows } = await pool.query<{ assigned_agent_id: string; count: number }>(
      `SELECT assigned_agent_id, COUNT(*)::int AS count
       FROM ticket
       WHERE company_id = $1 AND status = 'assigned'
       GROUP BY assigned_agent_id
       ORDER BY assigned_agent_id`,
      [COMPANY_ID]
    );
    expect(rows).toEqual([
      { assigned_agent_id: AGENT_A_ID, count: 3 },
      { assigned_agent_id: AGENT_B_ID, count: 3 },
    ]);
  });

  it('atomically assigns the same ticket once and returns one shared result', async () => {
    const id = ticketId(100);
    await insertTickets([id]);

    const responses = await Promise.all(
      Array.from({ length: 8 }, () => request(app).post(assignUrl(id)))
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(new Set(responses.map((response) => JSON.stringify(response.body))).size).toBe(1);

    const { rows } = await pool.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM ticket WHERE id = $1 AND status = $2',
      [id, 'assigned']
    );
    expect(rows[0]?.count).toBe(1);
  });

  it('serializes concurrent close and assign without stale active counts', async () => {
    const closingId = ticketId(200);
    const assigningId = ticketId(201);
    await insertTickets([assigningId]);
    await pool.query(
      `INSERT INTO ticket
         (id, company_id, status, assigned_agent_id, assigned_at, reason)
       VALUES ($1, $2, 'assigned', $3, now(), 'Existing assignment')`,
      [closingId, COMPANY_ID, AGENT_A_ID]
    );

    const [closeResponse, assignResponse] = await Promise.all([
      request(app).post(closeUrl(closingId)),
      request(app).post(assignUrl(assigningId)),
    ]);

    expect(closeResponse.status).toBe(200);
    expect(assignResponse.status).toBe(200);

    const { rows: tickets } = await pool.query<{
      id: string;
      status: string;
      assigned_agent_id: string;
    }>(
      `SELECT id, status, assigned_agent_id
       FROM ticket
       WHERE id IN ($1, $2)
       ORDER BY id`,
      [closingId, assigningId]
    );
    expect(tickets.find((ticket) => ticket.id === closingId)?.status).toBe('closed');
    expect(tickets.find((ticket) => ticket.id === assigningId)?.status).toBe('assigned');

    const { rows: activeCounts } = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM ticket
       WHERE company_id = $1 AND status = 'assigned'`,
      [COMPANY_ID]
    );
    expect(activeCounts[0]?.count).toBe(1);
  });
});
