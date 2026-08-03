export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export const FLOW_SHADES = [
  { bg: "#f3e8ff", fg: "#6b21a8" }, // untapped — pale lavender
  { bg: "#d8b4fe", fg: "#581c87" }, // 1 tap
  { bg: "#a855f7", fg: "#ffffff" }, // 2 taps
  { bg: "#7e22ce", fg: "#ffffff" }, // 3 taps — deep purple
];

export const END_REASON_META: Record<
  string,
  { emoji: string; label: string }
> = {
  natural_completion: { emoji: "✓", label: "Finished" },
  blocker: { emoji: "🚧", label: "Blocked" },
  switched_early: { emoji: "↪", label: "Switched early" },
  sleep: { emoji: "😴", label: "Sleep" },
  forced_stop: { emoji: "⏸", label: "Forced stop" },
};

export function formatDayLabel(isoDate: string): string {
  const date = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}