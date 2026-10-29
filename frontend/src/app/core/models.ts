// Backend `api/services.py` dagi room_day() natijasi bilan bir xil shakl.

export type DayStatus = 'lesson' | 'exam' | 'holiday' | 'weekend' | 'no_term';
/** free — dars soati, lekin xonada hech narsa yo'q ("Xona bo'sh") */
export type EntryKind = 'lesson' | 'exam' | 'coffee_break' | 'lunch' | 'club' | 'free';
export type EntryStatus = 'past' | 'active' | 'upcoming';

export interface DayEntry {
  kind: EntryKind;
  title: string;
  start_time: string; // "08:30"
  end_time: string;
  group: string | null;
  teacher: string | null;
  subject_color: string | null;
  status: EntryStatus;
}

export interface RoomDay {
  date: string;
  weekday: number;
  status: DayStatus;
  title: string;
  entries: DayEntry[];
  current: DayEntry | null;
  next: DayEntry | null;
}

export interface TabletResponse {
  school: { slug: string; name: string; timezone: string; working_days: string };
  room: { id: number; name: string; floor: string };
  now: string; // maktab vaqti, ISO, zonasiz
  day: RoomDay;
  /** Hikmatli so'z (har daqiqada navbatdagisi), admin qo'shmagan bo'lsa null */
  quote: Quote | null;
}

export interface Quote {
  text: string;
  author: string;
}
