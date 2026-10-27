import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { SchoolRef } from './admin-models';
import { AuthService } from './auth';

/** Hozir tanlangan maktab (URL dagi :slug). Maktab rangini CSS `--primary` ga qo'yadi. */
@Injectable({ providedIn: 'root' })
export class SchoolContext {
  private readonly auth = inject(AuthService);

  readonly slug = signal<string>('');
  readonly school = computed<SchoolRef | null>(
    () => this.auth.user()?.schools.find((s) => s.slug === this.slug()) ?? null,
  );
  readonly isAdmin = computed(() => this.school()?.role === 'admin');
  readonly initials = computed(() => initials(this.school()?.name ?? ''));

  constructor() {
    effect(() => {
      const color = this.school()?.primary_color;
      document.documentElement.style.setProperty('--primary', color || '#2563eb');
    });
  }

  /** Sozlamalar saqlangach — sidebar va rang darhol yangilansin. */
  patchSchool(patch: Partial<SchoolRef>) {
    const me = this.auth.user();
    if (!me) return;
    this.auth.user.set({
      ...me,
      schools: me.schools.map((s) => (s.slug === this.slug() ? { ...s, ...patch } : s)),
    });
  }
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
