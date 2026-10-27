import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Dashboard, DashboardRoom, NowEntry } from '../../core/admin-models';
import { apiErrors } from '../../core/errors';
import { dayLabel, hm } from '../../core/format';
import { SchoolApi } from '../../core/school-api';
import { SchoolContext } from '../../core/school-context';
import { Icon } from '../../shared/icon';
import { PageHead } from '../shell/page-head';

const KIND_LABEL: Record<string, string> = {
  lesson: 'DARS', exam: 'IMTIHON', club: "TO'GARAK", coffee_break: 'TANAFFUS', lunch: 'TUSHLIK',
};
const KIND_PILL: Record<string, string> = {
  lesson: 'lesson', exam: 'exam', club: 'club', coffee_break: 'break', lunch: 'break',
};

@Component({
  selector: 'app-dashboard-page',
  imports: [PageHead, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-head title="Boshqaruv paneli" [sub]="subtitle()">
      <a class="btn primary" routerLink="../timetable">Dars jadvaliga o'tish</a>
    </app-page-head>

    <div class="page-body">
      @if (error()) { <div class="form-error">{{ error() }}</div> }
      @if (data(); as d) {
        <section class="stats">
          <div class="card stat"><div class="label">Xonalar</div><div class="value tnum">{{ d.stats.rooms }}</div></div>
          <div class="card stat"><div class="label">O'qituvchilar</div><div class="value tnum">{{ d.stats.teachers }}</div></div>
          <div class="card stat"><div class="label">Guruhlar</div><div class="value tnum">{{ d.stats.groups }}</div></div>
          <div class="card stat"><div class="label">Bugungi darslar</div><div class="value tnum">{{ d.stats.lessons_today }}</div></div>
        </section>

        <section class="columns">
          <div class="card alerts">
            <div class="card-head"><h2>Ogohlantirishlar</h2></div>
            @for (a of d.alerts; track a.kind) {
              <div class="alert">
                @if (a.kind === 'tablets_offline') {
                  <span class="ico danger"><app-icon name="wifiOff" /></span>
                  <div>
                    <div class="text">{{ a.count }} ta xona plansheti aloqada emas</div>
                    <a routerLink="../tablets">Planshetlar →</a>
                  </div>
                } @else {
                  <span class="ico"><app-icon name="calendar" /></span>
                  <div>
                    <div class="text">{{ a.title }} {{ a.days }} kundan keyin boshlanadi</div>
                    <a routerLink="../calendar">Kalendar →</a>
                  </div>
                }
              </div>
            } @empty {
              <div class="empty"><div class="title">Hammasi joyida</div>Ogohlantirish yo'q</div>
            }
          </div>

          <div class="card rooms">
            <div class="card-head">
              <h2>Xonalar hozir</h2>
              <a routerLink="../tablets">Barchasi ({{ d.rooms.length }})</a>
            </div>
            <div class="room-grid">
              @for (r of d.rooms; track r.id) {
                <div class="room" [class.busy]="!!r.current" [class.offline]="r.tablet_status === 'offline'">
                  <div class="room-top">
                    <span class="room-name tnum">{{ r.name }}</span>
                    @if (r.tablet_status === 'offline') {
                      <span class="pill offline caps">Aloqa yo'q</span>
                    } @else if (r.current) {
                      <span class="pill caps" [class]="'pill caps ' + pill(r.current.kind)">{{ label(r.current.kind) }}</span>
                    } @else {
                      <span class="pill caps">Bo'sh</span>
                    }
                  </div>
                  @if (r.current; as c) {
                    <div class="what">{{ c.title }}</div>
                    <div class="who muted">{{ who(c) }}</div>
                    <div class="bar"><div [style.width.%]="progress(r)" [style.background]="c.subject_color || null"></div></div>
                  } @else {
                    <div class="what muted">Bo'sh</div>
                    <div class="who muted">
                      @if (r.next) { Keyingi: {{ r.next.title }} · {{ r.next.start_time }} } @else { Bugun boshqa mashg'ulot yo'q }
                    </div>
                  }
                </div>
              } @empty {
                <div class="empty"><div class="title">Xona qo'shilmagan</div><a routerLink="../rooms">Xonalar →</a></div>
              }
            </div>
          </div>
        </section>
      } @else if (!error()) {
        <div class="loading">Yuklanmoqda…</div>
      }
    </div>
  `,
  styles: `
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
    .stat { padding: 16px 20px; .label { color: var(--muted); } .value { font-size: 30px; font-weight: 700; } }
    .columns { display: grid; grid-template-columns: minmax(280px, 1fr) 2fr; gap: 20px; align-items: start; }
    .alert { display: flex; gap: 14px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
    .alert:last-child { border-bottom: 0; }
    .alert .text { font-weight: 500; margin-bottom: 4px; }
    .ico { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; border: 1px solid var(--border); color: var(--muted); flex: none; }
    .ico.danger { background: color-mix(in srgb, var(--danger) 10%, var(--surface)); color: var(--danger-text); border-color: transparent; }
    .room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; padding: 16px; }
    .room { border: 1px solid var(--border); border-radius: var(--r-row); padding: 14px; background: var(--surface-2); }
    .room.busy { border: 2px solid var(--primary); background: var(--surface); padding: 13px; }
    .room.offline { opacity: 0.6; }
    .room-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .room-name { font-size: 20px; font-weight: 700; }
    .what { font-weight: 600; font-size: 15px; }
    .who { font-size: 13px; margin-top: 2px; min-height: 19px; }
    .bar { height: 4px; background: var(--border); border-radius: 2px; margin-top: 10px; overflow: hidden;
      div { height: 100%; background: var(--primary); } }
    @media (max-width: 1100px) { .columns { grid-template-columns: 1fr; } .stats { grid-template-columns: repeat(2, 1fr); } }
  `,
})
export class DashboardPage {
  private readonly api = inject(SchoolApi);
  protected readonly ctx = inject(SchoolContext);

  protected readonly data = signal<Dashboard | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly subtitle = computed(() => {
    const d = this.data();
    if (!d) return '';
    const status: Record<string, string> = {
      holiday: `Ta'til: ${d.day_title}`, weekend: 'Dam olish kuni', no_term: "O'quv davri emas",
      exam: `Imtihon davri: ${d.day_title}`, lesson: '',
    };
    return [d.term, dayLabel(d.now), hm(d.now.slice(11)), status[d.day_status]].filter(Boolean).join(' · ');
  });

  constructor() {
    effect(() => {
      const slug = this.ctx.slug();
      if (slug) void this.load(slug);
    });
    const timer = setInterval(() => this.ctx.slug() && this.load(this.ctx.slug()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private async load(slug: string) {
    try {
      this.data.set(await this.api.dashboard(slug));
      this.error.set(null);
    } catch (e) {
      this.error.set(apiErrors(e).general);
    }
  }

  protected who(c: NowEntry) {
    return [c.group, c.teacher].filter((x) => !!x).join(' · ');
  }

  protected label(kind: string) {
    return KIND_LABEL[kind] ?? kind;
  }

  protected pill(kind: string) {
    return KIND_PILL[kind] ?? '';
  }

  protected progress(r: DashboardRoom): number {
    const c = r.current;
    const now = this.data()?.now;
    if (!c || !now) return 0;
    const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const n = m(now.slice(11, 16));
    return Math.min(100, Math.max(0, ((n - m(c.start_time)) / (m(c.end_time) - m(c.start_time))) * 100));
  }
}
