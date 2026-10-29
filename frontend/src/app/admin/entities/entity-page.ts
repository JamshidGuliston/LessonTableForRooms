import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiErrors, apiErrors } from '../../core/errors';
import { SchoolApi } from '../../core/school-api';
import { SchoolContext } from '../../core/school-context';
import { Confirm } from '../../shared/confirm';
import { Icon } from '../../shared/icon';
import { Toasts } from '../../shared/toast';
import { PageHead } from '../shell/page-head';

export interface EntityField {
  key: string;
  label: string;
  type?: 'text' | 'color' | 'number' | 'email' | 'tel' | 'textarea' | 'checkbox';
  required?: boolean;
  /** Matn uchun: belgilar chegarasi (hisoblagich bilan ko'rsatiladi) */
  maxlength?: number;
  /** Jadvalda ustun sifatida ko'rsatilsinmi */
  column?: boolean;
}

/** Route `data` orqali beriladi — bitta komponent to'rt bo'limga xizmat qiladi. */
export interface EntityConfig {
  resource: string;
  title: string;
  singular: string;
  emptyTitle: string;
  emptyHint: string;
  fields: EntityField[];
}

type Row = Record<string, unknown> & { id: number };

const PALETTE = ['#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#D97706', '#65A30D', '#059669', '#0891B2', '#475569'];

