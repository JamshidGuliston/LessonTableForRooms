import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';

export interface ConfirmOptions {
  title: string;
  text: string;
  ok: string;
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/** Brauzer confirm() o'rniga dizayndagi tasdiqlash oynasi. */
@Injectable({ providedIn: 'root' })
export class Confirm {
  readonly pending = signal<Pending | null>(null);

  constructor() {
    // Boshqa sahifaga o'tilsa ochiq savol "bekor" deb yopiladi
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart && this.pending()) this.answer(false);
    });
  }

  ask(options: ConfirmOptions): Promise<boolean> {
    this.pending()?.resolve(false);
    return new Promise((resolve) => this.pending.set({ ...options, resolve }));
  }

  answer(ok: boolean) {
    this.pending()?.resolve(ok);
    this.pending.set(null);
  }
}

@Component({
  selector: 'app-confirm-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirm.pending(); as p) {
      <div class="backdrop" (click)="confirm.answer(false)" (keydown.escape)="confirm.answer(false)">
        <div class="modal small" role="alertdialog" aria-modal="true" aria-labelledby="cf-title" (click)="$event.stopPropagation()">
          <div class="modal-head"><h2 id="cf-title">{{ p.title }}</h2></div>
          <p class="muted">{{ p.text }}</p>
          <div class="buttons">
            <button class="btn" type="button" (click)="confirm.answer(false)">Bekor qilish</button>
            <button class="btn" type="button" [class.danger-solid]="p.danger" [class.primary]="!p.danger" (click)="confirm.answer(true)" autofocus>{{ p.ok }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `.modal.small { width: min(440px, 100%); } p { margin: 0; }`,
})
export class ConfirmHost {
  protected readonly confirm = inject(Confirm);
}
