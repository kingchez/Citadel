export type ScheduleKind = "duty" | "meeting" | "task" | "other";
export type ScheduleRepeat = "none" | "daily" | "weekly";
export type ScheduleStatus = "upcoming" | "done" | "missed";

export interface ScheduleItem {
  id: string;
  title: string;
  notes: string | null;
  kind: ScheduleKind;
  /** Start of the upcoming occurrence (UTC ISO). Repeating items roll this forward. */
  next_at: string;
  /** Original start the item was created with. */
  first_at: string;
  duration_minutes: number;
  remind_before_minutes: number;
  repeat: ScheduleRepeat;
  repeat_until: string | null;
  status: ScheduleStatus;
  active: boolean;
  last_notified_at: string | null;
  notify_count: number;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
}

export const KINDS: ScheduleKind[] = ["duty", "meeting", "task", "other"];
export const KIND_LABEL: Record<ScheduleKind, string> = {
  duty: "Duty",
  meeting: "Meeting",
  task: "Task",
  other: "Other",
};

export const REPEATS: ScheduleRepeat[] = ["none", "daily", "weekly"];
export const REPEAT_LABEL: Record<ScheduleRepeat, string> = {
  none: "Once",
  daily: "Every day",
  weekly: "Every week",
};

export const REMIND_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "At start time" },
  { value: 5, label: "5 min before" },
  { value: 10, label: "10 min before" },
  { value: 15, label: "15 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 1440, label: "1 day before" },
];

export const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "No duration" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 480, label: "8 hours" },
];
