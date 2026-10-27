import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AcademicYear, Club, ClubSession, Room, Teacher } from '../../core/admin-models';
import { ApiErrors, apiErrors } from '../../core/errors';
import { WEEKDAYS, hm, todayIso } from '../../core/format';
import { SchoolApi } from '../../core/school-api';
import { SchoolContext } from '../../core/school-context';
import { Confirm } from '../../shared/confirm';
import { Icon } from '../../shared/icon';
import { Toasts } from '../../shared/toast';
import { PageHead } from '../shell/page-head';

interface ClubDraft { id: number | null; name: string; description: string; leader: number | null; color: string; is_active: boolean }
interface SessionDraft { id: number | null; weekday: number; start_time: string; end_time: string; room: number | null }

const COLORS = ['#A78BFA', '#F472B6', '#4ADE80', '#FB923C', '#38BDF8', '#FACC15', '#F87171', '#2DD4BF'];

@Component({
  selector: 'app-clubs-page',
  imports: [PageHead, FormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clubs-page.html',
  styleUrl: './clubs-page.scss',
})
export class ClubsPage {
  private readonly api = inject(SchoolApi);
  private readonly toasts = inject(Toasts);
  private readonly confirm = inject(Confirm);
  protected readonly ctx = inject(SchoolContext);

  protected readonly clubs = signal<Club[]>([]);
  protected readonly sessions = signal<ClubSession[]>([]);
  protected readonly teachers = signal<Teacher[]>([]);
  protected readonly rooms = signal<Room[]>([]);
  protected readonly years = signal<AcademicYear[]>([]);
  protected readonly yearId = signal<number | null>(null);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly loading = signal(true);

  protected readonly clubDraft = signal<ClubDraft | null>(null);
  protected readonly sessionDraft = signal<SessionDraft | null>(null);
  protected readonly errors = signal<ApiErrors | null>(null);
  protected readonly saving = signal(false);

  protected readonly WEEKDAYS = WEEKDAYS;
  protected readonly COLORS = COLORS;
  protected readonly hm = hm;

  protected readonly selected = computed(() => this.clubs().find((c) => c.id === this.selectedId()) ?? null);
  protected readonly yearSessions = computed(() => this.sessions().filter((s) => s.academic_year === this.yearId()));
  protected readonly selectedSessions = computed(() =>
    this.yearSessions().filter((s) => s.club === this.selectedId()).sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)),
  );
  protected readonly countByClub = computed(() => {
    const m = new Map<number, number>();
    for (const s of this.yearSessions()) m.set(s.club, (m.get(s.club) ?? 0) + 1);
    return m;
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
      const [clubs, sessions, teachers, rooms, years] = await Promise.all([
        this.api.list<Club>(slug, 'clubs'),
        this.api.list<ClubSession>(slug, 'club-sessions'),
        this.api.list<Teacher>(slug, 'teachers'),
        this.api.list<Room>(slug, 'rooms'),
        this.api.list<AcademicYear>(slug, 'academic-years'),
      ]);
      this.clubs.set(clubs);
      this.sessions.set(sessions);
      this.teachers.set(teachers);
      this.rooms.set(rooms);
      this.years.set(years);
      if (!years.some((y) => y.id === this.yearId())) {
        const today = todayIso();
        this.yearId.set((years.find((y) => y.start_date <= today && today <= y.end_date) ?? years[years.length - 1])?.id ?? null);
      }
      if (!clubs.some((c) => c.id === this.selectedId())) this.selectedId.set(clubs[0]?.id ?? null);
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Yuklab bo\'lmadi');
    } finally {
      this.loading.set(false);
    }
  }

  protected select(c: Club) {
    this.selectedId.set(c.id);
    this.clubDraft.set(null);
    this.sessionDraft.set(null);
    this.errors.set(null);
  }

  // ── To'garak ──
  protected newClub() {
    this.errors.set(null);
    this.sessionDraft.set(null);
    this.clubDraft.set({ id: null, name: '', description: '', leader: null, color: COLORS[this.clubs().length % COLORS.length], is_active: true });
  }

  protected editClub(c: Club) {
    this.errors.set(null);
    this.sessionDraft.set(null);
    this.clubDraft.set({ id: c.id, name: c.name, description: c.description, leader: c.leader, color: c.color, is_active: c.is_active });
  }

  protected patchClub(p: Partial<ClubDraft>) {
    this.clubDraft.update((d) => (d ? { ...d, ...p } : d));
  }

  protected async saveClub() {
    const d = this.clubDraft();
    if (!d) return;
    this.saving.set(true);
    const { id, ...body } = d;
    try {
      const saved = id
        ? await this.api.update<Club>(this.ctx.slug(), 'clubs', id, body)
        : await this.api.create<Club>(this.ctx.slug(), 'clubs', body);
      this.toasts.ok("To'garak saqlandi");
      this.clubDraft.set(null);
      this.selectedId.set(saved.id);
      await this.load(this.ctx.slug());
    } catch (e) {
      this.errors.set(apiErrors(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleActive(c: Club) {
    try {
      await this.api.update<Club>(this.ctx.slug(), 'clubs', c.id, { is_active: !c.is_active });
      await this.load(this.ctx.slug());
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Saqlab bo\'lmadi');
    }
  }

  protected async removeClub(c: Club) {
    const ok = await this.confirm.ask({ title: `"${c.name}" o'chirilsinmi?`, text: "Barcha mashg'ulotlari ham o'chadi.", ok: "O'chirish", danger: true });
    if (!ok) return;
    try {
      await this.api.remove(this.ctx.slug(), 'clubs', c.id);
      this.toasts.ok("O'chirildi");
      await this.load(this.ctx.slug());
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? "O'chirib bo'lmadi");
    }
  }

  // ── Mashg'ulot ──
  protected newSession() {
    this.errors.set(null);
    this.clubDraft.set(null);
    this.sessionDraft.set({ id: null, weekday: 0, start_time: '14:30', end_time: '16:00', room: null });
  }

  protected editSession(s: ClubSession) {
    this.errors.set(null);
    this.clubDraft.set(null);
    this.sessionDraft.set({ id: s.id, weekday: s.weekday, start_time: hm(s.start_time), end_time: hm(s.end_time), room: s.room });
  }

  protected patchSession(p: Partial<SessionDraft>) {
    this.sessionDraft.update((d) => (d ? { ...d, ...p } : d));
  }

  protected async saveSession() {
    const d = this.sessionDraft();
    const club = this.selectedId();
    if (!d || !club) return;
    this.saving.set(true);
    const body = { club, academic_year: this.yearId(), weekday: d.weekday, start_time: d.start_time, end_time: d.end_time, room: d.room };
    try {
      if (d.id) await this.api.update<ClubSession>(this.ctx.slug(), 'club-sessions', d.id, body);
      else await this.api.create<ClubSession>(this.ctx.slug(), 'club-sessions', body);
      this.toasts.ok("Mashg'ulot saqlandi");
      this.sessionDraft.set(null);
      await this.load(this.ctx.slug());
    } catch (e) {
      this.errors.set(apiErrors(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected async removeSession(s: ClubSession) {
    const ok = await this.confirm.ask({ title: "Mashg'ulot o'chirilsinmi?", text: `${WEEKDAYS[s.weekday]} ${hm(s.start_time)}–${hm(s.end_time)} · ${s.room_name}`, ok: "O'chirish", danger: true });
    if (!ok) return;
    try {
      await this.api.remove(this.ctx.slug(), 'club-sessions', s.id);
      await this.load(this.ctx.slug());
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? "O'chirib bo'lmadi");
    }
  }
}
