import { buildTimeline } from './timeline';

describe('buildTimeline', () => {
  const year = { start_date: '2026-09-01', end_date: '2027-06-30' };

  it('positions spans as percentages of the academic year', () => {
    const t = buildTimeline(year, [
      { name: '1-chorak', kind: 'term', start_date: '2026-09-01', end_date: '2026-10-31' },
    ], '2026-10-22');
    const s = t.spans[0];
    expect(s.left).toBe(0);
    // 61 kun / 303 kun
    expect(s.width).toBeCloseTo((61 / 303) * 100, 1);
    expect(s.kind).toBe('term');
  });

  it('clips spans that leave the year and drops spans fully outside', () => {
    const t = buildTimeline(year, [
      { name: 'Yozgi', kind: 'break', start_date: '2027-06-07', end_date: '2027-09-01' },
      { name: 'Eski', kind: 'break', start_date: '2025-01-01', end_date: '2025-02-01' },
    ], '2026-10-22');
    expect(t.spans.length).toBe(1);
    expect(t.spans[0].left + t.spans[0].width).toBeCloseTo(100, 5);
  });

  it('labels each month start and marks today', () => {
    const t = buildTimeline(year, [], '2026-10-22');
    expect(t.months.map((m) => m.label)).toEqual(['Sen', 'Okt', 'Noy', 'Dek', 'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun']);
    expect(t.months[0].left).toBe(0);
    expect(t.today).toBeCloseTo((51 / 303) * 100, 1);
  });

  it('today is null outside the year', () => {
    expect(buildTimeline(year, [], '2027-08-01').today).toBeNull();
  });
});
