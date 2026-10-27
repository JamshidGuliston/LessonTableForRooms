import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="card login" (ngSubmit)="submit()">
      <div class="logo">DJ</div>
      <h1>DarsJadval</h1>
      <p class="muted">Maktab admin paneli</p>

      @if (error()) { <div class="form-error" role="alert">{{ error() }}</div> }

      <div class="field">
        <label for="u">Foydalanuvchi nomi</label>
        <input id="u" class="input" name="username" autocomplete="username" [(ngModel)]="username" required [class.invalid]="!!error()" />
      </div>
      <div class="field">
        <label for="p">Parol</label>
        <input id="p" class="input" name="password" type="password" autocomplete="current-password" [(ngModel)]="password" required [class.invalid]="!!error()" />
      </div>
      <button class="btn primary block" type="submit" [disabled]="busy() || !username || !password">
        {{ busy() ? 'Kirilmoqda…' : 'Kirish' }}
      </button>
    </form>
  `,
  styles: `
    :host { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
    .login { width: min(400px, 100%); padding: 32px; text-align: center; }
    .logo {
      width: 56px; height: 56px; margin: 0 auto 14px; border-radius: 14px; display: grid; place-items: center;
      background: var(--primary); color: var(--on-primary); font-weight: 800; font-size: 20px;
    }
    h1 { font-size: 22px; }
    p { margin: 4px 0 24px; }
    .field { text-align: left; }
    .btn { height: 42px; margin-top: 6px; }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected username = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  async submit() {
    this.busy.set(true);
    this.error.set(null);
    try {
      const me = await this.auth.login(this.username.trim(), this.password);
      if (!me.schools.length) {
        this.error.set('Bu foydalanuvchi hech qaysi maktabga biriktirilmagan.');
        this.auth.clear();
        return;
      }
      await this.router.navigate(['/s', me.schools[0].slug, 'dashboard']);
    } catch (e) {
      this.error.set(
        e instanceof HttpErrorResponse && e.status === 400
          ? "Login yoki parol noto'g'ri"
          : "Server bilan aloqa yo'q. Qayta urinib ko'ring.",
      );
    } finally {
      this.busy.set(false);
    }
  }
}
