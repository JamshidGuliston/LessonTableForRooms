import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SchoolContext } from '../../core/school-context';
import { ENTITY_CONFIGS, EntityPage } from './entity-page';

describe('EntityPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SchoolContext).slug.set('demo');
  });

  afterEach(() => http.verify());

  // Regressiya: effect ichida formani tozalash signalni o'qib-yozib, effect'ni cheksiz qayta
  // ishga tushirar edi — brauzer qotib, API so'rovlari to'xtovsiz ketardi.
  it('loads the list once (no effect loop)', async () => {
    const fixture = TestBed.createComponent(EntityPage);
    fixture.componentRef.setInput('config', ENTITY_CONFIGS['quotes']);
    await fixture.whenStable();
    expect(http.match('/api/schools/demo/quotes/').length).toBe(1);
    expect(http.match('/api/schools/demo/groups/').length).toBe(1);
    await fixture.whenStable();
    http.verify();
  });
});
