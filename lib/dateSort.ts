// Shared newest-to-oldest ordering for the Marketing, Sales and
// Interview & Screening tables.
//
// These three tables do not store dates the same way, which is why this lives
// in one place rather than being re-hand-rolled per component:
//
//  - `sales.date` and `marketing.date` are real Postgres `date` columns, so
//    they arrive as "YYYY-MM-DD".
//  - `interview_screening_entries.entry_date` is free TEXT holding whatever the
//    source sheet displayed — "Apr-30", "May-01", "June 16". Those carry no
//    year at all, and none can be invented for them.
//
// So a plain `new Date(x)` comparison is not safe here: it silently turns
// "May-01" into May 2001 (the exact corruption already seen in the imported
// workbook), which would scatter rows across two decades.

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Collapses a date of any of the shapes above into one comparable number
 * (year*10000 + month*100 + day).
 *
 * Yearless values get year 0, so they sort correctly against each other by
 * month/day and sit together as a block rather than being scattered by a
 * guessed year. In practice a table is all one shape or the other — the
 * Interview/Screening dates are entirely yearless, Marketing/Sales entirely
 * dated — so the two forms do not actually interleave.
 *
 * Unparseable or empty values return +Infinity so they sink to the bottom
 * instead of masquerading as the oldest rows.
 */
export function dateSortKey(value: unknown): number {
  const s = String(value ?? "").trim();
  if (!s) return Number.POSITIVE_INFINITY;

  // "YYYY-MM-DD", optionally with a time component.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return Number(iso[1]) * 10000 + Number(iso[2]) * 100 + Number(iso[3]);

  // "Apr-30", "May 1", "June 16" — month name first, no year. Checked before
  // the Date.parse fallback, which would read these as a year.
  const monthFirst = /^([A-Za-z]{3,9})[\s\-/.]+(\d{1,2})$/.exec(s);
  if (monthFirst) {
    const m = MONTHS[monthFirst[1].slice(0, 3).toLowerCase()];
    if (m) return m * 100 + Number(monthFirst[2]);
  }

  // "30-Apr", "16 June" — the same thing the other way round.
  const dayFirst = /^(\d{1,2})[\s\-/.]+([A-Za-z]{3,9})$/.exec(s);
  if (dayFirst) {
    const m = MONTHS[dayFirst[2].slice(0, 3).toLowerCase()];
    if (m) return m * 100 + Number(dayFirst[1]);
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  return Number.POSITIVE_INFINITY;
}

/**
 * Descending (most recent first) comparator.
 *
 * Two details this deliberately does not do:
 *  - It does not subtract the keys. Two unparseable rows would give
 *    Infinity - Infinity = NaN, which leaves Array.sort's order undefined.
 *  - It is not simply the ascending comparator negated. Undated rows carry
 *    +Infinity, so negating would float them to the TOP as though they were
 *    the most recent. They are pinned to the bottom in either direction
 *    instead, since an empty date is missing information, not a future one.
 */
export function compareDatesDesc(a: unknown, b: unknown): number {
  const ka = dateSortKey(a);
  const kb = dateSortKey(b);
  if (ka === kb) return 0;
  if (!Number.isFinite(ka)) return 1;
  if (!Number.isFinite(kb)) return -1;
  return ka > kb ? -1 : 1;
}
