import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService, authInterceptor } from './auth';

describe('AuthService + authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => ctrl.verify());

  it('login stores the token and loads the user', async () => {
    const done = auth.login('admin', 'admin123');
    ctrl.expectOne('/api/auth/token/').flush({ token: 'abc' });
    await Promise.resolve();
    ctrl.expectOne('/api/me/').flush({ username: 'admin', schools: [{ slug: 'demo', name: 'Demo', role: 'admin', primary_color: '#2563EB' }] });
    await done;
    expect(localStorage.getItem('dj_token')).toBe('abc');
    expect(auth.user()?.schools[0].slug).toBe('demo');
  });

  it('adds the token to /api requests except the tablet endpoint', () => {
    localStorage.setItem('dj_token', 'abc');
    http.get('/api/schools/demo/subjects/').subscribe();
    expect(ctrl.expectOne('/api/schools/demo/subjects/').request.headers.get('Authorization')).toBe('Token abc');
    http.get('/api/tablet/xyz/').subscribe();
    expect(ctrl.expectOne('/api/tablet/xyz/').request.headers.has('Authorization')).toBe(false);
  });

  it('401 clears the session and goes to login', () => {
    localStorage.setItem('dj_token', 'abc');
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    http.get('/api/me/').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/me/').flush({ detail: 'x' }, { status: 401, statusText: 'Unauthorized' });
    expect(localStorage.getItem('dj_token')).toBeNull();
    expect(nav).toHaveBeenCalledWith('/login');
  });
});
