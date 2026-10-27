import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Period, PeriodKind } from '../../core/admin-models';
import { ApiErrors, apiErrors } from '../../core/errors';
import { hm } from '../../core/format';
import { SchoolApi } from '../../core/school-api';
import { SchoolContext } from '../../core/school-context';
import { Confirm } from '../../shared/confirm';
import { Icon } from '../../shared/icon';
import { Toasts } from '../../shared/toast';
import { PageHead } from '../shell/page-head';

const KIND: Record<PeriodKind, { label: string; pill: string }> = {
  lesson: { label: 'Dars', pill: 'lesson' },
  coffee_break: { label: 'Tanaffus', pill: 'break' },
  lunch: { label: 'Tushlik', pill: 'break' },
};

interface Draft { id: number | null; order: number; name: string; kind: PeriodKind; start_time: string; end_time: string }

function minutes(t: string) {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

@Component({
  selector: 'app-bells-page',
  imports: [PageHead, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-head title="Qo'ng'iroq jadvali" sub="Dars vaqtlari, tanaffus va tushlik — hamma kunlar uchun bir xil">
      @if (ctx.isAdmin()) {
        <button class="btn primary" type="button" (click)="openNew()"><app-icon name="plus" /> Qo'shish</button>
      }
    </app-page-head>

    <div class="page-body">
      <div class="layout-with-panel" [class.no-panel]="!draft()">
        <div class="card">
          @if (loading()) {
            <div class="loading">Yuklanmoqda…</div>
          } @else if (!periods().length) {
            <div class="empty">
              <div class="title">Qo'ng'iroq jadvali bo'sh</div>
              <p>1-dars, tanaffus, 2-dars… tartibida kiriting.</p>
              @if (ctx.isAdmin()) { <button class="btn primary" type="button" (click)="openNew()"><app-icon name="plus" /> Qo'shish</button> }
            </div>
          } @else {
            <table class="table">
              <thead><tr><th>#</th><th>Nomi</th><th>Turi</th><th>Vaqt</th><th>Davomiyligi</th>@if (ctx.isAdmin()) { <th></th> }</tr></thead>
              <tbody>
                @for (p of sorted(); track p.id; let i = $index) {
                  <tr [class.brk]="p.kind !== 'lesson'" [class.selected]="draft()?.id === p.id">
                    <td class="muted tnum">{{ i + 1 }}</td>
                    <td class="strong">{{ p.name }}</td>
                    <td><span class="pill caps" [class]="'pill caps ' + KIND[p.kind].pill">{{ KIND[p.kind].label }}</span></td>
                    <td class="tnum">{{ hm(p.start_time) }}–{{ hm(p.end_time) }}</td>
                    <td class="muted tnum">{{ length(p) }} daq
                      @if (gapBefore(i); as g) { <span class="gap" [class.bad]="g < 0">{{ g < 0 ? 'ustma-ust ' + -g + ' daq' : "oraliq " + g + ' daq' }}</span> }
                    </td>
                    @if (ctx.isAdmin()) {
                      <td class="actions">
                        <button class="btn icon sm" type="button" (click)="openEdit(p)" aria-label="Tahrirlash"><app-icon name="edit" [size]="15" /></button>
                        <button class="btn icon sm danger" type="button" (click)="remove(p)" aria-label="O'chirish"><app-icon name="trash" [size]="15" /></button>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

        @if (draft(); as d) {
          <aside class="card side-panel">
            <div class="card-head">
              <h2>{{ d.id ? 'Tahrirlash' : "Qo'shish" }}</h2>
              <button class="btn icon" type="button" (click)="draft.set(null)" aria-label="Yopish"><app-icon name="x" /></button>
            </div>
            <form class="card-body" (ngSubmit)="save()">
              @if (errors()?.general; as g) { <div class="form-error">{{ g }}</div> }
              <div class="field">
                <label>Turi</label>
                <div class="segment">
                  @for (k of kinds; track k) {
                    <button type="button" [class.on]="d.kind === k" (click)="setKind(k)">{{ KIND[k].label }}</button>
                  }
                </div>
              </div>
              <div class="field">
                <label for="bn">Nomi</label>
                <input id="bn" class="input" name="name" required [ngModel]="d.name" (ngModelChange)="patch({ name: $event })" />
              </div>
              <div class="row-2">
                <div class="field">
                  <label for="bs">Boshlanish</label>
                  <input id="bs" class="input tnum" type="time" name="start" required [ngModel]="d.start_time" (ngModelChange)="patch({ start_time: $event })" [class.invalid]="!!errors()?.general" />
                </div>
                <div class="field">
                  <label for="be">Tugash</label>
                  <input id="be" class="input tnum" type="time" name="end" required [ngModel]="d.end_time" (ngModelChange)="patch({ end_time: $event })" [class.invalid]="!!errors()?.general" />
                </div>
              </div>
              <div class="buttons">
                <button class="btn primary" type="submit" [disabled]="saving() || !d.name || !d.start_time || !d.end_time">Saqlash</button>
                <button class="btn" type="button" (click)="draft.set(null)">Bekor qilish</button>
              </div>
            </form>
          </aside>
        }
      </div>
    </div>
  `,
  styles: `
    .layout-with-panel.no-panel { grid-template-columns: 1fr; }
    .strong { font-weight: 600; }
    tr.brk td { background: var(--surface-2); }
    tr.selected td { background: var(--primary-tint) !important; }
    .gap { margin-left: 10px; font-size: 12px; color: var(--faint); }
    .gap.bad { color: var(--danger-text); font-weight: 600; }
  `,
})
export class BellsPage {
  private readonly api = inject(SchoolApi);
  private readonly toasts = inject(Toasts);
  private readonly confirm = inject(Confirm);
  protected readonly ctx = inject(SchoolContext);

  protected readonly periods = signal<Period[]>([]);
  protected readonly loading = signal(true);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly errors = signal<ApiErrors | null>(null);
  protected readonly saving = signal(false);

  protected readonly KIND = KIND;
  protected readonly kinds: PeriodKind[] = ['lesson', 'coffee_break', 'lunch'];
  protected readonly hm = hm;
  protected readonly sorted = computed(() => [...this.periods()].sort((a, b) => a.start_time.localeCompare(b.start_time)));

  constructor() {
    effect(() => {
      const slug = this.ctx.slug();
      if (slug) void this.load(slug);
    });
  }

  private async load(slug: string) {
    this.loading.set(true);
    try {
      this.periods.set(await this.api.list<Period>(slug, 'periods'));
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Yuklab bo\'lmadi');
    } finally {
      this.loading.set(false);
    }
  }

  protected length(p: Period) {
    return minutes(p.end_time) - minutes(p.start_time);
  }

  /** Oldingi qatordan bo'shliq (daqiqa); 0 bo'lsa ko'rsatilmaydi, manfiy — ustma-ust. */
  protected gapBefore(i: number): number {
    if (i === 0) return 0;
    const list = this.sorted();
    return minutes(list[i].start_time) - minutes(list[i - 1].end_time);
  }

  protected openNew() {
    const list = this.sorted();
    const last = list[list.length - 1];
    const lessons = list.filter((p) => p.kind === 'lesson').length;
    const start = last ? hm(last.end_time) : '08:30';
    const end = String(Math.floor((minutes(start) + 45) / 60)).padStart(2, '0') + ':' + String((minutes(start) + 45) % 60).padStart(2, '0');
    this.errors.set(null);
    this.draft.set({
      id: null, order: Math.max(0, ...list.map((p) => p.order)) + 1, name: `${lessons + 1}-dars`, kind: 'lesson',
      start_time: start, end_time: end,
    });
  }

  protected openEdit(p: Period) {
    this.errors.set(null);
    this.draft.set({ id: p.id, order: p.order, name: p.name, kind: p.kind, start_time: hm(p.start_time), end_time: hm(p.end_time) });
  }

  protected patch(p: Partial<Draft>) {
    this.draft.update((d) => (d ? { ...d, ...p } : d));
  }

  protected setKind(kind: PeriodKind) {
    const d = this.draft();
    if (!d) return;
    const defaults: Record<PeriodKind, string> = { lesson: d.name, coffee_break: 'Tanaffus', lunch: 'Tushlik' };
    this.patch({ kind, name: d.id ? d.name : defaults[kind] });
  }

  protected async save() {
    const d = this.draft();
    if (!d) return;
    this.saving.set(true);
    const body = { order: d.order, name: d.name, kind: d.kind, start_time: d.start_time, end_time: d.end_time };
    try {
      if (d.id) await this.api.update<Period>(this.ctx.slug(), 'periods', d.id, body);
      else await this.api.create<Period>(this.ctx.slug(), 'periods', body);
      this.toasts.ok('Saqlandi');
      this.draft.set(null);
      await this.load(this.ctx.slug());
    } catch (e) {
      this.errors.set(apiErrors(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(p: Period) {
    const ok = await this.confirm.ask({ title: `"${p.name}" o'chirilsinmi?`, text: "Bu vaqtga qo'yilgan darslar bo'lsa, o'chirib bo'lmaydi.", ok: "O'chirish", danger: true });
    if (!ok) return;
    try {
      await this.api.remove(this.ctx.slug(), 'periods', p.id);
      this.toasts.ok("O'chirildi");
      await this.load(this.ctx.slug());
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? "O'chirib bo'lmadi");
    }
  }
}
