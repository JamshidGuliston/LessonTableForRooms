import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DayEntry, TabletResponse } from '../core/models';
import { TabletPage } from './tablet-page';

function entry(over: Partial<DayEntry>): DayEntry {
  return {
    kind: 'lesson',
    title: 'Matematika',
    start_time: '08:30',
    end_time: '09:15',
    group: '7-A',
    teacher: 'Aliyev A.',
    subject_color: null,
    image: null,
    group_ids: [],
    status: 'upcoming',
    ...over,
  };
}

function response(over: Partial<TabletResponse['day']>, quote: TabletResponse['quote'] = null): TabletResponse {
  return {
    quote,
    school: { slug: 'demo', name: 'Demo maktab', timezone: 'Asia/Tashkent', working_days: '0,1,2,3,4,5' },
    room: { id: 1, name: '101', floor: '1' },
    now: '2025-10-20T09:35:00',
    day: {
      date: '2025-10-20',
      weekday: 0,
      status: 'lesson',
      title: '1-chorak',
      entries: [],
      current: null,
      next: null,
      ...over,
    },
  };
}

describe('TabletPage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<TabletPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabletPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
  });

  async function render(payload: TabletResponse): Promise<HTMLElement> {
    fixture = TestBed.createComponent(TabletPage);
    fixture.componentRef.setInput('token', 'tok123');
    await fixture.whenStable();
    http.expectOne('/api/tablet/tok123/').flush(payload);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows room and school name', async () => {
    const el = await render(response({}));
    expect(el.querySelector('.room-name')?.textContent).toContain('101');
    expect(el.querySelector('.school-name')?.textContent).toContain('Demo maktab');
  });

  it('highlights the active entry and shows it in the hero card', async () => {
    const active = entry({ title: 'Fizika', start_time: '09:30', end_time: '10:15', status: 'active' });
    const el = await render(
      response({
        entries: [entry({ status: 'past' }), active, entry({ title: 'Kimyo', start_time: '10:45', end_time: '11:30' })],
        current: active,
        next: entry({ title: 'Kimyo', start_time: '10:45', end_time: '11:30' }),
      }),
    );
    const rows = el.querySelectorAll('.entry');
    expect(rows.length).toBe(3);
    expect(rows[1].classList).toContain('active');
    expect(rows[0].classList).toContain('past');
    expect(el.querySelector('.hero .hero-title')?.textContent).toContain('Fizika');
    expect(el.querySelector('.hero .hero-next')?.textContent).toContain('Kimyo');
  });

  it('shows "free" hero when nothing is happening now', async () => {
    const el = await render(response({ entries: [entry({})], next: entry({}) }));
    expect(el.querySelector('.hero')?.classList).toContain('free');
    expect(el.querySelector('.hero .hero-next')?.textContent).toContain('Matematika');
  });

  it('shows holiday banner instead of entries', async () => {
    const el = await render(response({ status: 'holiday', title: "Kuzgi ta'til" }));
    expect(el.querySelector('.day-banner')?.textContent).toContain("Kuzgi ta'til");
    expect(el.querySelectorAll('.entry').length).toBe(0);
  });

  it('marks exam day and labels exam entries', async () => {
    const exam = entry({ kind: 'exam', title: 'Ona tili', group: '9-B', status: 'active' });
    const el = await render(response({ status: 'exam', title: 'Yarim yillik imtihonlar', entries: [exam], current: exam }));
    expect(el.querySelector('.day-banner')?.textContent).toContain('Yarim yillik imtihonlar');
    expect(el.querySelector('.entry.exam')).not.toBeNull();
    expect(el.querySelector('.hero .hero-kind')?.textContent).toContain('Imtihon');
  });

  it('labels club entries and styles the hero as a club', async () => {
    const club = entry({ kind: 'club', title: 'Shaxmat', group: null, teacher: 'Rahimov S.', start_time: '14:00', end_time: '15:30', status: 'active' });
    const el = await render(response({ entries: [entry({ status: 'past' }), club], current: club }));
    expect(el.querySelector('.entry.club .kind')?.textContent).toContain("To'garak");
    expect(el.querySelector('.hero')?.classList).toContain('club');
    expect(el.querySelector('.hero .hero-title')?.textContent).toContain('Shaxmat');
  });

  it('lists empty lesson periods as "Bo\'sh"', async () => {
    const free = entry({ kind: 'free', title: "Xona bo'sh", group: null, teacher: null, start_time: '14:50', end_time: '15:35' });
    const el = await render(response({ entries: [entry({}), free] }));
    expect(el.querySelector('.entry.free .title')?.textContent).toContain("Xona bo'sh");
    expect(el.querySelector('.entry.free .kind')?.textContent).toContain("Bo'sh");
  });

  it('shows the quote with its author after the list', async () => {
    const el = await render(response({ entries: [entry({})] }, { text: 'Yoshlar bizning tayanchimiz', author: 'Sh. Mirziyoyev', image: null }));
    expect(el.querySelector('.quote blockquote')?.textContent).toContain('Yoshlar bizning tayanchimiz');
    expect(el.querySelector('.quote figcaption')?.textContent).toContain('Sh. Mirziyoyev');
  });

  it('shows the author photo on the left of the quote', async () => {
    const el = await render(response({ entries: [entry({})] }, { text: 'Ilm — nur', author: 'Navoiy', image: '/media/quotes/n.jpg' }));
    const quote = el.querySelector('.quote.with-image')!;
    expect(quote.firstElementChild?.getAttribute('src')).toBe('/media/quotes/n.jpg');
  });

  it('shows the group portrait in the hero during the lesson', async () => {
    const active = entry({ status: 'active', image: '/media/groups/fargoniy.jpg', group: "8-02 Ahmad al-Farg'oniy" });
    const el = await render(response({ entries: [active], current: active }));
    expect(el.querySelector('.hero .portrait')?.getAttribute('src')).toBe('/media/groups/fargoniy.jpg');
  });

  it('shows no quote block when the school has none', async () => {
    const el = await render(response({}));
    expect(el.querySelector('.quote')).toBeNull();
  });

  it('shows an error state when the token is unknown', async () => {
    fixture = TestBed.createComponent(TabletPage);
    fixture.componentRef.setInput('token', 'bad');
    await fixture.whenStable();
    http.expectOne('/api/tablet/bad/').flush({ detail: 'Not found' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.error')?.textContent).toContain('topilmadi');
  });
});
