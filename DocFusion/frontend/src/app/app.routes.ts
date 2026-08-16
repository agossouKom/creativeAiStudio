import { Routes } from '@angular/router';
import { AuthComponent } from './components/auth.component';
import { DashboardComponent } from './components/dashboard.component';

export const routes: Routes = [
  { path: 'auth', component: AuthComponent },
  { path: 'dashboard', component: DashboardComponent }
];
