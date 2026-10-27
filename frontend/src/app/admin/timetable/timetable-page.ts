import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Group, Lesson, Period, Room, Subject, Teacher, Term } from '../../core/admin-models';
import { ApiErrors, apiErrors } from '../../core/errors';
import { WEEKDAYS, WEEKDAYS_SHORT, hm, parseDays, rangeLabel, todayIso } from '../../core/format';
import { SchoolApi } from '../../core/school-api';
import { SchoolContext } from '../../core/school-context';
import { Confirm } from '../../shared/confirm';
import { Icon } from '../../shared/icon';
import { Toasts } from '../../shared/toast';
import { PageHead } from '../shell/page-head';
import { GridView, buildGrid, cellLines } from './grid';

interface Draft {
  id: number | null;
  weekday: number;
  period: number;
  subject: number | null;
  teacher: number | null;
  room: number | null;
  group: number | null;
}

const VIEW_FIELD: Record<GridView, 'group' | 'teacher' | 'room'> = { group: 'group', teacher: 'teacher', room: 'room' };

@Component({
  selector: 'app-timetable-page',
  imports: [PageHead, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timetable-page.html',
  styleUrl: './timetable-page.scss',
})
export class TimetablePage {
  private readonly api = inject(SchoolApi);
  private readonly toasts = inject(Toasts);
  private readonly confirm = inject(Confirm);
  protected readonly ctx = inject(SchoolContext);

  protected readonly terms = signal<Term[]>([]);
  protected readonly periods = signal<Period[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly teachers = signal<Teacher[]>([]);
  protected readonly rooms = signal<Room[]>([]);
  protected readonly groups = signal<Group[]>([]);
  protected readonly lessons = signal<Lesson[]>([]);
  protected readonly weekdays = signal<number[]>([0, 1, 2, 3, 4, 5]);

  protected readonly termId = signal<number | null>(null);
  protected readonly view = signal<GridView>('group');
  protected readonly entityId = signal<number | null>(null);

  protected readonly draft = signal<Draft | null>(null);
  protected readonly errors = signal<ApiErrors | null>(null);
  protected readonly saving = signal(false);
  protected readonly copyOpen = signal(false);
  protected copyFrom: number | null = null;
  protected readonly loading = signal(true);

  protected readonly WEEKDAYS = WEEKDAYS;
  protected readonly WEEKDAYS_SHORT = WEEKDAYS_SHORT;
  protected readonly hm = hm;
  protected readonly rangeLabel = rangeLabel;
  protected readonly todayWeekday = (new Date().getDay() + 6) % 7;

  protected readonly entities = computed<{ id: number; name: string }[]>(() => {
    switch (this.view()) {
      case 'group': return this.groups();
      case 'teacher': return this.teachers().map((t) => ({ id: t.id, name: t.full_name }));
      case 'room': return this.rooms();
    }
  });

  protected readonly grid = computed(() => buildGrid(this.periods(), this.lessons(), this.weekdays()));
  protected readonly colorBySubject = computed(() => new Map(this.subjects().map((s) => [s.id, s.color || null])));
  protected readonly draftPeriod = computed(() => this.periods().find((p) => p.id === this.draft()?.period) ?? null);
  protected readonly lessonPeriods = computed(() => this.periods().filter((p) => p.kind === 'lesson'));
  protected readonly currentTerm = computed(() => this.terms().find((t) => t.id === this.termId()) ?? null);

  constructor() {
    effect(() => {
      const slug = this.ctx.slug();
      if (slug) void this.loadRefs(slug);
    });
    effect(() => {
      const slug = this.ctx.slug();
      const term = this.termId();
      const entity = this.entityId();
      const field = VIEW_FIELD[this.view()];
      if (slug && term && entity) void this.loadLessons(slug, term, field, entity);
      else this.lessons.set([]);
    });
  }

  private async loadRefs(slug: string) {
    this.loading.set(true);
    try {
      const [terms, periods, subjects, teachers, rooms, groups, settings] = await Promise.all([
        this.api.list<Term>(slug, 'terms'),
        this.api.list<Period>(slug, 'periods'),
        this.api.list<Subject>(slug, 'subjects'),
        this.api.list<Teacher>(slug, 'teachers'),
        this.api.list<Room>(slug, 'rooms'),
        this.api.list<Group>(slug, 'groups'),
        this.api.settings(slug),
      ]);
      this.terms.set(terms);
      this.periods.set(periods);
      this.subjects.set(subjects);
      this.teachers.set(teachers);
      this.rooms.set(rooms);
      this.groups.set(groups);
      this.weekdays.set(parseDays(settings.working_days));
      // Bugungi chorak, bo'lmasa oxirgisi
      const today = todayIso();
      const current = terms.find((t) => t.start_date <= today && today <= t.end_date) ?? terms[terms.length - 1];
      this.termId.set(current?.id ?? null);
      this.entityId.set(this.entities()[0]?.id ?? null);
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Yuklab bo\'lmadi');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadLessons(slug: string, term: number, field: string, entity: number) {
    try {
      this.lessons.set(await this.api.list<Lesson>(slug, 'lessons', { term, [field]: entity }));
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Jadvalni yuklab bo\'lmadi');
    }
  }

  protected setView(v: GridView) {
    this.view.set(v);
    this.entityId.set(this.entities()[0]?.id ?? null);
    this.close();
  }

  protected lines(l: Lesson) {
    return cellLines(l, this.view());
  }

  protected openNew(weekday: number, period: number) {
    if (!this.ctx.isAdmin()) return;
    const field = VIEW_FIELD[this.view()];
    this.errors.set(null);
    this.draft.set({
      id: null, weekday, period, subject: null, teacher: null, room: null, group: null,
      [field]: this.entityId(),
    });
  }

  protected openEdit(l: Lesson) {
    if (!this.ctx.isAdmin()) return;
    this.errors.set(null);
    this.draft.set({ id: l.id, weekday: l.weekday, period: l.period, subject: l.subject, teacher: l.teacher, room: l.room, group: l.group });
  }

  protected openAdd() {
    const first = this.lessonPeriods()[0];
    if (first) this.openNew(this.weekdays()[0] ?? 0, first.id);
  }

  protected patch(p: Partial<Draft>) {
    this.draft.update((d) => (d ? { ...d, ...p } : d));
  }

  protected close() {
    this.draft.set(null);
    this.errors.set(null);
  }

  protected async save() {
    const d = this.draft();
    const term = this.termId();
    if (!d || !term) return;
    this.saving.set(true);
    this.errors.set(null);
    const body = { term, weekday: d.weekday, period: d.period, subject: d.subject, teacher: d.teacher, room: d.room, group: d.group };
    try {
      if (d.id) await this.api.update<Lesson>(this.ctx.slug(), 'lessons', d.id, body);
      else await this.api.create<Lesson>(this.ctx.slug(), 'lessons', body);
      this.toasts.ok('Jadval saqlandi');
      this.close();
      await this.reload();
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
      title: "Dars o'chirilsinmi?",
      text: `${WEEKDAYS[d.weekday]} · ${this.draftPeriod()?.name ?? ''}`,
      ok: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    this.saving.set(true);
    try {
      await this.api.remove(this.ctx.slug(), 'lessons', d.id);
      this.toasts.ok('Dars o\'chirildi');
      this.close();
      await this.reload();
    } catch (e) {
      this.errors.set(apiErrors(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected async copy() {
    const to = this.termId();
    if (!this.copyFrom || !to) return;
    try {
      const res = await this.api.copyLessons(this.ctx.slug(), this.copyFrom, to);
      this.toasts.ok(`${res.copied} ta dars nusxalandi`);
      this.copyOpen.set(false);
      await this.reload();
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Nusxalab bo\'lmadi');
    }
  }

  private async reload() {
    const term = this.termId();
    const entity = this.entityId();
    if (term && entity) await this.loadLessons(this.ctx.slug(), term, VIEW_FIELD[this.view()], entity);
  }
}
