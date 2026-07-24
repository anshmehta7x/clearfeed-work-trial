export interface AvailabilityWindow {
  startMinuteUtc: number;
  durationMinutes: number;
}

export interface LocalAvailabilityWindow {
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  startMinute: number; // 0..1439
  endMinute: number; // 1..1440
}

export interface UpdateAvailabilityRequest {
  utcOffsetMinutes: number;
  windows: LocalAvailabilityWindow[];
}