@Component({
  selector: 'app-entity-page',
  imports: [PageHead, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-head [title]="config().title" [sub]="rows().length + ' ta'">
      @if (ctx.isAdmin()) {
        <button class="btn primary" type="button" (click)="openNew()"><app-icon name="plus" /> {{ config().singular }} qo'shish</button>
      }
    </app-page-head>

    <div class="page-body">
      <div class="layout-with-panel" [class.no-panel]="!draft()">
        <div class="card">
          <div class="card-head">
            <input class="input search" type="search" placeholder="Qidirish…" aria-label="Qidirish" [ngModel]="query()" (ngModelChange)="query.set($event)" />
          </div>
          @if (loading()) {
            <div class="loading">Yuklanmoqda…</div>
          } @else if (!rows().length) {
            <div class="empty">
              <div class="title">{{ config().emptyTitle }}</div>
              <p>{{ config().emptyHint }}</p>
              @if (ctx.isAdmin()) { <button class="btn primary" type="button" (click)="openNew()"><app-icon name="plus" /> {{ config().singular }} qo'shish</button> }
            </div>
          } @else {
            <table class="table">
              <thead>
                <tr>
                  @for (f of columns(); track f.key) { <th>{{ f.label }}</th> }
                  @if (ctx.isAdmin()) { <th class="actions"></th> }
                </tr>
              </thead>
              <tbody>
                @for (r of filtered(); track r.id) {
                  <tr [class.selected]="draft()?.['id'] === r.id">
                    @for (f of columns(); track f.key; let first = $first) {
                      <td [class.strong]="first">
                        @if (f.type === 'color') {
                          @if (r[f.key]) { <span class="swatch" [style.background]="r[f.key]"></span><span class="tnum muted">{{ r[f.key] }}</span> }
                        } @else if (f.type === 'checkbox') {
                          @if (r[f.key]) { <span class="pill">Ha</span> } @else { <span class="muted">Yo'q</span> }
                        } @else {
                          {{ r[f.key] ?? '' }}
                        }
                      </td>
                    }
                    @if (ctx.isAdmin()) {
                      <td class="actions">
                        <button class="btn icon sm" type="button" (click)="openEdit(r)" aria-label="Tahrirlash"><app-icon name="edit" [size]="15" /></button>
                        <button class="btn icon sm danger" type="button" (click)="remove(r)" aria-label="O'chirish"><app-icon name="trash" [size]="15" /></button>
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr><td [attr.colspan]="columns().length + 1" class="muted">Hech narsa topilmadi</td></tr>
                }
              </tbody>
            </table>
          }
        </div>

        @if (draft(); as d) {
          <aside class="card side-panel">
            <div class="card-head">
              <h2>{{ d['id'] ? 'Tahrirlash' : config().singular + " qo'shish" }}</h2>
              <button class="btn icon" type="button" (click)="close()" aria-label="Yopish"><app-icon name="x" /></button>
            </div>
            <form class="card-body" (ngSubmit)="save()">
              @if (errors()?.general; as g) { <div class="form-error">{{ g }}</div> }
              @for (f of config().fields; track f.key) {
                <div class="field">
                  <label [for]="'f-' + f.key">{{ f.label }}</label>
                  @if (f.type === 'color') {
                    <div class="palette">
                      @for (c of palette; track c) {
                        <button type="button" class="swatch big" [style.background]="c" [class.on]="d[f.key] === c"
                                (click)="set(f.key, c)" [attr.aria-label]="c"></button>
                      }
                      <input [id]="'f-' + f.key" class="input hex tnum" [name]="f.key" [ngModel]="d[f.key]" (ngModelChange)="set(f.key, $event)" placeholder="#RRGGBB" />
                    </div>
                  } @else if (f.type === 'textarea') {
                    <textarea [id]="'f-' + f.key" class="input" rows="5" [name]="f.key" [required]="!!f.required" [attr.maxlength]="f.maxlength ?? null"
                              [ngModel]="d[f.key]" (ngModelChange)="set(f.key, $event)" [class.invalid]="!!errors()?.fields?.[f.key]"></textarea>
                    @if (f.maxlength) { <div class="muted small count tnum">{{ length(d[f.key]) }} / {{ f.maxlength }}</div> }
                  } @else if (f.type === 'checkbox') {
                    <label class="check"><input type="checkbox" [id]="'f-' + f.key" [name]="f.key" [ngModel]="d[f.key]" (ngModelChange)="set(f.key, $event)" /> Ha</label>
                  } @else {
                    <input [id]="'f-' + f.key" class="input" [name]="f.key" [type]="f.type ?? 'text'" [required]="!!f.required"
                           [ngModel]="d[f.key]" (ngModelChange)="set(f.key, $event)" [class.invalid]="!!errors()?.fields?.[f.key]" />
                  }
                  @if (errors()?.fields?.[f.key]; as m) { <div class="error">{{ m }}</div> }
                </div>
              }
              <div class="buttons">
                <button class="btn primary" type="submit" [disabled]="saving()">Saqlash</button>
                <button class="btn" type="button" (click)="close()">Bekor qilish</button>
              </div>
            </form>
          </aside>
        }
      </div>
    </div>
  `,
  styles: `
    .layout-with-panel.no-panel { grid-template-columns: 1fr; }
    .search { max-width: 320px; background: var(--surface); }
    .strong { font-weight: 600; }
    tr.selected td { background: var(--primary-tint) !important; }
    .swatch { display: inline-block; width: 14px; height: 14px; border-radius: 4px; vertical-align: -2px; margin-right: 8px; }
    .palette { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .swatch.big { width: 28px; height: 28px; border-radius: 8px; border: 2px solid transparent; cursor: pointer; margin: 0; }
    .swatch.big.on { border-color: var(--text); }
    .hex { width: 110px; }
    textarea.input { resize: vertical; font: inherit; line-height: 1.4; }
    .count { text-align: right; margin-top: 4px; }
    .check { display: flex; gap: 8px; align-items: center; font-weight: 400; cursor: pointer; }
    td { white-space: normal; }
  `,
})
export class EntityPage {
  readonly config = input.required<EntityConfig>();

  private readonly api = inject(SchoolApi);
  private readonly toasts = inject(Toasts);
  private readonly confirm = inject(Confirm);
  protected readonly ctx = inject(SchoolContext);

  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(true);
  protected readonly query = signal('');
  protected readonly draft = signal<Record<string, unknown> | null>(null);
  protected readonly errors = signal<ApiErrors | null>(null);
  protected readonly saving = signal(false);
  protected readonly palette = PALETTE;

  protected readonly columns = computed(() => this.config().fields.filter((f) => f.column !== false));
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter((r) => this.config().fields.some((f) => String(r[f.key] ?? '').toLowerCase().includes(q)));
  });

  constructor() {
    effect(() => {
      const slug = this.ctx.slug();
      const resource = this.config().resource;
      this.close();
      if (slug) void this.load(slug, resource);
    });
  }

  private async load(slug: string, resource: string) {
    this.loading.set(true);
    try {
      this.rows.set(await this.api.list<Row>(slug, resource));
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Yuklab bo\'lmadi');
    } finally {
      this.loading.set(false);
    }
  }

  protected openNew() {
    this.errors.set(null);
    this.draft.set(Object.fromEntries(this.config().fields.map((f) => [f.key, newValue(f, this.rows().length)])));
  }

  protected openEdit(r: Row) {
    this.errors.set(null);
    this.draft.set({ ...r });
  }

  protected set(key: string, value: unknown) {
    this.draft.update((d) => (d ? { ...d, [key]: value } : d));
  }

  protected length(v: unknown): number {
    return String(v ?? '').length;
  }

  protected close() {
    this.draft.set(null);
    this.errors.set(null);
  }

  protected async save() {
    const d = this.draft();
    if (!d) return;
    this.saving.set(true);
    const body = Object.fromEntries(this.config().fields.map((f) => {
      const v = d[f.key];
      if (f.type === 'checkbox') return [f.key, !!v];
      return [f.key, f.type === 'number' ? (v === '' || v === null ? null : Number(v)) : (v ?? '')];
    }));
    const slug = this.ctx.slug();
    try {
      if (d['id']) await this.api.update(slug, this.config().resource, d['id'] as number, body);
      else await this.api.create(slug, this.config().resource, body);
      this.toasts.ok('Saqlandi');
      this.close();
      await this.load(slug, this.config().resource);
    } catch (e) {
      this.errors.set(apiErrors(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(r: Row) {
    const name = String(r[this.config().fields[0].key] ?? '');
    const ok = await this.confirm.ask({
      title: `"${name}" o'chirilsinmi?`,
      text: "Bu amalni qaytarib bo'lmaydi.",
      ok: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.remove(this.ctx.slug(), this.config().resource, r.id);
      this.toasts.ok('O\'chirildi');
      await this.load(this.ctx.slug(), this.config().resource);
    } catch (e) {
      // Jadvalda ishlatilayotgan bo'lsa backend sababini aytadi
      this.toasts.error(apiErrors(e).general ?? 'O\'chirib bo\'lmadi');
    }
  }
}

function newValue(f: EntityField, count: number): unknown {
  if (f.type === 'color') return PALETTE[count % PALETTE.length];
  if (f.type === 'checkbox') return true;
  return '';
}

export const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  subjects: {
    resource: 'subjects', title: 'Fanlar', singular: 'Fan',
    emptyTitle: "Hali fan qo'shilmagan", emptyHint: "Birinchi fanni qo'shing — jadval tuzish undan boshlanadi.",
    fields: [
      { key: 'name', label: 'Nomi', required: true },
      { key: 'short_name', label: 'Qisqa nomi' },
      { key: 'color', label: 'Rangi', type: 'color' },
    ],
  },
  teachers: {
    resource: 'teachers', title: "O'qituvchilar", singular: "O'qituvchi",
    emptyTitle: "Hali o'qituvchi qo'shilmagan", emptyHint: "O'qituvchilarni qo'shing, keyin ularni darslarga biriktirasiz.",
    fields: [
      { key: 'full_name', label: 'F.I.Sh.', required: true },
      { key: 'phone', label: 'Telefon', type: 'tel' },
      { key: 'email', label: 'Email', type: 'email' },
    ],
  },
  rooms: {
    resource: 'rooms', title: 'Xonalar', singular: 'Xona',
    emptyTitle: "Hali xona qo'shilmagan", emptyHint: 'Har bir xonaga o\'z planshet tokeni beriladi.',
    fields: [
      { key: 'name', label: 'Nomi / raqami', required: true },
      { key: 'floor', label: 'Qavat' },
      { key: 'capacity', label: "Sig'imi", type: 'number' },
    ],
  },
  groups: {
    resource: 'groups', title: 'Guruhlar', singular: 'Guruh',
    emptyTitle: "Hali guruh qo'shilmagan", emptyHint: 'Masalan: 7-A, 9-B.',
    fields: [{ key: 'name', label: 'Nomi', required: true }],
  },
  quotes: {
    resource: 'quotes', title: "Hikmatli so'zlar", singular: "Hikmatli so'z",
    emptyTitle: "Hali hikmatli so'z qo'shilmagan",
    emptyHint: "Planshetlarda darslar ro'yxatidan keyin ko'rsatiladi; bir nechta bo'lsa — har daqiqada navbatdagisi.",
    fields: [
      { key: 'text', label: 'Matn', type: 'textarea', required: true, maxlength: 300 },
      { key: 'author', label: 'Muallif' },
      { key: 'is_active', label: "Planshetda ko'rsatilsin", type: 'checkbox' },
    ],
  },
};
