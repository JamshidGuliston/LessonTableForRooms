import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

import { CalendarPage } from './admin/calendar/calendar-page';
import { BellsPage } from './admin/bells/bells-page';
import { ClubsPage } from './admin/clubs/clubs-page';
import { DashboardPage } from './admin/dashboard/dashboard-page';
import { ENTITY_CONFIGS, EntityPage } from './admin/entities/entity-page';
import { ExamsPage } from './admin/exams/exams-page';
import { LoginPage } from './admin/login/login-page';
import { SettingsPage } from './admin/settings/settings-page';
import { AdminShell } from './admin/shell/admin-shell';
import { TabletsPage } from './admin/tablets/tablets-page';
import { TimetablePage } from './admin/timetable/timetable-page';
import { AuthService, authGuard } from './core/auth';
import { TabletPage } from './tablet/tablet-page';

/** "/" → birinchi maktabning boshqaruv paneli */
const toFirstSchool = () => {
  const slug = inject(AuthService).user()?.schools[0]?.slug;
  return slug ? inject(Router).createUrlTree(['/s', slug, 'dashboard']) : inject(Router).createUrlTree(['/login']);
};

export const routes: Routes = [
  { path: 'login', component: LoginPage, title: 'Kirish · DarsJadval' },
  { path: 'tablet/:token', component: TabletPage, title: 'DarsJadval' },
  {
    path: 's/:slug',
    component: AdminShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPage, title: 'Boshqaruv paneli · DarsJadval' },
      { path: 'timetable', component: TimetablePage, title: 'Dars jadvali · DarsJadval' },
      { path: 'exams', component: ExamsPage, title: 'Imtihonlar · DarsJadval' },
      { path: 'clubs', component: ClubsPage, title: "To'garaklar · DarsJadval" },
      { path: 'calendar', component: CalendarPage, title: 'Kalendar · DarsJadval' },
      { path: 'bells', component: BellsPage, title: "Qo'ng'iroq jadvali · DarsJadval" },
      { path: 'subjects', component: EntityPage, data: { config: ENTITY_CONFIGS['subjects'] }, title: 'Fanlar · DarsJadval' },
      { path: 'teachers', component: EntityPage, data: { config: ENTITY_CONFIGS['teachers'] }, title: "O'qituvchilar · DarsJadval" },
      { path: 'rooms', component: EntityPage, data: { config: ENTITY_CONFIGS['rooms'] }, title: 'Xonalar · DarsJadval' },
      { path: 'groups', component: EntityPage, data: { config: ENTITY_CONFIGS['groups'] }, title: 'Guruhlar · DarsJadval' },
      { path: 'quotes', component: EntityPage, data: { config: ENTITY_CONFIGS['quotes'] }, title: "Hikmatli so'zlar · DarsJadval" },
      { path: 'tablets', component: TabletsPage, title: 'Planshetlar · DarsJadval' },
      { path: 'settings', component: SettingsPage, title: 'Sozlamalar · DarsJadval' },
    ],
  },
  { path: '', pathMatch: 'full', canActivate: [authGuard, toFirstSchool], children: [] },
  { path: '**', redirectTo: '' },
];
