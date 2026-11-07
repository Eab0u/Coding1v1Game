/** Stable UTC output avoids server/client locale and timezone differences. */
export function DuelDate({ value }: { value: Date | string | null | undefined }) {
  // Persisted strings must identify an instant. Date-only and timezone-free
  // timestamps otherwise depend on parsing rules or the renderer's timezone.
  const parts = typeof value === "string"
    ? /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value)
    : null;
  // Date parsing normalizes impossible days (for example February 30) into
  // another month. Validate the written calendar date before parsing its offset.
  const year = Number(parts?.[1]);
  const month = Number(parts?.[2]);
  const day = Number(parts?.[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const absolute = parts !== null && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
  const date = value instanceof Date || absolute ? new Date(value!) : null;
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
