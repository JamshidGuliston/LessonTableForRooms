import { HttpErrorResponse } from '@angular/common/http';

export interface ApiErrors {
  /** Maydon nomi → birinchi xato matni */
  fields: Record<string, string>;
  general: string | null;
}

/** DRF xato javobini forma uchun qulay ko'rinishga keltiradi. */
export function apiErrors(e: unknown): ApiErrors {
  if (!(e instanceof HttpErrorResponse)) return { fields: {}, general: 'Kutilmagan xato.' };
  if (e.status === 0) return { fields: {}, general: 'Server bilan aloqa yo\'q. Qayta urinib ko\'ring.' };

  const body = e.error;
  if (Array.isArray(body)) return { fields: {}, general: humanize(String(body[0])) };
  if (body && typeof body === 'object') {
    const fields: Record<string, string> = {};
    let general: string | null = null;
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      const msg = humanize(Array.isArray(value) ? String(value[0]) : String(value));
      if (key === 'non_field_errors' || key === 'detail') general = msg;
      else fields[key] = msg;
    }
    if (!general && Object.keys(fields).length === 0) general = `Xato (${e.status}).`;
    return { fields, general };
  }
  return { fields: {}, general: `Xato (${e.status}).` };
}

function humanize(msg: string): string {
  if (/must make a unique set/.test(msg)) return 'Bu vaqtda xona, o\'qituvchi yoki guruh band.';
  if (/already exists/.test(msg)) return 'Bunday nom allaqachon mavjud.';
  if (/This field is required/.test(msg)) return 'Majburiy maydon.';
  return msg;
}
