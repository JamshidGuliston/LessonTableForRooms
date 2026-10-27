// Backend serializerlari bilan bir xil shakl (backend/api/serializers.py).

export type Role = 'admin' | 'staff';
export type PeriodKind = 'lesson' | 'coffee_break' | 'lunch';
export type TabletStatus = 'online' | 'offline' | 'unpaired';

export interface SchoolRef {
  slug: string;
  name: string;
  role: Role;
  primary_color: string;
}

export interface Me {
  username: string;
  schools: SchoolRef[];
}

export interface Subject { id: number; name: string; short_name: string; color: string }
export interface Teacher { id: number; full_name: string; phone: string; email: string }
export interface Group { id: number; name: string }

export interface Room {
  id: number;
  name: string;
  floor: string;
  capacity: number | null;
  device_token: string;
  last_seen_at: string | null;
  tablet_status: TabletStatus;
}

export interface Period {
  id: number;
  order: number;
  name: string;
  kind: PeriodKind;
  start_time: string; // "08:30:00"
  end_time: string;
}

export interface DateRange { id: number; name: string; start_date: string; end_date: string }
export interface AcademicYear extends DateRange {}
export interface Term extends DateRange { academic_year: number }
export interface Break extends DateRange {}
export interface ExamSession extends DateRange { kind: 'midterm' | 'final' }

export interface Lesson {
  id: number;
  term: number;
  weekday: number;
  period: number;
  room: number;
  subject: number;
  group: number;
  teacher: number;
  subject_name: string;
  group_name: string;
  teacher_name: string;
  room_name: string;
  start_time: string; // "08:30"
  end_time: string;
}

export interface Exam {
  id: number;
  exam_session: number;
  date: string;
  start_time: string;
  end_time: string;
  room: number;
  subject: number;
  group: number;
  invigilator: number | null;
  subject_name: string;
  group_name: string;
  room_name: string;
  invigilator_name: string | null;
}

export interface Club {
  id: number;
  name: string;
  description: string;
  leader: number | null;
  leader_name: string | null;
  color: string;
  is_active: boolean;
}

export interface ClubSession {
  id: number;
  club: number;
  academic_year: number;
  weekday: number;
  start_time: string;
  end_time: string;
  room: number;
  club_name: string;
  room_name: string;
}

export interface Member {
  id: number;
  username: string;
  full_name: string;
  role: Role;
}

export interface SchoolSettings {
  slug: string;
  name: string;
  timezone: string;
  working_days: string;
  primary_color: string;
}

export interface NowEntry {
  kind: string;
  title: string;
  start_time: string;
  end_time: string;
  group: string | null;
  teacher: string | null;
  subject_color: string | null;
}

export interface DashboardRoom {
  id: number;
  name: string;
  current: NowEntry | null;
  next: NowEntry | null;
  tablet_status: TabletStatus;
  last_seen_at: string | null;
}

export type DashboardAlert =
  | { kind: 'tablets_offline'; count: number }
  | { kind: 'break_soon'; title: string; days: number };

export interface Dashboard {
  now: string;
  day_status: 'lesson' | 'exam' | 'holiday' | 'weekend' | 'no_term';
  day_title: string;
  term: string | null;
  stats: { rooms: number; teachers: number; groups: number; lessons_today: number };
  rooms: DashboardRoom[];
  alerts: DashboardAlert[];
}
