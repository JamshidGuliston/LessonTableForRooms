import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { Room, TabletStatus } from '../../core/admin-models';
import { apiErrors } from '../../core/errors';
import { ago } from '../../core/format';
import { SchoolApi } from '../../core/school-api';
import { SchoolContext } from '../../core/school-context';
import { Confirm } from '../../shared/confirm';
import { Icon } from '../../shared/icon';
import { Qr } from '../../shared/qr';
import { Toasts } from '../../shared/toast';
import { PageHead } from '../shell/page-head';

const STATUS: Record<TabletStatus, string> = { online: 'Onlayn', offline: 'Oflayn', unpaired: 'Ulanmagan' };

@Component({
  selector: 'app-tablets-page',
  imports: [PageHead, Icon, Qr],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-head title="Planshetlar" [sub]="summary()" />

    <div class="page-body">
      <div class="card">
        @if (loading()) {
          <div class="loading">Yuklanmoqda…</div>
        } @else if (!rooms().length) {
          <div class="empty"><div class="title">Xona yo'q</div>Har bir xonaga bitta planshet ulanadi. Avval xonalarni qo'shing.</div>
        } @else {
          <table class="table">
            <thead><tr><th>Xona</th><th>Holat</th><th>Oxirgi aloqa</th><th>Token</th><th class="actions">Amallar</th></tr></thead>
            <tbody>
              @for (r of rooms(); track r.id) {
                <tr>
                  <td class="room tnum">{{ r.name }}</td>
                  <td><span class="pill with-dot" [class]="'pill with-dot ' + r.tablet_status">{{ STATUS[r.tablet_status] }}</span></td>
                  <td class="muted">{{ ago(r.last_seen_at) }}</td>
                  <td class="tnum muted token">{{ mask(r.device_token) }}</td>
                  <td class="actions">
                    <button class="btn sm" type="button" (click)="qrRoom.set(r)"><app-icon name="qr" [size]="15" /> Ulash</button>
                    @if (ctx.isAdmin()) {
                      <button class="btn sm" type="button" (click)="rotate(r)"><app-icon name="refresh" [size]="15" /> Tokenni yangilash</button>
                    }
                    <button class="btn sm link" type="button" (click)="preview(r)"><app-icon name="eye" [size]="15" /> Ko'rish</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>

    @if (qrRoom(); as r) {
      <div class="backdrop" (click)="qrRoom.set(null)">
        <div class="modal pair print-area" role="dialog" aria-modal="true" aria-labelledby="qr-title" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div>
              <h2 id="qr-title">{{ r.name }}-xona · planshetni ulash</h2>
              <p class="muted">Android planshetga token adb orqali beriladi; brauzerli ekranga QR orqali ochiladi.</p>
            </div>
            <button class="btn icon no-print" type="button" (click)="qrRoom.set(null)" aria-label="Yopish"><app-icon name="x" /></button>
          </div>

          <div class="qr-box"><app-qr [text]="webUrl(r)" /></div>

          <div class="field">
            <label>Planshet sahifasi (brauzer)</label>
            <div class="copy-row">
              <code class="tnum">{{ webUrl(r) }}</code>
              <button class="btn icon sm no-print" type="button" (click)="copy(webUrl(r))" aria-label="Nusxalash"><app-icon name="copy" [size]="15" /></button>
            </div>
          </div>
          <div class="field">
            <label>Android ilova (USB orqali, bir marta)</label>
            <div class="copy-row">
              <code class="tnum cmd">{{ adbCommand(r) }}</code>
              <button class="btn icon sm no-print" type="button" (click)="copy(adbCommand(r))" aria-label="Nusxalash"><app-icon name="copy" [size]="15" /></button>
            </div>
          </div>
          <div class="field">
            <label>Planshet tokeni</label>
            <div class="token-big tnum">{{ r.device_token }}</div>
            <div class="muted small">Token faqat shu xona uchun. Yangilansa, eski token darhol ishlamay qoladi.</div>
          </div>

          <div class="buttons no-print">
            <button class="btn" type="button" (click)="print()">Chop etish</button>
            <button class="btn primary" type="button" (click)="qrRoom.set(null)">Yopish</button>
          </div>
        </div>
      </div>
    }

    @if (previewRoom(); as p) {
      <div class="backdrop" (click)="previewRoom.set(null)">
        <div class="modal preview" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h2>{{ p.room.name }}-xona · jonli ko'rinish</h2>
            <button class="btn icon" type="button" (click)="previewRoom.set(null)" aria-label="Yopish"><app-icon name="x" /></button>
          </div>
          <div class="frame"><iframe [src]="p.url" title="Planshet ko'rinishi"></iframe></div>
        </div>
      </div>
    }
  `,
  styles: `
    .room { font-weight: 700; font-size: 16px; }
    .token { font-size: 13px; }
    .actions .btn { margin-left: 6px; }
    .pair { width: min(620px, 100%); }
    .pair p { margin: 4px 0 0; }
    .qr-box { width: 220px; height: 220px; padding: 12px; border: 1px solid var(--border); border-radius: var(--r-card); margin-bottom: 18px; }
    .copy-row { display: flex; gap: 8px; align-items: center; padding: 8px 8px 8px 12px; border: 1px solid var(--border);
      border-radius: var(--r-btn); background: var(--surface-2); }
    .copy-row code { flex: 1; font-size: 13px; word-break: break-all; }
    .cmd { font-size: 12px !important; }
    .token-big { font-size: 15px; font-weight: 700; letter-spacing: 0.04em; word-break: break-all; }
    .small { font-size: 13px; margin-top: 4px; }
    .preview { width: min(1100px, 100%); }
    .frame { aspect-ratio: 16 / 10; border: 1px solid var(--border); border-radius: var(--r-card); overflow: hidden; }
    .frame iframe { width: 100%; height: 100%; border: 0; }
    @media print {
      :host ::ng-deep app-admin-shell > aside { display: none; }
      .backdrop { position: static; background: none; padding: 0; }
      .modal { box-shadow: none; }
    }
  `,
})
export class TabletsPage {
  private readonly api = inject(SchoolApi);
  private readonly toasts = inject(Toasts);
  private readonly confirm = inject(Confirm);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly ctx = inject(SchoolContext);

  protected readonly rooms = signal<Room[]>([]);
  protected readonly loading = signal(true);
  protected readonly qrRoom = signal<Room | null>(null);
  protected readonly previewRoom = signal<{ room: Room; url: SafeResourceUrl } | null>(null);

  protected readonly STATUS = STATUS;
  protected readonly ago = (iso: string | null) => ago(iso);

  protected readonly summary = computed(() => {
    const list = this.rooms();
    const count = (s: TabletStatus) => list.filter((r) => r.tablet_status === s).length;
    return `${list.length} ta xona · ${count('online')} onlayn · ${count('offline')} oflayn · ${count('unpaired')} ulanmagan`;
  });

  constructor() {
    effect(() => {
      const slug = this.ctx.slug();
      if (slug) void this.load(slug);
    });
    const timer = setInterval(() => this.ctx.slug() && this.load(this.ctx.slug(), true), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private async load(slug: string, quiet = false) {
    if (!quiet) this.loading.set(true);
    try {
      this.rooms.set(await this.api.list<Room>(slug, 'rooms'));
    } catch (e) {
      if (!quiet) this.toasts.error(apiErrors(e).general ?? 'Yuklab bo\'lmadi');
    } finally {
      this.loading.set(false);
    }
  }

  protected mask(token: string) {
    return `${token.slice(0, 4)}-••••-••••`;
  }

  protected webUrl(r: Room) {
    return `${location.origin}/tablet/${r.device_token}`;
  }

  protected adbCommand(r: Room) {
    // ng serve (4200) da API Django runserver'da (8000); serverda — shu domenning o'zi
    const server = location.port === '4200' ? `${location.protocol}//${location.hostname}:8000` : location.origin;
    return `adb shell am start -n uz.darsjadval.tablet/.MainActivity --es server ${server} --es token ${r.device_token}`;
  }

  protected async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.toasts.ok('Nusxalandi');
    } catch {
      this.toasts.error('Nusxalab bo\'lmadi — qo\'lda belgilang');
    }
  }

  protected print() {
    window.print();
  }

  protected preview(r: Room) {
    this.previewRoom.set({ room: r, url: this.sanitizer.bypassSecurityTrustResourceUrl(`/tablet/${r.device_token}`) });
  }

  protected async rotate(r: Room) {
    const ok = await this.confirm.ask({
      title: `Tokenni yangilash · ${r.name}-xona`,
      text: 'Eski token darhol ishlamay qoladi. Planshetga yangi tokenni qayta berish kerak bo\'ladi. Davom etasizmi?',
      ok: 'Yangilash',
      danger: true,
    });
    if (!ok) return;
    try {
      const updated = await this.api.rotateToken(this.ctx.slug(), r.id);
      this.rooms.update((list) => list.map((x) => (x.id === r.id ? updated : x)));
      this.toasts.ok('Yangi token yaratildi');
      this.qrRoom.set(updated);
    } catch (e) {
      this.toasts.error(apiErrors(e).general ?? 'Yangilab bo\'lmadi');
    }
  }
}
