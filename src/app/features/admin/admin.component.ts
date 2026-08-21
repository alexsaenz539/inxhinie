import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { QuoteCatalog, SupabaseService } from '../../core/supabase.service';

type LeadStatus = 'new' | 'contacted' | 'visit_scheduled' | 'quoting' | 'negotiation' | 'accepted' | 'rejected' | 'cancelled' | 'unresponsive';
type Lead = {
  id: string;
  first_name: string;
  last_name?: string;
  phone: string;
  email?: string;
  city?: string;
  source: string;
  status: LeadStatus;
  created_at: string;
  quote_requests?: { service_name: string; area_sqm?: number; estimate_low?: number; estimate_high?: number; description?: string }[];
};
type BoardColumn = { status: LeadStatus; label: string; accent: string };

@Component({
  selector: 'app-admin',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  readonly leads = signal<Lead[]>([]);
  readonly loading = signal(true);
  readonly message = signal('');
  readonly menu = signal<'dashboard' | 'leads' | 'portfolio' | 'catalog'>('dashboard');
  readonly search = signal('');
  readonly sourceFilter = signal('all');
  readonly draggedLead = signal<Lead | null>(null);
  readonly selectedLead = signal<Lead | null>(null);
  readonly showArchived = signal(false);
  readonly newRequestOpen = signal(false);
  readonly savingRequest = signal(false);
  readonly manualLead = { name: '', phone: '', email: '', city: '', service: '', area: '', source: 'whatsapp', description: '' };
  readonly savingCatalog = signal(false);
  readonly catalog = signal<QuoteCatalog | null>(null);
  readonly boardColumns: BoardColumn[] = [
    { status: 'new', label: 'Nueva', accent: 'gold' },
    { status: 'contacted', label: 'Contactado', accent: 'blue' },
    { status: 'visit_scheduled', label: 'Visita', accent: 'violet' },
    { status: 'quoting', label: 'Cotización', accent: 'orange' },
    { status: 'negotiation', label: 'Negociación', accent: 'rose' },
    { status: 'accepted', label: 'Aceptada', accent: 'green' },
  ];
  readonly statuses: { value: LeadStatus; label: string }[] = [
    ...this.boardColumns.map(({ status, label }) => ({ value: status, label })),
    { value: 'rejected', label: 'Rechazada' },
    { value: 'cancelled', label: 'Cancelada' },
    { value: 'unresponsive', label: 'Sin respuesta' },
  ];
  readonly filteredLeads = computed(() => {
    const search = this.search().trim().toLocaleLowerCase('es-MX');
    const source = this.sourceFilter();
    return this.leads().filter((lead) => {
      const haystack = `${lead.first_name} ${lead.last_name ?? ''} ${lead.city ?? ''} ${this.service(lead)}`.toLocaleLowerCase('es-MX');
      return (!search || haystack.includes(search)) && (source === 'all' || lead.source === source);
    });
  });
  readonly hiddenCount = computed(() => this.filteredLeads().filter((lead) => !this.boardColumns.some((column) => column.status === lead.status)).length);
  readonly archivedLeads = computed(() => this.filteredLeads().filter((lead) => ['rejected', 'cancelled', 'unresponsive'].includes(lead.status)));

  async ngOnInit() {
    await this.loadLeads();
  }

  async loadLeads() {
    this.loading.set(true);
    const response = await this.supabase.getLeads();
    if (this.supabase.configured) {
      if (response.error) {
        this.leads.set([]);
        this.message.set('No fue posible cargar las solicitudes de Supabase. Verifica el acceso del usuario administrador.');
      } else {
        this.leads.set((response.data ?? []) as Lead[]);
        if (!response.data?.length) this.message.set('Aún no hay solicitudes registradas en la base de datos.');
      }
    } else {
      this.leads.set([]);
      this.message.set('Supabase no está configurado.');
    }
    this.loading.set(false);
  }

  count(status: LeadStatus) { return this.leads().filter((lead) => lead.status === status).length; }
  visibleLeads(status: LeadStatus) { return this.filteredLeads().filter((lead) => lead.status === status); }
  service(lead: Lead) { return lead.quote_requests?.[0]?.service_name ?? 'Solicitud general'; }
  area(lead: Lead) { return lead.quote_requests?.[0]?.area_sqm; }
  estimate(lead: Lead) { return lead.quote_requests?.[0]?.estimate_low; }
  description(lead: Lead) { return lead.quote_requests?.[0]?.description ?? 'Sin descripción adicional.'; }
  name(lead: Lead) { return `${lead.first_name} ${lead.last_name ?? ''}`.trim(); }
  initials(lead: Lead) { return this.name(lead).split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase(); }
  date(value: string) { return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(value)); }
  money(value: number) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value); }
  whatsapp(lead: Lead) { return `https://wa.me/52${lead.phone.replace(/\D/g, '')}`; }

  startDrag(lead: Lead, event: DragEvent) {
    this.draggedLead.set(lead);
    event.dataTransfer?.setData('text/plain', lead.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  async dropOn(status: LeadStatus, event: DragEvent) {
    event.preventDefault();
    const lead = this.draggedLead();
    this.draggedLead.set(null);
    if (!lead || lead.status === status) return;
    await this.changeStatus(lead, status);
  }

  async changeStatus(lead: Lead, status: LeadStatus) {
    const previous = this.leads();
    this.leads.set(previous.map((item) => item.id === lead.id ? { ...item, status } : item));
    const response = await this.supabase.updateLeadStatus(lead.id, status);
    if (response?.error) {
      this.leads.set(previous);
      this.message.set('No fue posible actualizar el estado. Intenta nuevamente.');
    }
    const selected = this.selectedLead();
    if (selected?.id === lead.id) this.selectedLead.set({ ...selected, status });
  }

  async createManualLead() {
    const { name, phone, email, city, service, area, source, description } = this.manualLead;
    if (!name.trim() || !phone.trim() || !service.trim() || description.trim().length < 12) {
      this.message.set('Completa nombre, teléfono, servicio y una descripción de al menos 12 caracteres.');
      return;
    }
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts.shift()!;
    this.savingRequest.set(true);
    const result = await this.supabase.createStaffLead({ firstName, lastName: nameParts.join(' '), phone: phone.trim(), email: email.trim(), city: city.trim(), service: service.trim(), area: Number(area) || null, budget: '', startDate: '', description: description.trim(), estimateLow: null, estimateHigh: null }, source);
    this.savingRequest.set(false);
    if (result.error) {
      this.message.set('No fue posible registrar la solicitud. Verifica los permisos de tu usuario.');
      return;
    }
    Object.assign(this.manualLead, { name: '', phone: '', email: '', city: '', service: '', area: '', source: 'whatsapp', description: '' });
    this.newRequestOpen.set(false);
    this.message.set('Solicitud registrada correctamente.');
    await this.loadLeads();
  }

  async openCatalog() {
    this.menu.set('catalog');
    const response = await this.supabase.getQuoteCatalog();
    if (response.data) this.catalog.set(structuredClone(response.data));
    else this.message.set('No se encontró el catálogo. Ejecuta la migración de catálogos en Supabase.');
  }

  async saveCatalog() {
    const catalog = this.catalog();
    if (!catalog || !catalog.services.length || !catalog.qualities.length) {
      this.message.set('Agrega al menos un servicio y una calidad antes de guardar.');
      return;
    }
    this.savingCatalog.set(true);
    const result = await this.supabase.saveQuoteCatalog(catalog);
    this.savingCatalog.set(false);
    this.message.set(result.error ? 'No fue posible guardar el catálogo. Verifica permisos de administrador.' : 'Catálogos y reglas de estimación guardados.');
  }

  addService() { this.catalog.update((catalog) => catalog ? { ...catalog, services: [...catalog.services, { name: 'Nueva especialidad', rate: 0 }] } : catalog); }
  addMaterial() { this.catalog.update((catalog) => catalog ? { ...catalog, materials: [...catalog.materials, 'Nuevo material'] } : catalog); }
  addProperty() { this.catalog.update((catalog) => catalog ? { ...catalog, properties: [...catalog.properties, 'Nuevo tipo de inmueble'] } : catalog); }
  addQuality() { this.catalog.update((catalog) => catalog ? { ...catalog, qualities: [...catalog.qualities, { key: `quality_${Date.now()}`, label: 'Nueva calidad', multiplier: 1 }] } : catalog); }
  addAddon() { this.catalog.update((catalog) => catalog ? { ...catalog, addons: [...catalog.addons, { key: `addon_${Date.now()}`, label: 'Nuevo adicional', rate: 0 }] } : catalog); }
  removeItem(collection: 'services' | 'materials' | 'properties' | 'qualities' | 'addons', index: number) { this.catalog.update((catalog) => catalog ? { ...catalog, [collection]: catalog[collection].filter((_, itemIndex) => itemIndex !== index) } : catalog); }

  async logout() {
    await this.supabase.signOut();
    await this.router.navigateByUrl('/acceso');
  }
}
