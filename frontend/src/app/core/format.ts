export const WEEKDAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
export const WEEKDAYS_SHORT = ['Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan', 'Yak'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];

/** "08:30:00" → "08:30" */
export function hm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : '';
}

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d, weekday: (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7 };
}

/** "Payshanba, 22-oktabr" */
export function dayLabel(iso: string): string {
  const p = parts(iso);
  return `${WEEKDAYS[p.weekday]}, ${p.d}-${MONTHS[p.m - 1]}`;
}

/** "22-okt" */
export function shortDate(iso: string): string {
  const p = parts(iso);
  return `${p.d}-${MONTHS_SHORT[p.m - 1]}`;
}

/** "3–9 noy", "27-dek – 11-yan" */
export function rangeLabel(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS_SHORT[a.m - 1]}`;
  return `${shortDate(start)} – ${shortDate(end)}`;
}

/** Ish kunlari: "0,1,2" → [0,1,2] */
export function parseDays(s: string): number[] {
  return s.split(',').filter((x) => x.trim() !== '').map(Number).sort((a, b) => a - b);
}

/** "hozir", "5 daqiqa oldin", "3 soat oldin", "22-okt" */
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return '—';
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'hozir';
  if (min < 60) return `${min} daqiqa oldin`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} soat oldin`;
  return shortDate(new Date(iso).toISOString());
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
