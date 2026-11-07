/** Stable UTC output avoids server/client locale and timezone differences. */
export function DuelDate({ value }: { value: Date | string | null | undefined }) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) {
    return <small className="duel-date">Completion date unavailable</small>;
  }
  const iso = date.toISOString();
  const label = new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    hourCycle: "h23", timeZone: "UTC",
  }).format(date);
  return <small className="duel-date">Completed <time dateTime={iso}>{label} UTC</time></small>;
}
