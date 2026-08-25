import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase.service';

@Component({
  selector: 'app-confirm-email',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './confirm-email.component.html',
  styleUrl: '../login/login.component.css',
})
export class ConfirmEmailComponent implements OnInit {
  readonly supabase = inject(SupabaseService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly validLink = signal(false);
  readonly form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmation: ['', Validators.required],
  });

  get password() { return this.form.controls.password; }
  get confirmation() { return this.form.controls.confirmation; }

  async ngOnInit() {
    if (!this.supabase.configured) {
      this.error.set('Supabase no está configurado en esta aplicación.');
      this.loading.set(false);
      return;
    }

    const { data, error } = await this.supabase.client!.auth.getSession();
    this.validLink.set(Boolean(data.session));
    this.error.set(error?.message ?? (data.session ? '' : 'El enlace de confirmación no es válido o ya expiró. Solicita uno nuevo al administrador.'));
    this.loading.set(false);
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.password.value !== this.confirmation.value) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    const { error } = await this.supabase.setPassword(this.password.value!);
    this.saving.set(false);
    if (error) {
      this.error.set(error.message);
      return;
    }
    await this.router.navigateByUrl('/admin');
  }
}
