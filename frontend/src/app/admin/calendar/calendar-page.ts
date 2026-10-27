import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AcademicYear, Break, ExamSession, Term } from '../../core/admin-models';
import { ApiErrors, apiErrors } from '../../core/errors';
import { rangeLabel, shortDate, todayIso } from '../../core/format';
import { SchoolApi } from '../../core/school-api';
import { SchoolContext } from '../../core/school-context';
import { Confirm } from '../../shared/confirm';
import { Icon } from '../../shared/icon';
import { Toasts } from '../../shared/toast';
import { PageHead } from '../shell/page-head';
import { SpanInput, buildTimeline } from './timeline';

type Kind = 'year' | 'term' | 'break' | 'exam';

const RESOURCE: Record<Kind, string> = {
  year: 'academic-years', term: 'terms', break: 'breaks', exam: 'exam-sessions',
};
const TITLE: Record<Kind, string> = {
  year: "O'quv yili", term: 'Chorak', break: "Ta'til", exam: 'Imtihon davri',
};

interface Draft {
  kind: Kind;
  id: number | null;
  name: string;
  start_date: string;
  end_date: string;
  exam_kind: 'midterm' | 'final';
}

@Component({
  selector: 'app-calendar-page',
  imports: [PageHead, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
})
export class CalendarPage {
  private readonly api = inject(SchoolApi);
  private readonly toasts = inject(Toasts);
  private readonly confirm = inject(Confirm);
  protected readonly ctx = inject(SchoolContext);

  protected readonly years = signal<AcademicYear[]>([]);
  protected readonly terms = signal<Term[]>([]);
  protected readonly breaks = signal<Break[]>([]);
  protected readonly sessions = signal<ExamSession[]>([]);
  protected readonly yearId = signal<number | null>(null);
  protected readonly loading = signal(true);

  protected readonly draft = signal<Draft | null>(null);
  protected readonly errors = signal<ApiErrors | null>(null);
  protected readonly saving = signal(false);

  protected readonly TITLE = TITLE;
  protected readonly rangeLabel = rangeLabel;
  protected readonly shortDate = shortDate;
  protected readonly today = todayIso();

  protected readonly year = computed(() => this.years().find((y) => y.id === this.yearId()) ?? null);

  private inYear<T extends { start_date: string; end_date: string }>(list: T[]): T[] {
    const y = this.year();
    if (!y) return [];
    return list.filter((x) => x.end_date >= y.start_date && x.start_date <= y.end_date);
  }

  protected readonly yearTerms = computed(() => this.terms().filter((t) => t.academic_year === this.yearId()));
  protected readonly yearBreaks = computed(() => this.inYear(this.breaks()));
  protected readonly yearSessions = computed(() => this.inYear(this.sessions()));

  protected readonly timeline = computed(() => {
    const y = this.year();
    if (!y) return null;
    const items: SpanInput[] = [
      ...this.yearTerms().map((t) => ({ ...t, kind: 'term' as const })),
      ...this.yearBreaks().map((b) => ({ ...b, kind: 'break' as const })),
      ...this.yearSessions().map((s) => ({ ...s, kind: 'exam' as const })),
    ];
    return buildTimeline(y, items, this.today);
  });

  constructor() {
    effect(() => {
      const slug = this.ctx.slug();
      if (slug) void this.load(slug);
    });
  }

  private async load(slug: string) {
    this.loading.set(true);
    try {
      const [years, terms, breaks, sessions] = await Promise.all([
        this.api.list<AcademicYear>(slug, 'academic-years'),
        this.api.list<Term>(slug, 'terms'),
        this.api.list<Break>(slug, 'breaks'),
        this.api.list<ExamSession>(slug, 'exam-sessions'),
      ]);
      this.years.set(years);
      this.terms.set(terms);
      this.breaks.set(breaks);
      this.sessions.set(sessions);
      if (!years.some((y) => y.id === this.yearId())) {
        const current = years.find((y) => y.start_date <= this.today && this.today <= y.end_date) ?? years[years.length - 1];
        this.yearId.set(current?.id ?? null);
      }
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Yuklab bo\'lmadi');
    } finally {
      this.loading.set(false);
    }
  }

  protected openNew(kind: Kind) {
    const y = this.year();
    this.errors.set(null);
    this.draft.set({
      kind, id: null, name: '', exam_kind: 'midterm',
      start_date: kind === 'year' ? '' : (y?.start_date ?? ''),
      end_date: kind === 'year' ? '' : (y?.start_date ?? ''),
    });
  }

  protected openEdit(kind: Kind, item: { id: number; name: string; start_date: string; end_date: string; kind?: string }) {
    this.errors.set(null);
    this.draft.set({
      kind, id: item.id, name: item.name, start_date: item.start_date, end_date: item.end_date,
      exam_kind: (item.kind as Draft['exam_kind']) ?? 'midterm',
    });
  }

  protected patch(p: Partial<Draft>) {
    this.draft.update((d) => (d ? { ...d, ...p } : d));
  }

  protected close() {
    this.draft.set(null);
    this.errors.set(null);
  }

  /** Bir xil turdagi boshqa oraliq bilan kesishish — saqlashdan oldin ogohlantirish. */
  protected readonly overlap = computed(() => {
    const d = this.draft();
    if (!d || !d.start_date || !d.end_date) return null;
    const pool: { id: number; name: string; start_date: string; end_date: string }[] =
      d.kind === 'term' ? this.yearTerms() : d.kind === 'break' ? this.breaks() : d.kind === 'exam' ? this.sessions() : this.years();
    return pool.find((x) => x.id !== d.id && x.start_date <= d.end_date && d.start_date <= x.end_date) ?? null;
  });

  protected async save() {
    const d = this.draft();
    if (!d) return;
    const body: Record<string, unknown> = { name: d.name, start_date: d.start_date, end_date: d.end_date };
    if (d.kind === 'term') body['academic_year'] = this.yearId();
    if (d.kind === 'exam') body['kind'] = d.exam_kind;
    this.saving.set(true);
    try {
      const saved = d.id
        ? await this.api.update<{ id: number }>(this.ctx.slug(), RESOURCE[d.kind], d.id, body)
        : await this.api.create<{ id: number }>(this.ctx.slug(), RESOURCE[d.kind], body);
      if (d.kind === 'year') this.yearId.set(saved.id);
      this.toasts.ok('Saqlandi');
      this.close();
      await this.load(this.ctx.slug());
    } catch (e) {
      this.errors.set(apiErrors(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove() {
    const d = this.draft();
    if (!d?.id) return;
    const ok = await this.confirm.ask({
      title: `"${d.name}" o'chirilsinmi?`,
      text: d.kind === 'term' || d.kind === 'year'
        ? "Shu davrga tegishli butun dars jadvali ham o'chadi."
        : d.kind === 'exam' ? "Shu davrdagi barcha imtihonlar ham o'chadi." : "Bu amalni qaytarib bo'lmaydi.",
      ok: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.remove(this.ctx.slug(), RESOURCE[d.kind], d.id);
      this.toasts.ok("O'chirildi");
      this.close();
      await this.load(this.ctx.slug());
    } catch (e) {
      this.errors.set(apiErrors(e));
    }
  }
}
