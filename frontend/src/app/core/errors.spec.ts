import { HttpErrorResponse } from '@angular/common/http';

import { apiErrors } from './errors';

function err(status: number, error: unknown) {
  return new HttpErrorResponse({ status, error });
}

describe('apiErrors', () => {
  it('splits DRF field errors and general errors', () => {
    const e = apiErrors(err(400, { room: ['Bu vaqtda xona band: Fizika (8-B)'], non_field_errors: ['Umumiy xato'] }));
    expect(e.fields['room']).toBe('Bu vaqtda xona band: Fizika (8-B)');
    expect(e.general).toBe('Umumiy xato');
  });

  it('handles a plain list and a detail message', () => {
    expect(apiErrors(err(400, ['"2-chorak" jadvali bo\'sh emas.'])).general).toBe('"2-chorak" jadvali bo\'sh emas.');
    expect(apiErrors(err(403, { detail: 'Ruxsat yo\'q' })).general).toBe('Ruxsat yo\'q');
  });

  it('maps unique-together errors to a readable message', () => {
    const e = apiErrors(err(400, { non_field_errors: ['The fields term, weekday, period, room must make a unique set.'] }));
    expect(e.general).toContain('band');
  });

  it('describes network failure', () => {
    expect(apiErrors(err(0, null)).general).toBe('Server bilan aloqa yo\'q. Qayta urinib ko\'ring.');
  });
});
