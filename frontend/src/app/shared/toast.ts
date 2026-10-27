import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly items = signal<Toast[]>([]);
  private seq = 0;

  ok(text: string) {
    this.push(text, 'ok');
  }

  error(text: string) {
    this.push(text, 'error');
  }

  private push(text: string, kind: Toast['kind']) {
    const id = ++this.seq;
    this.items.update((list) => [...list, { id, text, kind }]);
    setTimeout(() => this.items.update((list) => list.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3000);
  }
}

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-host" role="status" aria-live="polite">
      @for (t of toasts.items(); track t.id) {
        <div class="toast" [class]="'toast ' + t.kind">{{ t.text }}</div>
      }
    </div>
  `,
})
export class ToastHost {
  protected readonly toasts = inject(Toasts);
}
