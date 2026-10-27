import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { TabletResponse } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  health() {
    return this.http.get<{ status: string }>(`${this.baseUrl}/health/`);
  }

  /** Xona planshetining jadvali. Loginsiz, xona tokeni bilan. */
  tablet(token: string, date?: string) {
    const params = date ? new HttpParams().set('date', date) : undefined;
    return this.http.get<TabletResponse>(`${this.baseUrl}/tablet/${token}/`, { params });
  }
}
