import pool from '../db/pool.js';
import { Agent, AgentWithWorkload, AvailabilityWindow } from '../types/domain.js';

function toAgent(row: any): Agent {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    utcOffsetMinutes: row.utc_offset_minutes,
    lastAssignedAt: row.last_assigned_at,
  };
}

function toWindow(row: any): Pick<AvailabilityWindow, 'startMinuteUtc' | 'durationMinutes'> {
  return {
    startMinuteUtc: row.start_minute_utc,
    durationMinutes: row.duration_minutes,
  };
}

export default class AgentRepository {
  static async findById(companyId: string, agentId: string): Promise<Agent | null> {
    const { rows } = await pool.query(
      `SELECT id, company_id, name, utc_offset_minutes, last_assigned_at
       FROM agent
       WHERE id = $1 AND company_id = $2`,
      [agentId, companyId]
    );
    return rows[0] ? toAgent(rows[0]) : null;
  }

  /**
   * Returns all agents for a company with computed workload fields
   */
  static async findByCompanyWithWorkload(companyId: string): Promise<AgentWithWorkload[]> {
    const [agentsResult, windowsResult, activeCountsResult] = await Promise.all([
      pool.query(
        `SELECT id, company_id, name, utc_offset_minutes, last_assigned_at
         FROM agent
         WHERE company_id = $1
         ORDER BY name`,
        [companyId]
      ),
      pool.query(
        `SELECT aw.agent_id, aw.start_minute_utc, aw.duration_minutes
         FROM availability_window aw
         JOIN agent a ON a.id = aw.agent_id
         WHERE a.company_id = $1`,
        [companyId]
      ),
      pool.query(
        `SELECT t.assigned_agent_id AS agent_id, COUNT(*)::int AS count
         FROM ticket t
         JOIN agent a ON a.id = t.assigned_agent_id
         WHERE a.company_id = $1 AND t.status = 'assigned'
         GROUP BY t.assigned_agent_id`,
        [companyId]
      ),
    ]);

    const windowsByAgent = new Map<string, Pick<AvailabilityWindow, 'startMinuteUtc' | 'durationMinutes'>[]>();
    for (const row of windowsResult.rows) {
      const list = windowsByAgent.get(row.agent_id) ?? [];
      list.push(toWindow(row));
      windowsByAgent.set(row.agent_id, list);
    }

    const activeCountByAgent = new Map<string, number>();
    for (const row of activeCountsResult.rows) {
      activeCountByAgent.set(row.agent_id, row.count);
    }

    return agentsResult.rows.map((row): AgentWithWorkload => {
      const agent = toAgent(row);
      const availabilityWindows = windowsByAgent.get(agent.id) ?? [];

      // scheduled weekly hours = sum of window durations, in hours.
      const scheduledWeeklyMinutes = availabilityWindows.reduce(
        (sum, w) => sum + w.durationMinutes,
        0
      );
      const scheduledWeeklyHours = scheduledWeeklyMinutes / 60;

      const activeTicketCount = activeCountByAgent.get(agent.id) ?? 0;

      // not density-eligible if no scheduled hours.
      const ticketDensity =
        scheduledWeeklyHours > 0 ? activeTicketCount / scheduledWeeklyHours : null;

      return {
        ...agent,
        scheduledWeeklyHours,
        activeTicketCount,
        ticketDensity: ticketDensity as number,
        availabilityWindows,
      };
    });
  }
}
