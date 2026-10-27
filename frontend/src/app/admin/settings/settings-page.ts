import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth';
import { Member, Role, SchoolSettings } from '../../core/admin-models';
import { ApiErrors, apiErrors } from '../../core/errors';
import { WEEKDAYS_SHORT, parseDays } from '../../core/format';
import { SchoolApi } from '../../core/school-api';
import { SchoolContext, initials } from '../../core/school-context';
import { Confirm } from '../../shared/confirm';
import { Icon } from '../../shared/icon';
import { Toasts } from '../../shared/toast';
import { PageHead } from '../shell/page-head';

const COLORS = ['#2563EB', '#059669', '#7C3AED', '#DC2626', '#0F766E', '#EA580C'];
const ZONES = ['Asia/Tashkent', 'Asia/Samarkand', 'Asia/Almaty', 'Asia/Bishkek', 'Asia/Dushanbe', 'Europe/Moscow'];

interface MemberDraft { id: number | null; username: string; full_name: string; password: string; role: Role }

@Component({
  selector: 'app-settings-page',
  imports: [PageHead, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly api = inject(SchoolApi);
  private readonly toasts = inject(Toasts);
  private readonly confirm = inject(Confirm);
  private readonly auth = inject(AuthService);
  protected readonly ctx = inject(SchoolContext);

  protected readonly form = signal<SchoolSettings | null>(null);
  protected readonly errors = signal<ApiErrors | null>(null);
  protected readonly saving = signal(false);
  protected readonly members = signal<Member[]>([]);
  protected readonly memberDraft = signal<MemberDraft | null>(null);
  protected readonly memberErrors = signal<ApiErrors | null>(null);

  protected readonly COLORS = COLORS;
  protected readonly ZONES = ZONES;
  protected readonly WEEKDAYS_SHORT = WEEKDAYS_SHORT;
  protected readonly initials = initials;
  protected readonly me = () => this.auth.user()?.username;

  constructor() {
    effect(() => {
      const slug = this.ctx.slug();
      if (slug) void this.load(slug);
    });
  }

  private async load(slug: string) {
    try {
      const [settings, members] = await Promise.all([this.api.settings(slug), this.api.members(slug)]);
      this.form.set(settings);
      this.members.set(members);
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Yuklab bo\'lmadi');
    }
  }

  protected patch(p: Partial<SchoolSettings>) {
    this.form.update((f) => (f ? { ...f, ...p } : f));
  }

  protected days(): number[] {
    return parseDays(this.form()?.working_days ?? '');
  }

  protected toggleDay(d: number) {
    const set = new Set(this.days());
    if (set.has(d)) set.delete(d);
    else set.add(d);
    this.patch({ working_days: [...set].sort().join(',') });
  }

  protected async save() {
    const f = this.form();
    if (!f) return;
    this.saving.set(true);
    this.errors.set(null);
    try {
      const saved = await this.api.saveSettings(this.ctx.slug(), {
        name: f.name, primary_color: f.primary_color, timezone: f.timezone, working_days: f.working_days,
      });
      this.form.set(saved);
      this.ctx.patchSchool({ name: saved.name, primary_color: saved.primary_color });
      this.toasts.ok('Sozlamalar saqlandi');
    } catch (e) {
      this.errors.set(apiErrors(e));
    } finally {
      this.saving.set(false);
    }
  }

  // ── Foydalanuvchilar ──
  protected newMember() {
    this.memberErrors.set(null);
    this.memberDraft.set({ id: null, username: '', full_name: '', password: '', role: 'staff' });
  }

  protected editMember(m: Member) {
    this.memberErrors.set(null);
    this.memberDraft.set({ id: m.id, username: m.username, full_name: m.full_name, password: '', role: m.role });
  }

  protected patchMember(p: Partial<MemberDraft>) {
    this.memberDraft.update((d) => (d ? { ...d, ...p } : d));
  }

  protected async saveMember() {
    const d = this.memberDraft();
    if (!d) return;
    const body: Record<string, unknown> = { full_name: d.full_name, role: d.role };
    if (!d.id) body['username'] = d.username;
    if (d.password) body['password'] = d.password;
    try {
      if (d.id) await this.api.update<Member>(this.ctx.slug(), 'members', d.id, body);
      else await this.api.create<Member>(this.ctx.slug(), 'members', body);
      this.toasts.ok('Foydalanuvchi saqlandi');
      this.memberDraft.set(null);
      this.members.set(await this.api.members(this.ctx.slug()));
    } catch (e) {
      this.memberErrors.set(apiErrors(e));
    }
  }

  protected async removeMember(m: Member) {
    const ok = await this.confirm.ask({
      title: `${m.full_name || m.username} maktabdan olib tashlansinmi?`,
      text: 'Foydalanuvchi bu maktab ma\'lumotlarini ko\'ra olmaydi.', ok: 'Olib tashlash', danger: true,
    });
    if (!ok) return;
    try {
      await this.api.remove(this.ctx.slug(), 'members', m.id);
      this.members.set(await this.api.members(this.ctx.slug()));
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Olib tashlab bo\'lmadi');
    }
  }
}
