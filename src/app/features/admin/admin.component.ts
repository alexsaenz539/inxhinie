import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase.service';

type Lead = { id: string; first_name: string; last_name?: string; phone: string; email?: string; city?: string; source: string; status: string; created_at: string; quote_requests?: { service_name: string; area_sqm?: number; estimate_low?: number; estimate_high?: number }[] };
const sampleLeads: Lead[] = [
  { id: 'demo-1', first_name: 'Mariana', last_name: 'López', phone: '618 000 0001', city: 'Durango, Dgo.', source: 'website', status: 'new', created_at: '2026-08-20T10:00:00Z', quote_requests: [{ service_name: 'Pérgolas arquitectónicas', area_sqm: 24, estimate_low: 112320, estimate_high: 139776 }] },
  { id: 'demo-2', first_name: 'Carlos', last_name: 'Mendoza', phone: '618 000 0002', city: 'Durango, Dgo.', source: 'whatsapp', status: 'contacted', created_at: '2026-08-19T10:00:00Z', quote_requests: [{ service_name: 'Estructuras y semi-arcos', area_sqm: 36 }] },
  { id: 'demo-3', first_name: 'Colegio Horizonte', phone: '618 000 0003', city: 'Canatlán, Dgo.', source: 'website', status: 'visit_scheduled', created_at: '2026-08-18T10:00:00Z', quote_requests: [{ service_name: 'Domos y techumbres', area_sqm: 280 }] },
];
@Component({ selector: 'app-admin', imports: [FormsModule, RouterLink], templateUrl: './admin.component.html', styleUrl: './admin.component.css' })
export class AdminComponent implements OnInit {
  private readonly supabase = inject(SupabaseService); private readonly router = inject(Router);
  readonly leads = signal<Lead[]>([]); readonly loading = signal(true); readonly menu = signal<'dashboard' | 'leads' | 'catalog'>('dashboard'); readonly message = signal('');
  readonly statuses = [{ value: 'new', label: 'Nueva' }, { value: 'contacted', label: 'Contactado' }, { value: 'visit_scheduled', label: 'Visita programada' }, { value: 'quoting', label: 'Cotización' }, { value: 'negotiation', label: 'Negociación' }, { value: 'accepted', label: 'Aceptada' }, { value: 'rejected', label: 'Rechazada' }];
  async ngOnInit() { const response = await this.supabase.getLeads(); this.leads.set(response.data?.length ? response.data as Lead[] : sampleLeads); this.loading.set(false); if (!this.supabase.configured) this.message.set('Modo demostración: conecta Supabase para administrar información real.'); }
  count(status: string) { return this.leads().filter((lead) => lead.status === status).length; }
  async changeStatus(lead: Lead, status: string) { const previous = this.leads(); this.leads.set(previous.map((item) => item.id === lead.id ? { ...item, status } : item)); if (!lead.id.startsWith('demo-')) await this.supabase.updateLeadStatus(lead.id, status); }
  service(lead: Lead) { return lead.quote_requests?.[0]?.service_name ?? 'Solicitud general'; }
  area(lead: Lead) { return lead.quote_requests?.[0]?.area_sqm; }
  async logout() { await this.supabase.signOut(); await this.router.navigateByUrl('/'); }
}
