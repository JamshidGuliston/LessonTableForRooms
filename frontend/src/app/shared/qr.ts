import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import qrcode from 'qrcode-generator';

/** QR kod — SVG path sifatida (innerHTML/bypass kerak emas). */
@Component({
  selector: 'app-qr',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + qr().size + ' ' + qr().size" shape-rendering="crispEdges" role="img" [attr.aria-label]="'QR: ' + text()">
      <rect [attr.width]="qr().size" [attr.height]="qr().size" fill="#fff" />
      <path [attr.d]="qr().d" fill="#0f172a" />
    </svg>
  `,
  styles: `:host { display: block; } svg { width: 100%; height: 100%; display: block; }`,
})
export class Qr {
  readonly text = input.required<string>();

  protected readonly qr = computed(() => {
    const q = qrcode(0, 'M');
    q.addData(this.text());
    q.make();
    const n = q.getModuleCount();
    const margin = 2;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (q.isDark(r, c)) d += `M${c + margin},${r + margin}h1v1h-1z`;
      }
    }
    return { size: n + margin * 2, d };
  });
}
