import { Lesson, Period } from '../../core/admin-models';

export type GridView = 'group' | 'teacher' | 'room';

export interface GridCell {
  weekday: number;
  lesson: Lesson | null;
}

export interface GridRow {
  period: Period;
  isBreak: boolean;
  /** Tanaffus qatorlarida bo'sh */
  cells: GridCell[];
}

/** Haftalik jadval to'ri: qatorlar — qo'ng'iroq jadvali, ustunlar — ish kunlari. */
export function buildGrid(periods: Period[], lessons: Lesson[], weekdays: number[]): GridRow[] {
  const byKey = new Map<string, Lesson>();
  for (const l of lessons) byKey.set(`${l.period}:${l.weekday}`, l);

  return [...periods]
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((period) => {
      const isBreak = period.kind !== 'lesson';
      return {
        period,
        isBreak,
        cells: isBreak ? [] : weekdays.map((weekday) => ({ weekday, lesson: byKey.get(`${period.id}:${weekday}`) ?? null })),
      };
    });
}

/** Katakchadagi matn: tanlangan o'lcham (masalan guruh) takrorlanmaydi. */
export function cellLines(l: Lesson, view: GridView): { title: string; sub: string } {
  const parts: Record<GridView, string[]> = {
    group: [l.teacher_name, l.room_name],
    teacher: [l.group_name, l.room_name],
    room: [l.group_name, l.teacher_name],
  };
  return { title: l.subject_name, sub: parts[view].join(' · ') };
}
