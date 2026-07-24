import { useMemo } from 'react';
import type { Agent } from '../types';
import {
  DAYS,
  SLOTS_PER_DAY,
  formatTime,
  formatOffset,
  getDailyCoverageGaps,
  getBrowserOffsetMinutes,
  getCurrentSlotIndex,
  isAgentAvailableInSlot,
  isSlotCovered,
} from '../lib/coverage';

interface CoverageChartProps {
  agents: Agent[];
}

const TIME_LABELS = ['00:00', '06:00', '12:00', '18:00', '24:00'];

function Slot({ covered, gap = false }: { covered: boolean; gap?: boolean }) {
  return (
    <div
      className={`h-5 rounded-sm ${
        covered ? 'bg-sage' : gap ? 'gap-hatch' : 'bg-line'
      }`}
    />
  );
}

function Timeline({
  availability,
  showGaps = false,
}: {
  availability: boolean[];
  showGaps?: boolean;
}) {
  return (
    <div
      className="grid gap-px min-w-0"
      style={{ gridTemplateColumns: `repeat(${SLOTS_PER_DAY}, minmax(0, 1fr))` }}
    >
      {availability.map((covered, index) => (
        <Slot key={index} covered={covered} gap={showGaps && !covered} />
      ))}
    </div>
  );
}

function AgentRow({ agent, dayIndex }: { agent: Agent; dayIndex: number }) {
  const startSlot = dayIndex * SLOTS_PER_DAY;
  const availability = Array.from({ length: SLOTS_PER_DAY }, (_, index) =>
    isAgentAvailableInSlot(agent, startSlot + index),
  );

  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-3 py-1">
      <div className="min-w-0 text-sm">
        <span className="font-medium">{agent.name}</span>
        <span className="ml-2 font-mono text-[10px] text-text-muted">
          {formatOffset(agent.utcOffsetMinutes)}
        </span>
      </div>
      <Timeline availability={availability} />
    </div>
  );
}

interface DayBoardProps {
  agents: Agent[];
  dayIndex: number;
  currentSlotIndex: number;
}

function DayBoard({ agents, dayIndex, currentSlotIndex }: DayBoardProps) {
  const startSlot = dayIndex * SLOTS_PER_DAY;
  const coverage = Array.from({ length: SLOTS_PER_DAY }, (_, index) =>
    isSlotCovered(agents, startSlot + index),
  );
  const gaps = getDailyCoverageGaps(agents, dayIndex);
  const isToday = Math.floor(currentSlotIndex / SLOTS_PER_DAY) === dayIndex;
  const nowPosition = ((currentSlotIndex - startSlot) / SLOTS_PER_DAY) * 100;

  return (
    <article className="border-b border-line py-5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h3 className="text-lg">{DAYS[dayIndex]}</h3>
        <div className="flex flex-wrap justify-end gap-1.5 font-mono text-[10px]">
          {gaps.length === 0 ? (
            <span className="text-sage">Full coverage</span>
          ) : (
            gaps.map((gap) => (
              <span
                key={`${gap.startMinute}-${gap.endMinute}`}
                className="rounded-pill border border-rust/60 px-2 py-0.5 text-rust"
              >
                Gap {formatTime(gap.startMinute)}–{formatTime(gap.endMinute)}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3">
        <div />
        <div className="relative h-4 font-mono text-[10px] text-text-muted">
          {TIME_LABELS.map((label, index) => (
            <span
              key={label}
              className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
              style={{ left: `${index * 25}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        {isToday && (
          <div
            className="absolute top-0 bottom-0 w-px bg-amber z-10 pointer-events-none"
            style={{ left: `calc(9rem + 0.75rem + (100% - 9rem - 0.75rem) * ${nowPosition / 100})` }}
          />
        )}

        <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-3 py-1">
          <div className="text-sm font-medium">Team coverage</div>
          <Timeline availability={coverage} showGaps />
        </div>

        {agents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} dayIndex={dayIndex} />
        ))}
      </div>
    </article>
  );
}

export function CoverageChart({ agents }: CoverageChartProps) {
  const currentSlotIndex = useMemo(() => getCurrentSlotIndex(), []);
  const browserOffset = useMemo(() => getBrowserOffsetMinutes(), []);

  return (
    <section className="py-10">
      <div className="max-w-[1100px] mx-auto px-8">
        <h2 className="text-2xl">Coverage — Week View</h2>
        <p className="text-xs text-text-muted font-mono mt-1 mb-5">
          Browser time: {formatOffset(browserOffset)} · 30-minute slots · 7 days
        </p>

        <div className="bg-panel border border-line rounded-[var(--radius-card)] px-5">
          {DAYS.map((day, dayIndex) => (
            <DayBoard
              key={day}
              agents={agents}
              dayIndex={dayIndex}
              currentSlotIndex={currentSlotIndex}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
