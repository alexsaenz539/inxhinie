import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { AdminComponent } from './features/admin/admin.component';
import { LoginComponent } from './features/login/login.component';
import { PublicComponent } from './features/public/public.component';

export const routes: Routes = [
  { path: '', component: PublicComponent, title: 'INXHINIE Construcciones | Ingeniería y arquitectura' },
  { path: 'acceso', component: LoginComponent, title: 'Acceso | INXHINIE' },
  { path: 'admin', component: AdminComponent, canActivate: [authGuard], title: 'Administración | INXHINIE' },
  { path: '**', redirectTo: '' },
];
