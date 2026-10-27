import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Me } from './admin-models';

const TOKEN_KEY = 'dj_token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<Me | null>(null);

  get token(): string | null {
    return readToken();
  }

  async login(username: string, password: string): Promise<Me> {
    const { token } = await firstValueFrom(this.http.post<{ token: string }>('/api/auth/token/', { username, password }));
    localStorage.setItem(TOKEN_KEY, token);
    return this.loadMe();
  }

  async loadMe(): Promise<Me> {
    const me = await firstValueFrom(this.http.get<Me>('/api/me/'));
    this.user.set(me);
    return me;
  }

  /** Sessiyani tozalash (serverdagi token o'z holicha qoladi). */
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private rejim */
    }
    this.user.set(null);
  }

  logout() {
    this.clear();
    void this.router.navigateByUrl('/login');
  }
}

/** /api ga token qo'shadi (planshet endpointidan tashqari); 401 bo'lsa login sahifasiga. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = readToken();
  const isTablet = req.url.startsWith('/api/tablet/');
  if (token && req.url.startsWith('/api/') && !isTablet) {
    req = req.clone({ setHeaders: { Authorization: `Token ${token}` } });
  }
  return next(req).pipe(
    catchError((e: unknown) => {
      if (e instanceof HttpErrorResponse && e.status === 401 && !isTablet) auth.logout();
      return throwError(() => e);
    }),
  );
};

/** Token bo'lmasa — login. Foydalanuvchi ma'lumoti hali yuklanmagan bo'lsa yuklaydi. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.token) return router.parseUrl('/login');
  if (!auth.user()) {
    try {
      await auth.loadMe();
    } catch {
      return router.parseUrl('/login');
    }
  }
  return true;
};
