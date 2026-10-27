export type SpanKind = 'term' | 'break' | 'exam';

export interface SpanInput {
  name: string;
  kind: SpanKind;
  start_date: string;
  end_date: string;
}

export interface Span extends SpanInput {
  /** Foiz: 0..100 */
  left: number;
  width: number;
}

export interface Timeline {
  spans: Span[];
  months: { label: string; left: number }[];
  today: number | null;
}

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
const DAY = 86_400_000;

function utc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** O'quv yili chizig'i: choraklar, ta'tillar, imtihon davrlari yil ichidagi foiz o'rinlarda. */
export function buildTimeline(
  year: { start_date: string; end_date: string },
  items: SpanInput[],
  todayIso: string,
): Timeline {
  const start = utc(year.start_date);
  const end = utc(year.end_date) + DAY; // oxirgi kun ham kiradi
  const total = end - start;
  const pct = (t: number) => ((t - start) / total) * 100;

  const spans: Span[] = [];
  for (const item of items) {
    const s = Math.max(utc(item.start_date), start);
    const e = Math.min(utc(item.end_date) + DAY, end);
    if (e <= s) continue;
    spans.push({ ...item, left: pct(s), width: pct(e) - pct(s) });
  }

  const months: { label: string; left: number }[] = [];
  const first = new Date(start);
  for (let y = first.getUTCFullYear(), m = first.getUTCMonth(); ; m++) {
    const t = Date.UTC(y, m, 1);
    if (t >= end) break;
    if (t >= start) months.push({ label: MONTHS[new Date(t).getUTCMonth()], left: pct(t) });
  }

  const today = utc(todayIso);
  return { spans, months, today: today >= start && today < end ? pct(today) : null };
}
