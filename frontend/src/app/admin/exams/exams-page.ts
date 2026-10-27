import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Exam, ExamSession, Group, Room, Subject, Teacher } from '../../core/admin-models';
import { ApiErrors, apiErrors } from '../../core/errors';
import { dayLabel, hm, rangeLabel, todayIso } from '../../core/format';
import { SchoolApi } from '../../core/school-api';
import { SchoolContext } from '../../core/school-context';
import { Confirm } from '../../shared/confirm';
import { Icon } from '../../shared/icon';
import { Toasts } from '../../shared/toast';
import { PageHead } from '../shell/page-head';

interface Draft {
  id: number | null;
  date: string;
  start_time: string;
  end_time: string;
  room: number | null;
  subject: number | null;
  group: number | null;
  invigilator: number | null;
}

@Component({
  selector: 'app-exams-page',
  imports: [PageHead, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-head title="Imtihonlar" [sub]="session() ? session()!.name + ' · ' + rangeLabel(session()!.start_date, session()!.end_date) : ''">
      @if (sessions().length) {
        <select before class="input session-select" aria-label="Imtihon davri" [ngModel]="sessionId()" (ngModelChange)="sessionId.set($event); draft.set(null)">
          @for (s of sessions(); track s.id) { <option [ngValue]="s.id">{{ s.name }} · {{ rangeLabel(s.start_date, s.end_date) }}</option> }
        </select>
      }
      @if (ctx.isAdmin() && session()) {
        <button class="btn primary" type="button" (click)="openNew()"><app-icon name="plus" /> Imtihon qo'shish</button>
      }
    </app-page-head>

    <div class="page-body">
      @if (loading()) {
        <div class="loading">Yuklanmoqda…</div>
      } @else if (!sessions().length) {
        <div class="card empty"><div class="title">Imtihon davri yo'q</div>Avval Kalendar bo'limida imtihon davrini qo'shing.</div>
      } @else {
        <div class="layout-with-panel" [class.no-panel]="!draft()">
          <div class="days">
            @for (day of byDay(); track day.date) {
              <section class="card">
                <div class="card-head"><h2>{{ dayLabel(day.date) }}</h2><span class="pill exam caps">{{ day.exams.length }} ta</span></div>
                <table class="table">
                  <thead><tr><th>Vaqt</th><th>Fan</th><th>Guruh</th><th>Xona</th><th>Nazoratchi</th>@if (ctx.isAdmin()) { <th></th> }</tr></thead>
                  <tbody>
                    @for (e of day.exams; track e.id) {
                      <tr [class.selected]="draft()?.id === e.id">
                        <td class="tnum">{{ hm(e.start_time) }}–{{ hm(e.end_time) }}</td>
                        <td class="strong"><span class="dot" [style.background]="colorBySubject().get(e.subject) || 'var(--exam)'"></span> {{ e.subject_name }}</td>
                        <td>{{ e.group_name }}</td>
                        <td class="tnum">{{ e.room_name }}</td>
                        <td class="muted">{{ e.invigilator_name || '—' }}</td>
                        @if (ctx.isAdmin()) {
                          <td class="actions">
                            <button class="btn icon sm" type="button" (click)="openEdit(e)" aria-label="Tahrirlash"><app-icon name="edit" [size]="15" /></button>
                            <button class="btn icon sm danger" type="button" (click)="remove(e)" aria-label="O'chirish"><app-icon name="trash" [size]="15" /></button>
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </section>
            } @empty {
              <div class="card empty">
                <div class="title">Bu davrda imtihon yo'q</div>
                @if (ctx.isAdmin()) { <button class="btn primary" type="button" (click)="openNew()"><app-icon name="plus" /> Imtihon qo'shish</button> }
              </div>
            }
          </div>

          @if (draft(); as d) {
            <aside class="card side-panel">
              <div class="card-head">
                <h2>{{ d.id ? 'Imtihonni tahrirlash' : "Imtihon qo'shish" }}</h2>
                <button class="btn icon" type="button" (click)="draft.set(null)" aria-label="Yopish"><app-icon name="x" /></button>
              </div>
              <form class="card-body" (ngSubmit)="save()">
                @if (errors()?.general; as g) { <div class="form-error">{{ g }}</div> }
                <div class="field">
                  <label for="ed">Sana</label>
                  <input id="ed" class="input" type="date" name="date" required [min]="session()!.start_date" [max]="session()!.end_date"
                         [ngModel]="d.date" (ngModelChange)="patch({ date: $event })" [class.invalid]="!!errors()?.fields?.['date']" />
                  @if (errors()?.fields?.['date']; as m) { <div class="error"><app-icon name="alert" [size]="15" /> {{ m }}</div> }
                </div>
                <div class="row-2">
                  <div class="field"><label for="es">Boshlanish</label>
                    <input id="es" class="input tnum" type="time" name="start" required [ngModel]="d.start_time" (ngModelChange)="patch({ start_time: $event })" /></div>
                  <div class="field"><label for="ee">Tugash</label>
                    <input id="ee" class="input tnum" type="time" name="end" required [ngModel]="d.end_time" (ngModelChange)="patch({ end_time: $event })" /></div>
                </div>
                <div class="field"><label for="ex">Xona</label>
                  <select id="ex" class="input" name="room" [ngModel]="d.room" (ngModelChange)="patch({ room: $event })" [class.invalid]="!!errors()?.fields?.['room']">
                    <option [ngValue]="null" disabled>Tanlang</option>
                    @for (r of rooms(); track r.id) { <option [ngValue]="r.id">{{ r.name }}</option> }
                  </select>
                  @if (errors()?.fields?.['room']; as m) { <div class="error">{{ m }}</div> }
                </div>
                <div class="field"><label for="ef">Fan</label>
                  <select id="ef" class="input" name="subject" [ngModel]="d.subject" (ngModelChange)="patch({ subject: $event })">
                    <option [ngValue]="null" disabled>Tanlang</option>
                    @for (s of subjects(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }
                  </select>
                </div>
                <div class="field"><label for="eg">Guruh</label>
                  <select id="eg" class="input" name="group" [ngModel]="d.group" (ngModelChange)="patch({ group: $event })">
                    <option [ngValue]="null" disabled>Tanlang</option>
                    @for (g of groups(); track g.id) { <option [ngValue]="g.id">{{ g.name }}</option> }
                  </select>
                </div>
                <div class="field"><label for="ei">Nazoratchi</label>
                  <select id="ei" class="input" name="inv" [ngModel]="d.invigilator" (ngModelChange)="patch({ invigilator: $event })">
                    <option [ngValue]="null">— yo'q —</option>
                    @for (t of teachers(); track t.id) { <option [ngValue]="t.id">{{ t.full_name }}</option> }
                  </select>
                </div>
                <div class="buttons">
                  <button class="btn primary" type="submit" [disabled]="saving() || !d.room || !d.subject || !d.group || !d.date">Saqlash</button>
                  <button class="btn" type="button" (click)="draft.set(null)">Bekor qilish</button>
                </div>
              </form>
            </aside>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .session-select { width: auto; min-width: 260px; background: var(--surface); }
    .layout-with-panel.no-panel { grid-template-columns: 1fr; }
    .days { display: grid; gap: 16px; }
    .strong { font-weight: 600; }
    .dot { width: 8px; height: 8px; margin-right: 4px; }
    tr.selected td { background: var(--primary-tint) !important; }
  `,
})
export class ExamsPage {
  private readonly api = inject(SchoolApi);
  private readonly toasts = inject(Toasts);
  private readonly confirm = inject(Confirm);
  protected readonly ctx = inject(SchoolContext);

  protected readonly sessions = signal<ExamSession[]>([]);
  protected readonly exams = signal<Exam[]>([]);
  protected readonly rooms = signal<Room[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly groups = signal<Group[]>([]);
  protected readonly teachers = signal<Teacher[]>([]);
  protected readonly sessionId = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly errors = signal<ApiErrors | null>(null);
  protected readonly saving = signal(false);

  protected readonly hm = hm;
  protected readonly dayLabel = dayLabel;
  protected readonly rangeLabel = rangeLabel;

  protected readonly session = computed(() => this.sessions().find((s) => s.id === this.sessionId()) ?? null);
  protected readonly colorBySubject = computed(() => new Map(this.subjects().map((s) => [s.id, s.color || null])));
  protected readonly byDay = computed(() => {
    const map = new Map<string, Exam[]>();
    for (const e of this.exams()) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, exams]) => ({ date, exams }));
  });

  constructor() {
    effect(() => {
      const slug = this.ctx.slug();
      if (slug) void this.loadRefs(slug);
    });
    effect(() => {
      const slug = this.ctx.slug();
      const id = this.sessionId();
      if (slug && id) void this.loadExams(slug, id);
    });
  }

  private async loadRefs(slug: string) {
    this.loading.set(true);
    try {
      const [sessions, rooms, subjects, groups, teachers] = await Promise.all([
        this.api.list<ExamSession>(slug, 'exam-sessions'),
        this.api.list<Room>(slug, 'rooms'),
        this.api.list<Subject>(slug, 'subjects'),
        this.api.list<Group>(slug, 'groups'),
        this.api.list<Teacher>(slug, 'teachers'),
      ]);
      this.sessions.set(sessions);
      this.rooms.set(rooms);
      this.subjects.set(subjects);
      this.groups.set(groups);
      this.teachers.set(teachers);
      const today = todayIso();
      const next = sessions.find((s) => s.end_date >= today) ?? sessions[sessions.length - 1];
      this.sessionId.set(next?.id ?? null);
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Yuklab bo\'lmadi');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadExams(slug: string, session: number) {
    try {
      this.exams.set(await this.api.list<Exam>(slug, 'exams', { exam_session: session }));
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Yuklab bo\'lmadi');
    }
  }

  protected openNew() {
    const s = this.session();
    if (!s) return;
    this.errors.set(null);
    const last = this.exams()[this.exams().length - 1];
    this.draft.set({
      id: null, date: last?.date ?? s.start_date, start_time: '09:00', end_time: '11:00',
      room: null, subject: null, group: null, invigilator: null,
    });
  }

  protected openEdit(e: Exam) {
    this.errors.set(null);
    this.draft.set({
      id: e.id, date: e.date, start_time: hm(e.start_time), end_time: hm(e.end_time),
      room: e.room, subject: e.subject, group: e.group, invigilator: e.invigilator,
    });
  }

  protected patch(p: Partial<Draft>) {
    this.draft.update((d) => (d ? { ...d, ...p } : d));
  }

  protected async save() {
    const d = this.draft();
    const session = this.sessionId();
    if (!d || !session) return;
    this.saving.set(true);
    const body = { exam_session: session, date: d.date, start_time: d.start_time, end_time: d.end_time,
      room: d.room, subject: d.subject, group: d.group, invigilator: d.invigilator };
    try {
      if (d.id) await this.api.update<Exam>(this.ctx.slug(), 'exams', d.id, body);
      else await this.api.create<Exam>(this.ctx.slug(), 'exams', body);
      this.toasts.ok('Imtihon saqlandi');
      this.draft.set(null);
      await this.loadExams(this.ctx.slug(), session);
    } catch (e) {
      this.errors.set(apiErrors(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(e: Exam) {
    const ok = await this.confirm.ask({ title: 'Imtihon o\'chirilsinmi?', text: `${e.subject_name} · ${e.group_name} · ${dayLabel(e.date)}`, ok: "O'chirish", danger: true });
    if (!ok) return;
    try {
      await this.api.remove(this.ctx.slug(), 'exams', e.id);
      this.toasts.ok("O'chirildi");
      await this.loadExams(this.ctx.slug(), this.sessionId()!);
    } catch (err) {
      this.toasts.error(apiErrors(err).general ?? "O'chirib bo'lmadi");
    }
  }
}
