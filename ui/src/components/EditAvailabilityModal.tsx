import { useEffect, useState } from 'react';
import type { Agent, LocalAvailabilityWindow } from '../types';
import {
  DAY_NAMES,
  END_TIME_OPTIONS,
  START_TIME_OPTIONS,
  UTC_OFFSET_OPTIONS,
  createEditableWindow,
  formatMinuteOfDay,
  toEditableWindows,
  validateEditableWindows,
  type EditableWindow,
} from '../lib/schedule';

interface EditAvailabilityModalProps {
  agent: Agent;
  onClose: () => void;
  onSave: (
    agentId: string,
    utcOffsetMinutes: number,
    windows: LocalAvailabilityWindow[],
  ) => Promise<void>;
}

export function EditAvailabilityModal({ agent, onClose, onSave }: EditAvailabilityModalProps) {
  const [utcOffsetMinutes, setUtcOffsetMinutes] = useState(agent.utcOffsetMinutes);
  const [windows, setWindows] = useState<EditableWindow[]>(() =>
    toEditableWindows(agent.availabilityWindows, agent.utcOffsetMinutes),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  function updateWindow(key: string, patch: Partial<EditableWindow>) {
    setWindows((prev) => prev.map((w) => (w.key === key ? { ...w, ...patch } : w)));
  }

  function removeWindow(key: string) {
    setWindows((prev) => prev.filter((w) => w.key !== key));
  }

  function addWindow(dayOfWeek: number) {
    setWindows((prev) => [...prev, createEditableWindow(dayOfWeek)]);
  }

  async function handleSave() {
    const validationError = validateEditableWindows(windows);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: LocalAvailabilityWindow[] = windows.map(
        ({ dayOfWeek, startMinute, endMinute }) => ({
          dayOfWeek,
          startMinute,
          endMinute,
        }),
      );
      await onSave(agent.id, utcOffsetMinutes, payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  }

  const offsetInList = UTC_OFFSET_OPTIONS.some((o) => o.value === utcOffsetMinutes);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/80 px-4 py-10"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-availability-title"
        className="w-full max-w-2xl bg-panel border border-line rounded-[var(--radius-card)] shadow-xl"
      >
        <div className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="edit-availability-title" className="text-xl">
              Edit availability
            </h2>
            <p className="font-mono text-xs text-text-muted mt-1">{agent.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-text-muted hover:text-text text-sm"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
              Timezone (fixed UTC offset)
            </span>
            <select
              value={utcOffsetMinutes}
              onChange={(e) => setUtcOffsetMinutes(Number(e.target.value))}
              className="mt-1.5 w-full bg-ink border border-line rounded-md px-3 py-2 text-sm text-text"
            >
              {!offsetInList && (
                <option value={utcOffsetMinutes}>UTC custom ({utcOffsetMinutes})</option>
              )}
              {UTC_OFFSET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-4">
            {DAY_NAMES.map((dayName, dayOfWeek) => {
              const dayWindows = windows.filter((w) => w.dayOfWeek === dayOfWeek);
              return (
                <div key={dayName} className="border border-line rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-text">{dayName}</p>
                    <button
                      type="button"
                      onClick={() => addWindow(dayOfWeek)}
                      className="text-amber text-xs font-semibold hover:underline"
                    >
                      + Add window
                    </button>
                  </div>

                  {dayWindows.length === 0 ? (
                    <p className="text-xs text-text-muted italic">No windows</p>
                  ) : (
                    <ul className="space-y-2">
                      {dayWindows.map((w) => {
                        const startOptions = START_TIME_OPTIONS.includes(w.startMinute)
                          ? START_TIME_OPTIONS
                          : [...START_TIME_OPTIONS, w.startMinute].sort((a, b) => a - b);
                        const endOptions = END_TIME_OPTIONS.includes(w.endMinute)
                          ? END_TIME_OPTIONS
                          : [...END_TIME_OPTIONS, w.endMinute].sort((a, b) => a - b);

                        return (
                          <li key={w.key} className="flex flex-wrap items-center gap-2">
                            <select
                              value={w.startMinute}
                              onChange={(e) =>
                                updateWindow(w.key, { startMinute: Number(e.target.value) })
                              }
                              className="bg-ink border border-line rounded-md px-2 py-1.5 font-mono text-xs"
                            >
                              {startOptions.map((m) => (
                                <option key={m} value={m}>
                                  {formatMinuteOfDay(m)}
                                </option>
                              ))}
                            </select>
                            <span className="text-text-muted text-xs">to</span>
                            <select
                              value={w.endMinute}
                              onChange={(e) =>
                                updateWindow(w.key, { endMinute: Number(e.target.value) })
                              }
                              className="bg-ink border border-line rounded-md px-2 py-1.5 font-mono text-xs"
                            >
                              {endOptions.map((m) => (
                                <option key={m} value={m}>
                                  {formatMinuteOfDay(m)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeWindow(w.key)}
                              className="ml-auto text-rust text-xs font-semibold hover:underline"
                            >
                              Remove
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {error && <p className="text-sm text-rust">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-md border border-line text-text-muted text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-amber text-ink font-semibold text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
