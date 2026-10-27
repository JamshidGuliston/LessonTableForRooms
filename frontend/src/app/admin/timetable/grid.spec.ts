import { Lesson, Period } from '../../core/admin-models';
import { buildGrid, cellLines } from './grid';

const periods: Period[] = [
  { id: 1, order: 1, name: '1-dars', kind: 'lesson', start_time: '08:30:00', end_time: '09:15:00' },
  { id: 2, order: 2, name: 'Tanaffus', kind: 'coffee_break', start_time: '09:15:00', end_time: '09:25:00' },
  { id: 3, order: 3, name: '2-dars', kind: 'lesson', start_time: '09:25:00', end_time: '10:10:00' },
];

function lesson(over: Partial<Lesson>): Lesson {
  return {
    id: 1, term: 1, weekday: 0, period: 1, rooms: [1], subjects: [1], groups: [1], teachers: [1],
    subject_name: 'Matematika', group_name: '7-A', teacher_name: 'Karimov B.', room_name: '101',
    start_time: '08:30', end_time: '09:15', ...over,
  };
}

describe('buildGrid', () => {
  it('makes one row per period in time order, breaks without cells', () => {
    const rows = buildGrid([periods[2], periods[0], periods[1]], [], [0, 1, 2]);
    expect(rows.map((r) => r.period.name)).toEqual(['1-dars', 'Tanaffus', '2-dars']);
    expect(rows[0].cells.length).toBe(3);
    expect(rows[1].isBreak).toBe(true);
    expect(rows[1].cells).toEqual([]);
  });

  it('places each lesson in its period row and weekday column', () => {
    const a = lesson({ id: 10, weekday: 0, period: 1 });
    const b = lesson({ id: 11, weekday: 2, period: 3 });
    const rows = buildGrid(periods, [a, b], [0, 1, 2]);
    expect(rows[0].cells.map((c) => c.lesson?.id ?? null)).toEqual([10, null, null]);
    expect(rows[2].cells.map((c) => c.lesson?.id ?? null)).toEqual([null, null, 11]);
    expect(rows[2].cells[1]).toEqual({ weekday: 1, lesson: null });
  });

  it('ignores lessons on non-working weekdays', () => {
    const rows = buildGrid(periods, [lesson({ weekday: 6 })], [0, 1, 2]);
    expect(rows[0].cells.every((c) => c.lesson === null)).toBe(true);
  });
});

describe('cellLines', () => {
  const l = lesson({});
  it('hides the dimension the grid is filtered by', () => {
    expect(cellLines(l, 'group')).toEqual({ title: 'Matematika', sub: 'Karimov B. · 101' });
    expect(cellLines(l, 'teacher')).toEqual({ title: 'Matematika', sub: '7-A · 101' });
    expect(cellLines(l, 'room')).toEqual({ title: 'Matematika', sub: '7-A · Karimov B.' });
  });
});
