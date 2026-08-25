import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PortfolioCategory, PortfolioMedia, PortfolioProject, PortfolioProjectInput, QuoteCatalog, SupabaseService } from '../../core/supabase.service';

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
type PortfolioDraft = Omit<PortfolioProjectInput, 'category_id'> & { id?: string; category_id: string | null };
type PendingPortfolioImage = { file: File; url: string };
type AdminSection = 'dashboard' | 'leads' | 'portfolio' | 'catalog';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly leads = signal<Lead[]>([]);
  readonly loading = signal(true);
  readonly storageUsageBytes = signal(0);
  readonly storageLoading = signal(true);
  readonly storageQuotaBytes = 1024 * 1024 * 1024;
  readonly message = signal('');
  readonly menu = signal<AdminSection>('dashboard');
  readonly mobileMenuOpen = signal(false);
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
  readonly catalogTab = signal<'rules' | 'catalogs' | 'categories'>('rules');
  readonly portfolioProjects = signal<PortfolioProject[]>([]);
  readonly portfolioCategories = signal<PortfolioCategory[]>([]);
  readonly loadingPortfolio = signal(false);
  readonly savingPortfolio = signal(false);
  readonly uploadingPortfolio = signal(false);
  readonly pendingPortfolioImages = signal<PendingPortfolioImage[]>([]);
  readonly portfolioImagePreview = signal<{ url: string; alt: string } | null>(null);
  readonly portfolioImagePreviewIndex = signal(0);
  readonly portfolioCategoryFilter = signal('all');
  readonly portfolioSelectionMode = signal(false);
  readonly selectedPortfolioProjectIds = signal<string[]>([]);
  readonly portfolioMediaSelectionMode = signal(false);
  readonly selectedPortfolioMediaIds = signal<string[]>([]);
  readonly processingPortfolioMedia = signal(false);
  readonly showPortfolioCoverOnly = signal(false);
  readonly deletingPortfolioProjects = signal(false);
  readonly confirmationDialog = signal<{ title: string; message: string } | null>(null);
  readonly catalogExitDialog = signal(false);
  readonly catalogSavedToast = signal(false);
  private confirmationResolver: ((confirmed: boolean) => void) | null = null;
  private catalogSnapshot = '';
  private pendingCatalogExit: AdminSection | 'logout' | null = null;
  private catalogExitResolver: ((allowed: boolean) => void) | null = null;
  private catalogToastTimer: ReturnType<typeof setTimeout> | undefined;
  newPortfolioCategoryName = '';
  portfolioDraft: PortfolioDraft | null = null;
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
  readonly filteredPortfolioProjects = computed(() => {
    const categoryId = this.portfolioCategoryFilter();
    return this.portfolioProjects().filter((project) => categoryId === 'all' || project.category_id === categoryId);
  });
  readonly allVisiblePortfolioProjectsSelected = computed(() => {
    const projects = this.filteredPortfolioProjects();
    const selected = this.selectedPortfolioProjectIds();
    return projects.length > 0 && projects.every((project) => selected.includes(project.id));
  });
  readonly selectedPortfolioProjectsArePublished = computed(() => {
    const selected = this.portfolioProjects().filter((project) => this.selectedPortfolioProjectIds().includes(project.id));
    return selected.length > 0 && selected.every((project) => project.published);
  });
  readonly storageRemainingBytes = computed(() => Math.max(0, this.storageQuotaBytes - this.storageUsageBytes()));
  readonly storageUsagePercent = computed(() => Math.min(100, (this.storageUsageBytes() / this.storageQuotaBytes) * 100));

  async ngOnInit() {
    await this.loadLeads();
    await this.loadStorageUsage();
    this.route.paramMap.subscribe((params) => void this.activateSection(params.get('section')));
  }

  async loadStorageUsage() {
    this.storageLoading.set(true);
    const response = await this.supabase.getPortfolioStorageUsage();
    this.storageUsageBytes.set(response.bytes);
    this.storageLoading.set(false);
  }

  formatStorage(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(bytes >= 1024 * 1024 * 1024 ? 2 : 3)} GB`;
  }

  storagePercentLabel() {
    return `${this.storageUsagePercent().toFixed(1)}%`;
  }

  async navigateTo(section: AdminSection) {
    this.mobileMenuOpen.set(false);
    if (section !== 'catalog' && this.menu() === 'catalog' && this.hasCatalogChanges()) {
      this.pendingCatalogExit = section;
      this.catalogExitDialog.set(true);
      return;
    }
    const paths = { dashboard: 'resumen', leads: 'prospectos', portfolio: 'portafolio', catalog: 'catalogos' };
    await this.router.navigate(['/admin', paths[section]]);
  }

  private async activateSection(section: string | null) {
    const menus = { resumen: 'dashboard', prospectos: 'leads', portafolio: 'portfolio', catalogos: 'catalog' } as const;
    const menu = menus[section as keyof typeof menus] ?? 'dashboard';
    this.menu.set(menu);
    if (menu === 'portfolio') await this.loadPortfolio();
    if (menu === 'catalog') await this.loadCatalog();
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
    await this.navigateTo('catalog');
  }

  private async loadCatalog() {
    const [response, categoriesResponse] = await Promise.all([this.supabase.getQuoteCatalog(), this.supabase.getPortfolioCategories()]);
    if (response.data) {
      const catalog = structuredClone(response.data);
      this.catalog.set(catalog);
      this.catalogSnapshot = JSON.stringify(catalog);
    }
    else this.message.set('No se encontró el catálogo. Ejecuta la migración de catálogos en Supabase.');
    if (categoriesResponse.error) this.message.set('No fue posible cargar las categorías de proyectos.');
    else this.portfolioCategories.set(categoriesResponse.data);
  }

  async openPortfolio() {
    await this.navigateTo('portfolio');
  }

  async loadPortfolio() {
    this.loadingPortfolio.set(true);
    const [projectsResponse, categoriesResponse] = await Promise.all([this.supabase.getPortfolioProjects(), this.supabase.getPortfolioCategories()]);
    this.loadingPortfolio.set(false);
    if (projectsResponse.error || categoriesResponse.error) {
      this.message.set('No fue posible cargar los proyectos. Verifica los permisos de Supabase.');
      return;
    }
    this.portfolioProjects.set(projectsResponse.data);
    this.portfolioCategories.set(categoriesResponse.data);
  }

  newPortfolioProject() {
    this.clearPendingPortfolioImages();
    this.portfolioDraft = { name: '', slug: '', description: '', location_label: null, category_id: this.portfolioCategories()[0]?.id ?? null, area_sqm: null, duration_days: null, published: true, featured: false, completed_at: null };
  }

  editPortfolioProject(project: PortfolioProject) {
    this.clearPendingPortfolioImages();
    this.selectedPortfolioMediaIds.set([]);
    this.portfolioMediaSelectionMode.set(false);
    this.portfolioDraft = { id: project.id, name: project.name, slug: project.slug, description: project.description, location_label: project.location_label, category_id: project.category_id, area_sqm: project.area_sqm, duration_days: project.duration_days, published: project.published, featured: project.featured, completed_at: project.completed_at };
  }

  closePortfolioModal() {
    this.clearPendingPortfolioImages();
    this.closePortfolioImagePreview();
    this.portfolioDraft = null;
    this.selectedPortfolioMediaIds.set([]);
    this.portfolioMediaSelectionMode.set(false);
    this.showPortfolioCoverOnly.set(false);
  }

  togglePortfolioMediaSelectionMode() {
    if (this.portfolioMediaSelectionMode()) this.selectedPortfolioMediaIds.set([]);
    this.portfolioMediaSelectionMode.update((enabled) => !enabled);
  }

  visiblePortfolioMedia(projectId: string) {
    const media = this.portfolioMedia(projectId);
    return this.showPortfolioCoverOnly() ? media.filter((item) => item.sort_order === 0) : media;
  }

  togglePortfolioMediaSelection(mediaId: string) {
    this.selectedPortfolioMediaIds.update((ids) => ids.includes(mediaId) ? ids.filter((id) => id !== mediaId) : [...ids, mediaId]);
  }

  async removeSelectedPortfolioMedia() {
    const media = this.portfolioMedia(this.portfolioDraft?.id ?? '').filter((item) => this.selectedPortfolioMediaIds().includes(item.id));
    if (!media.length || !(await this.requestConfirmation(`¿Eliminar ${media.length} imágenes seleccionadas?`))) return;
    this.processingPortfolioMedia.set(true);
    for (const item of media) await this.supabase.deletePortfolioMedia(item);
    this.selectedPortfolioMediaIds.set([]);
    this.portfolioMediaSelectionMode.set(false);
    await this.loadPortfolio();
    await this.loadStorageUsage();
    this.processingPortfolioMedia.set(false);
  }

  async setPortfolioCover(media: PortfolioMedia) {
    const projectId = this.portfolioDraft?.id;
    if (!projectId || media.sort_order === 0) return;
    this.processingPortfolioMedia.set(true);
    const result = await this.supabase.setPortfolioMediaCover(projectId, media.id);
    if (result.error) {
      this.message.set('No fue posible cambiar la imagen de portada.');
    } else {
      this.portfolioProjects.update((projects) => projects.map((project) => {
        if (project.id !== projectId) return project;
        const mediaOrder = [media.id, ...project.portfolio_media.map((item) => item.id).filter((id) => id !== media.id)];
        return { ...project, portfolio_media: mediaOrder.map((id, index) => ({ ...project.portfolio_media.find((item) => item.id === id)!, sort_order: index })) };
      }));
    }
    this.processingPortfolioMedia.set(false);
  }

  choosePortfolioCover(event: MouseEvent, media: PortfolioMedia) {
    event.preventDefault();
    event.stopPropagation();
    void this.setPortfolioCover(media);
  }

  openPortfolioImagePreview(index = 0) {
    const image = this.pendingPortfolioImages()[index];
    if (!image) return;
    this.portfolioImagePreviewIndex.set(index);
    this.portfolioImagePreview.set({ url: image.url, alt: image.file.name });
  }

  changePortfolioImagePreview(direction: -1 | 1) {
    const images = this.pendingPortfolioImages();
    if (images.length < 2) return;
    const index = (this.portfolioImagePreviewIndex() + direction + images.length) % images.length;
    this.openPortfolioImagePreview(index);
  }

  closePortfolioImagePreview() {
    this.portfolioImagePreview.set(null);
    this.portfolioImagePreviewIndex.set(0);
  }

  @HostListener('document:keydown', ['$event'])
  handlePortfolioPreviewKeys(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.confirmationDialog()) {
      this.resolveConfirmation(false);
      return;
    }
    if (event.key === 'Escape' && this.catalogExitDialog()) {
      void this.resolveCatalogExit('cancel');
      return;
    }
    if (event.key === 'Escape' && this.mobileMenuOpen()) {
      this.mobileMenuOpen.set(false);
      return;
    }
    if (!this.portfolioImagePreview()) return;
    if (event.key === 'Escape') this.closePortfolioImagePreview();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.changePortfolioImagePreview(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.hasCatalogChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  requestConfirmation(message: string, title = 'Confirmar acción') {
    return new Promise<boolean>((resolve) => {
      this.confirmationResolver = resolve;
      this.confirmationDialog.set({ title, message });
    });
  }

  resolveConfirmation(confirmed: boolean) {
    this.confirmationDialog.set(null);
    this.confirmationResolver?.(confirmed);
    this.confirmationResolver = null;
  }

  portfolioMedia(projectId: string) {
    return this.portfolioProjects().find((project) => project.id === projectId)?.portfolio_media ?? [];
  }

  portfolioMediaUrl(media: PortfolioMedia) {
    return this.supabase.portfolioMediaUrl(media.storage_path);
  }

  async savePortfolioProject() {
    const draft = this.portfolioDraft;
    if (!draft || !draft.name.trim() || !draft.category_id || !draft.description.trim()) {
      this.message.set('Completa nombre, categoría y descripción del proyecto.');
      return;
    }
    const input: PortfolioProjectInput = {
      ...draft,
      slug: draft.slug || this.slugify(draft.name),
      name: draft.name.trim(),
      category_id: draft.category_id,
      description: draft.description.trim(),
      location_label: draft.location_label?.trim() || null,
      area_sqm: draft.area_sqm ? Number(draft.area_sqm) : null,
      duration_days: draft.duration_days ? Number(draft.duration_days) : null,
      completed_at: draft.completed_at || null,
    };
    this.savingPortfolio.set(true);
    const result = draft.id ? await this.supabase.updatePortfolioProject(draft.id, input) : await this.supabase.createPortfolioProject(input);
    this.savingPortfolio.set(false);
    if (result.error || !result.data) {
      this.message.set('No fue posible guardar el proyecto. Verifica que el nombre no esté duplicado y que tengas permisos.');
      return;
    }
    this.portfolioDraft = { ...input, id: result.data.id };
    if (this.pendingPortfolioImages().length) {
      const uploaded = await this.uploadPendingPortfolioImages(result.data as PortfolioProject);
      if (!uploaded) return;
      await this.loadStorageUsage();
    }
    await this.loadPortfolio();
    this.closePortfolioModal();
    this.message.set(draft.id ? 'Proyecto actualizado.' : 'Proyecto creado correctamente.');
  }

  stagePortfolioFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    if (files.some((file) => !file.type.startsWith('image/') || file.size > 8 * 1024 * 1024)) {
      this.message.set('Cada archivo debe ser una imagen de máximo 8 MB.');
      input.value = '';
      return;
    }
    this.pendingPortfolioImages.update((images) => [...images, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    input.value = '';
  }

  async uploadPendingPortfolioImages(project: PortfolioProject) {
    const pending = this.pendingPortfolioImages();
    if (!pending.length) return true;
    this.uploadingPortfolio.set(true);
    const result = await this.supabase.uploadPortfolioMedia(project, pending.map((image) => image.file));
    this.uploadingPortfolio.set(false);
    if (result.error) {
      this.message.set('No fue posible subir la imagen. Verifica el bucket portfolio y los permisos de Storage.');
      return false;
    }
    this.clearPendingPortfolioImages();
    return true;
  }

  private clearPendingPortfolioImages() {
    this.pendingPortfolioImages().forEach((image) => URL.revokeObjectURL(image.url));
    this.pendingPortfolioImages.set([]);
  }

  async removePortfolioMedia(media: PortfolioMedia) {
    if (!(await this.requestConfirmation('¿Eliminar esta imagen del proyecto?'))) return;
    this.processingPortfolioMedia.set(true);
    const result = await this.supabase.deletePortfolioMedia(media);
    if (result.error) {
      this.processingPortfolioMedia.set(false);
      this.message.set('No fue posible eliminar la imagen.');
      return;
    }
    await this.loadPortfolio();
    await this.loadStorageUsage();
    this.processingPortfolioMedia.set(false);
  }

  async removePortfolioProject(project: PortfolioProject) {
    if (!(await this.requestConfirmation(`¿Eliminar "${project.name}" y todas sus imágenes?`))) return;
    const result = await this.supabase.deletePortfolioProject(project);
    if (result.error) {
      this.message.set('No fue posible eliminar el proyecto.');
      return;
    }
    if (this.portfolioDraft?.id === project.id) this.closePortfolioModal();
    this.selectedPortfolioProjectIds.update((ids) => ids.filter((id) => id !== project.id));
    await this.loadPortfolio();
    await this.loadStorageUsage();
    this.message.set('Proyecto eliminado.');
  }

  isPortfolioProjectSelected(projectId: string) {
    return this.selectedPortfolioProjectIds().includes(projectId);
  }

  togglePortfolioProjectSelection(projectId: string) {
    this.selectedPortfolioProjectIds.update((ids) => ids.includes(projectId) ? ids.filter((id) => id !== projectId) : [...ids, projectId]);
  }

  togglePortfolioProjectSelectionFromCard(projectId: string, event: MouseEvent) {
    if (!this.portfolioSelectionMode()) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input, label')) return;
    this.togglePortfolioProjectSelection(projectId);
  }

  toggleAllVisiblePortfolioProjects() {
    const projectIds = this.filteredPortfolioProjects().map((project) => project.id);
    if (this.allVisiblePortfolioProjectsSelected()) {
      this.selectedPortfolioProjectIds.update((ids) => ids.filter((id) => !projectIds.includes(id)));
      return;
    }
    this.selectedPortfolioProjectIds.update((ids) => [...new Set([...ids, ...projectIds])]);
  }

  togglePortfolioSelectionMode() {
    if (this.portfolioSelectionMode()) this.selectedPortfolioProjectIds.set([]);
    this.portfolioSelectionMode.update((enabled) => !enabled);
  }

  async removeSelectedPortfolioProjects() {
    const selectedIds = this.selectedPortfolioProjectIds();
    const projects = this.portfolioProjects().filter((project) => selectedIds.includes(project.id));
    if (!projects.length || !(await this.requestConfirmation(`¿Eliminar ${projects.length} proyectos seleccionados y todas sus imágenes?`))) return;
    this.deletingPortfolioProjects.set(true);
    const removedIds: string[] = [];
    const failedNames: string[] = [];
    for (const project of projects) {
      const result = await this.supabase.deletePortfolioProject(project);
      if (result.error) failedNames.push(project.name);
      else removedIds.push(project.id);
    }
    this.deletingPortfolioProjects.set(false);
    if (this.portfolioDraft?.id && removedIds.includes(this.portfolioDraft.id)) this.closePortfolioModal();
    this.selectedPortfolioProjectIds.set([]);
    this.portfolioSelectionMode.set(false);
    await this.loadPortfolio();
    if (removedIds.length) await this.loadStorageUsage();
    this.message.set(failedNames.length ? `No fue posible eliminar: ${failedNames.join(', ')}.` : `${removedIds.length} proyectos eliminados.`);
  }

  async toggleSelectedPortfolioVisibility() {
    const projects = this.portfolioProjects().filter((project) => this.selectedPortfolioProjectIds().includes(project.id));
    if (!projects.length) return;
    const published = !this.selectedPortfolioProjectsArePublished();
    if (!(await this.requestConfirmation(`${published ? '¿Hacer visibles' : '¿Ocultar'} para el público ${projects.length} proyectos seleccionados?`))) return;
    this.deletingPortfolioProjects.set(true);
    for (const project of projects) {
      await this.supabase.updatePortfolioProject(project.id, {
        name: project.name,
        slug: project.slug,
        description: project.description,
        location_label: project.location_label,
        category_id: project.category_id,
        area_sqm: project.area_sqm,
        duration_days: project.duration_days,
        published,
        featured: project.featured,
        completed_at: project.completed_at,
      });
    }
    this.deletingPortfolioProjects.set(false);
    this.selectedPortfolioProjectIds.set([]);
    this.portfolioSelectionMode.set(false);
    await this.loadPortfolio();
    this.message.set(`${projects.length} proyectos ${published ? 'visibles para el público' : 'ocultos del público'}.`);
  }

  async createPortfolioCategory() {
    const name = this.newPortfolioCategoryName.trim();
    if (!name) return;
    const result = await this.supabase.createPortfolioCategory(name);
    if (result.error) {
      this.message.set('No fue posible crear la categoría. El nombre debe ser único.');
      return;
    }
    this.newPortfolioCategoryName = '';
    await this.loadPortfolio();
  }

  async savePortfolioCategory(category: PortfolioCategory) {
    if (!category.name.trim()) return;
    const result = await this.supabase.updatePortfolioCategory(category);
    if (result.error) {
      this.message.set('No fue posible actualizar la categoría.');
      return;
    }
    await this.loadPortfolio();
  }

  async removePortfolioCategory(category: PortfolioCategory) {
    if (!(await this.requestConfirmation(`¿Eliminar la categoría "${category.name}"?`))) return;
    const result = await this.supabase.deletePortfolioCategory(category.id);
    if (result.error) {
      this.message.set('No se puede eliminar una categoría asignada a proyectos. Reasigna esas obras antes de eliminarla.');
      return;
    }
    await this.loadPortfolio();
  }

  private slugify(value: string) {
    return `${value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()}`;
  }

  hasCatalogChanges() {
    return Boolean(this.catalog()) && JSON.stringify(this.catalog()) !== this.catalogSnapshot;
  }

  confirmNavigationAway() {
    if (this.menu() !== 'catalog' || !this.hasCatalogChanges()) return true;
    return new Promise<boolean>((resolve) => {
      this.catalogExitResolver = resolve;
      this.catalogExitDialog.set(true);
    });
  }

  async saveCatalog() {
    const catalog = this.catalog();
    if (!catalog || !catalog.services.length || !catalog.qualities.length) {
      this.message.set('Agrega al menos un servicio y una calidad antes de guardar.');
      return false;
    }
    this.savingCatalog.set(true);
    const result = await this.supabase.saveQuoteCatalog(catalog);
    this.savingCatalog.set(false);
    if (result.error) {
      this.message.set('No fue posible guardar el catálogo. Verifica permisos de administrador.');
      return false;
    }
    this.catalogSnapshot = JSON.stringify(catalog);
    this.message.set('');
    this.showCatalogSavedToast();
    return true;
  }

  private showCatalogSavedToast() {
    this.catalogSavedToast.set(true);
    if (this.catalogToastTimer) clearTimeout(this.catalogToastTimer);
    this.catalogToastTimer = setTimeout(() => this.catalogSavedToast.set(false), 3600);
  }

  addService() { this.catalog.update((catalog) => catalog ? { ...catalog, services: [...catalog.services, { name: 'Nueva especialidad', rate: 0, materials: [] }] } : catalog); }
  addMaterial() { this.catalog.update((catalog) => catalog ? { ...catalog, materials: [...catalog.materials, 'Nuevo material'] } : catalog); }
  addProperty() { this.catalog.update((catalog) => catalog ? { ...catalog, properties: [...catalog.properties, 'Nuevo tipo de inmueble'] } : catalog); }
  addQuality() { this.catalog.update((catalog) => catalog ? { ...catalog, qualities: [...catalog.qualities, { key: `quality_${Date.now()}`, label: 'Nueva calidad', multiplier: 1 }] } : catalog); }
  addAddon() { this.catalog.update((catalog) => catalog ? { ...catalog, addons: [...catalog.addons, { key: `addon_${Date.now()}`, label: 'Nuevo adicional', rate: 0 }] } : catalog); }
  removeItem(collection: 'services' | 'materials' | 'properties' | 'qualities' | 'addons', index: number) {
    this.catalog.update((catalog) => {
      if (!catalog) return catalog;
      const material = collection === 'materials' ? catalog.materials[index] : null;
      return {
        ...catalog,
        [collection]: catalog[collection].filter((_, itemIndex) => itemIndex !== index),
        ...(material ? { services: catalog.services.map((service) => ({ ...service, materials: service.materials.filter((item) => item !== material) })) } : {}),
      };
    });
  }

  toggleServiceMaterial(serviceIndex: number, material: string) {
    this.catalog.update((catalog) => {
      if (!catalog) return catalog;
      const service = catalog.services[serviceIndex];
      const materials = service.materials.includes(material) ? service.materials.filter((item) => item !== material) : [...service.materials, material];
      return { ...catalog, services: catalog.services.map((item, index) => index === serviceIndex ? { ...item, materials } : item) };
    });
  }

  async resolveCatalogExit(action: 'cancel' | 'discard' | 'save') {
    if (action === 'cancel') {
      this.catalogExitDialog.set(false);
      this.pendingCatalogExit = null;
      this.catalogExitResolver?.(false);
      this.catalogExitResolver = null;
      return;
    }
    if (action === 'save' && !(await this.saveCatalog())) return;
    if (action === 'discard' && this.catalogSnapshot) this.catalog.set(JSON.parse(this.catalogSnapshot) as QuoteCatalog);
    const destination = this.pendingCatalogExit;
    const resolver = this.catalogExitResolver;
    this.catalogExitDialog.set(false);
    this.pendingCatalogExit = null;
    this.catalogExitResolver = null;
    if (resolver) {
      resolver(true);
      return;
    }
    if (destination === 'logout') await this.performLogout();
    else if (destination) await this.navigateTo(destination);
  }

  async logout() {
    if (this.menu() === 'catalog' && this.hasCatalogChanges()) {
      this.pendingCatalogExit = 'logout';
      this.catalogExitDialog.set(true);
      return;
    }
    await this.performLogout();
  }

  private async performLogout() {
    await this.supabase.signOut();
    await this.router.navigateByUrl('/acceso');
  }
}
