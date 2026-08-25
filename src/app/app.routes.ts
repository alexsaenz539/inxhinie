import { CanDeactivateFn, Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { AdminComponent } from './features/admin/admin.component';
import { LoginComponent } from './features/login/login.component';
import { PublicComponent } from './features/public/public.component';

const pendingCatalogChangesGuard: CanDeactivateFn<AdminComponent> = (component) => component.confirmNavigationAway();

export const routes: Routes = [
  { path: '', component: PublicComponent, title: 'INXHINIE Construcciones | Ingeniería y arquitectura' },
  { path: 'acceso', component: LoginComponent, title: 'Acceso | INXHINIE' },
  { path: 'admin', redirectTo: 'admin/resumen', pathMatch: 'full' },
  { path: 'admin/:section', component: AdminComponent, canActivate: [authGuard], canDeactivate: [pendingCatalogChangesGuard], title: 'Administración | INXHINIE' },
  { path: '**', redirectTo: '' },
];
