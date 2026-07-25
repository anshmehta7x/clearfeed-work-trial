import { DAY_NAMES, formatMinuteOfDay, utcWindowsToLocal } from '../lib/schedule';
import type { Agent } from '../types';

interface AvailabilitySummaryProps {
  agent: Agent;
}

export function AvailabilitySummary({ agent }: AvailabilitySummaryProps) {
  const localWindows = utcWindowsToLocal(
    agent.availabilityWindows,
    agent.utcOffsetMinutes,
  );

  return (
    <div className="mt-3">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
        Weekly availability
      </p>
      {localWindows.length === 0 ? (
        <p className="text-xs italic text-text-muted">No availability configured</p>
      ) : (
        <ul className="max-h-28 space-y-1 overflow-y-auto pr-1">
          {localWindows.map((window, index) => (
            <li
              key={`${window.dayOfWeek}-${window.startMinute}-${window.endMinute}-${index}`}
              className="flex justify-between gap-3 font-mono text-xs text-text-muted"
            >
              <span>{DAY_NAMES[window.dayOfWeek]?.slice(0, 3)}</span>
              <span>
                {formatMinuteOfDay(window.startMinute)}–
                {formatMinuteOfDay(window.endMinute)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
