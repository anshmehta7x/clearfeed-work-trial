/** Fixed maximum ticket-density threshold (active tickets / scheduled weekly hours). */
export const MAX_TICKET_DENSITY = 0.25;

export function isExcessLoad(ticketDensity: number | null): boolean {
  return ticketDensity !== null && ticketDensity >= MAX_TICKET_DENSITY;
}

/** Cap bar fill as a percentage of the density threshold (capped at 100%). */
export function densityBarPercent(ticketDensity: number | null): number {
  if (ticketDensity === null) return 0;
  return Math.min(100, (ticketDensity / MAX_TICKET_DENSITY) * 100);
}

export function formatDensity(ticketDensity: number | null): string {
  if (ticketDensity === null) return '—';
  return ticketDensity.toFixed(3);
}

export function shortAgentId(id: string): string {
  return `#${id.slice(-4)}`;
}
