import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth';
import { SchoolContext } from '../../core/school-context';
import { Icon } from '../../shared/icon';
import { ConfirmHost } from '../../shared/confirm';
import { ToastHost } from '../../shared/toast';

const NAV = [
  { path: 'dashboard', label: 'Boshqaruv paneli', icon: 'dashboard' },
  { path: 'timetable', label: 'Dars jadvali', icon: 'grid' },
  { path: 'exams', label: 'Imtihonlar', icon: 'exam' },
  { path: 'clubs', label: "To'garaklar", icon: 'star' },
  { path: 'calendar', label: 'Kalendar', icon: 'calendar' },
  { path: 'bells', label: "Qo'ng'iroq jadvali", icon: 'bell' },
  { path: 'subjects', label: 'Fanlar', icon: 'book' },
  { path: 'teachers', label: "O'qituvchilar", icon: 'users' },
  { path: 'rooms', label: 'Xonalar', icon: 'door' },
  { path: 'groups', label: 'Guruhlar', icon: 'layers' },
  { path: 'quotes', label: "Hikmatli so'zlar", icon: 'quote' },
  { path: 'tablets', label: 'Planshetlar', icon: 'tablet' },
  { path: 'settings', label: 'Sozlamalar', icon: 'sliders' },
];

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, ToastHost, ConfirmHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sidebar no-print">
      <div class="brand">
        <div class="badge">{{ ctx.initials() || 'DJ' }}</div>
        <div class="brand-text">
          <div class="name">{{ ctx.school()?.name }}</div>
          <div class="app">DarsJadval</div>
        </div>
      </div>
      <nav>
        @for (item of nav; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active">
            <app-icon [name]="item.icon" />
            <span>{{ item.label }}</span>
          </a>
        }
      </nav>
      <div class="user">
        <div class="avatar">{{ (auth.user()?.username ?? '?')[0].toUpperCase() }}</div>
        <span class="username">{{ auth.user()?.username }}</span>
        <button class="btn link" type="button" (click)="auth.logout()">Chiqish</button>
      </div>
    </aside>
    <main>
      <router-outlet />
    </main>
    <app-toasts />
    <app-confirm-host />
  `,
  styles: `
    :host { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; }
    .sidebar {
      position: sticky; top: 0; height: 100vh;
      display: flex; flex-direction: column;
      background: var(--surface); border-right: 1px solid var(--border); padding: 18px 12px;
    }
    .brand { display: flex; gap: 12px; align-items: center; padding: 4px 8px 18px; }
    .badge {
      width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center;
      background: var(--primary); color: var(--on-primary); font-weight: 700;
    }
    .brand-text .name { font-weight: 700; line-height: 1.2; }
    .brand-text .app { color: var(--muted); font-size: 12px; }
    nav { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow: auto; }
    nav a {
      display: flex; gap: 12px; align-items: center; padding: 9px 12px; border-radius: 10px;
      color: var(--muted); font-weight: 500; text-decoration: none;
    }
    nav a:hover { background: var(--surface-2); color: var(--text); }
    nav a.active { background: var(--primary-tint); color: var(--primary-text); font-weight: 600; }
    .user { display: flex; align-items: center; gap: 10px; padding: 14px 8px 0; border-top: 1px solid var(--border); }
    .avatar {
      width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--border);
      display: grid; place-items: center; font-weight: 600; font-size: 13px;
    }
    .username { flex: 1; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
    main { min-width: 0; }
    @media (max-width: 900px) {
      :host { grid-template-columns: 1fr; }
      .sidebar { position: static; height: auto; }
      nav { flex-direction: row; flex-wrap: wrap; }
      nav a span { font-size: 13px; }
    }
  `,
})
export class AdminShell {
  /** Route parametri (withComponentInputBinding) */
  readonly slug = input.required<string>();

  protected readonly auth = inject(AuthService);
  protected readonly ctx = inject(SchoolContext);
  private readonly router = inject(Router);
  protected readonly nav = NAV;

  constructor() {
    effect(() => {
      const slug = this.slug();
      const schools = this.auth.user()?.schools ?? [];
      if (schools.length && !schools.some((s) => s.slug === slug)) {
        void this.router.navigate(['/s', schools[0].slug, 'dashboard']);
        return;
      }
      this.ctx.slug.set(slug);
    });
  }
}
