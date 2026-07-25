import type { TicketStatus } from '../types';

const PILL_STYLES: Record<TicketStatus, string> = {
  unassigned: 'text-amber border-amber',
  assigned: 'text-sage border-sage',
  closed: 'text-text-muted border-line',
};

const PILL_LABELS: Record<TicketStatus, string> = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  closed: 'Closed',
};

interface StatusPillProps {
  status: TicketStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-pill text-xs border ${PILL_STYLES[status]}`}
    >
      {PILL_LABELS[status]}
    </span>
  );
}
