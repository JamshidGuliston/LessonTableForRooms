import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth';
import { SchoolContext } from '../../core/school-context';

/** Sahifa sarlavhasi: nom, izoh, maktab almashtirgich va amallar (ng-content). */
@Component({
  selector: 'app-page-head',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-head">
      <div class="titles">
        <h1>{{ title() }}</h1>
        @if (sub()) { <div class="sub">{{ sub() }}</div> }
      </div>
      <div class="actions">
        <ng-content select="[before]" />
        @if ((auth.user()?.schools?.length ?? 0) > 1) {
          <select class="input switcher" aria-label="Maktab" [value]="ctx.slug()" (change)="switch($any($event.target).value)">
            @for (s of auth.user()!.schools; track s.slug) {
              <option [value]="s.slug">{{ s.name }}</option>
            }
          </select>
        }
        <ng-content />
      </div>
    </header>
  `,
  styles: `.switcher { width: auto; min-width: 160px; background: var(--surface); }`,
})
export class PageHead {
  readonly title = input.required<string>();
  readonly sub = input<string>('');

  protected readonly auth = inject(AuthService);
  protected readonly ctx = inject(SchoolContext);
  private readonly router = inject(Router);

  protected switch(slug: string) {
    // Joriy bo'limda qolamiz: /s/<eski>/timetable → /s/<yangi>/timetable
    const section = this.router.url.split('/')[3]?.split('?')[0] ?? 'dashboard';
    void this.router.navigate(['/s', slug, section]);
  }
}
