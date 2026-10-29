import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { interval, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { ApiService } from '../core/api.service';
import { DayEntry, DayStatus, EntryKind, TabletResponse } from '../core/models';

/** Jadval qancha vaqtda yangilanadi. Soat esa har sekund mahalliy hisoblanadi. */
const POLL_MS = 30_000;

const KIND_LABEL: Record<EntryKind, string> = {
  lesson: 'Dars',
  exam: 'Imtihon',
  coffee_break: 'Tanaffus',
  lunch: 'Tushlik',
  club: 'To\'garak',
  free: 'Bo\'sh',
};

const WEEKDAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

type LoadResult = { data: TabletResponse } | { error: HttpErrorResponse };

@Component({
  selector: 'app-tablet-page',
  templateUrl: './tablet-page.html',
  styleUrl: './tablet-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabletPage {
  /** Xona tokeni — URL dan: /tablet/:token */
  readonly token = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = signal<TabletResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Oxirgi so'rov muvaffaqiyatsiz bo'ldi, lekin eski ma'lumot ko'rsatilib turibdi. */
  protected readonly stale = signal(false);
  /** Maktab vaqti bo'yicha "hozir" (serverdan olingan, mahalliy soat bilan yuritiladi). */
  protected readonly now = signal<Date | null>(null);

  protected readonly day = computed(() => this.data()?.day ?? null);
  protected readonly hero = computed(() => this.day()?.current ?? null);
  protected readonly next = computed(() => this.day()?.next ?? null);

  protected readonly clock = computed(() => {
    const d = this.now();
    return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '--:--';
  });

  protected readonly dateLabel = computed(() => {
    const day = this.day();
    if (!day) return '';
    const d = new Date(day.date + 'T00:00:00');
    return `${WEEKDAYS[day.weekday]}, ${d.getDate()}-${MONTHS[d.getMonth()]}`;
  });

  /** Joriy yozuv tugashiga qolgan daqiqalar. */
  protected readonly minutesLeft = computed(() => {
    const cur = this.hero();
    const d = this.now();
    if (!cur || !d) return null;
    return Math.max(0, Math.ceil((toMinutes(cur.end_time) * 60 - (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds())) / 60));
  });

  /** Joriy yozuvning o'tgan qismi, 0..100. */
  protected readonly progress = computed(() => {
    const cur = this.hero();
    const d = this.now();
    if (!cur || !d) return 0;
    const start = toMinutes(cur.start_time) * 60;
    const end = toMinutes(cur.end_time) * 60;
    const nowS = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    return Math.min(100, Math.max(0, ((nowS - start) / (end - start)) * 100));
  });

  protected readonly banner = computed(() => {
    const day = this.day();
    if (!day) return null;
    return bannerFor(day.status, day.title);
  });

  private serverOffsetMs = 0;

  constructor() {
    toObservable(this.token)
      .pipe(
        switchMap((token) =>
          interval(POLL_MS).pipe(
            startWith(0),
            switchMap(() =>
              this.api.tablet(token).pipe(
                map((data): LoadResult => ({ data })),
                catchError((error: HttpErrorResponse) => of<LoadResult>({ error })),
              ),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.apply(result));

    const tick = setInterval(() => this.tick(), 1000);
    this.destroyRef.onDestroy(() => clearInterval(tick));
  }

  protected kindLabel(kind: EntryKind): string {
    return KIND_LABEL[kind];
  }

  /** Kartochka yorlig'i: "2-dars", raqam bo'lmasa — tur nomi */
  protected heroLabel(e: DayEntry): string {
    return e.kind === 'lesson' && e.number ? `${e.number}-dars` : KIND_LABEL[e.kind];
  }

  private apply(result: LoadResult) {
    if ('data' in result) {
      this.data.set(result.data);
      this.error.set(null);
      this.stale.set(false);
      // Server maktab vaqtini zonasiz beradi; uni mahalliy soat bilan yuritamiz.
      this.serverOffsetMs = new Date(result.data.now).getTime() - Date.now();
      this.tick();
      return;
    }
    if (this.data()) {
      this.stale.set(true);
      return;
    }
    this.error.set(
      result.error.status === 404
        ? 'Xona topilmadi. Planshet tokeni noto\'g\'ri yoki bekor qilingan.'
        : 'Server bilan aloqa yo\'q.',
    );
  }

  private tick() {
    if (!this.data()) return;
    this.now.set(new Date(Date.now() + this.serverOffsetMs));
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function bannerFor(status: DayStatus, title: string): { text: string; tone: string } | null {
  switch (status) {
    case 'holiday':
      return { text: `Ta'til: ${title}`, tone: 'holiday' };
    case 'weekend':
      return { text: 'Dam olish kuni', tone: 'holiday' };
    case 'no_term':
      return { text: 'O\'quv davri emas', tone: 'holiday' };
    case 'exam':
      return { text: `Imtihon davri: ${title}`, tone: 'exam' };
    default:
      return null;
  }
}

export type { DayEntry };
