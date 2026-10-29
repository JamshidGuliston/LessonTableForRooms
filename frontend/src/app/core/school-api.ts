import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Dashboard, Member, Room, SchoolSettings } from './admin-models';

type Params = Record<string, string | number | null | undefined>;

/** /api/schools/<slug>/... uchun umumiy CRUD va maxsus endpointlar. */
@Injectable({ providedIn: 'root' })
export class SchoolApi {
  private readonly http = inject(HttpClient);

  private url(slug: string, path: string) {
    return `/api/schools/${slug}/${path}`;
  }

  list<T>(slug: string, resource: string, params: Params = {}): Promise<T[]> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    return firstValueFrom(this.http.get<T[]>(this.url(slug, `${resource}/`), { params: p }));
  }

  create<T>(slug: string, resource: string, body: Partial<T> | Record<string, unknown>): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.url(slug, `${resource}/`), body));
  }

  update<T>(slug: string, resource: string, id: number, body: Partial<T> | Record<string, unknown>): Promise<T> {
    return firstValueFrom(this.http.patch<T>(this.url(slug, `${resource}/${id}/`), body));
  }

  /** Bitta fayl maydonini (masalan rasm) multipart bilan yuklaydi */
  upload<T>(slug: string, resource: string, id: number, field: string, file: File): Promise<T> {
    const form = new FormData();
    form.append(field, file);
    return firstValueFrom(this.http.patch<T>(this.url(slug, `${resource}/${id}/`), form));
  }

  remove(slug: string, resource: string, id: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(this.url(slug, `${resource}/${id}/`)));
  }

  dashboard(slug: string) {
    return firstValueFrom(this.http.get<Dashboard>(this.url(slug, 'dashboard/')));
  }

  settings(slug: string) {
    return firstValueFrom(this.http.get<SchoolSettings>(this.url(slug, 'settings/')));
  }

  saveSettings(slug: string, body: Partial<SchoolSettings>) {
    return firstValueFrom(this.http.patch<SchoolSettings>(this.url(slug, 'settings/'), body));
  }

  rotateToken(slug: string, roomId: number) {
    return firstValueFrom(this.http.post<Room>(this.url(slug, `rooms/${roomId}/rotate-token/`), {}));
  }

  /** Planshet ekranidagi ulash kodini xonaga bog'laydi */
  pairTablet(slug: string, roomId: number, code: string) {
    return firstValueFrom(this.http.post<Room>(this.url(slug, `rooms/${roomId}/pair/`), { code }));
  }

  copyLessons(slug: string, fromTerm: number, toTerm: number) {
    return firstValueFrom(
      this.http.post<{ copied: number }>(this.url(slug, 'lessons/copy/'), { from_term: fromTerm, to_term: toTerm }),
    );
  }

  members(slug: string) {
    return this.list<Member>(slug, 'members');
  }
}
