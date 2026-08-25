import { AfterViewInit, Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { createHeroScrollAnimation } from './hero-scroll.animation';
import { LeadInput, PortfolioProject, QuoteCatalog, SupabaseService } from '../../core/supabase.service';

const fallbackMaterials = ['Membrana Tensada Nacional', 'Membrana Importada Premium', 'Lona Arquitectónica Impermeable', 'Policarbonato Celular o Sólido', 'Deck PVC & Lambrín Imitación Madera', 'Panel Aislante Térmico', 'Lámina Pintro / Galvanizada', 'Requiero asesoría técnica'];
const fallbackCatalog: QuoteCatalog = { services: [{ name: 'Pérgola Residencial / Comercial', rate: 5200, materials: fallbackMaterials }, { name: 'Estructura Metálica & Semi-Arcos', rate: 4400, materials: fallbackMaterials }, { name: 'Domo & Techumbre', rate: 3900, materials: fallbackMaterials }, { name: 'Acabados Imitación Madera', rate: 2300, materials: fallbackMaterials }, { name: 'Remodelación & Proyecto 3D', rate: 6100, materials: fallbackMaterials }], materials: fallbackMaterials, properties: ['Residencial / Casa Habitación', 'Comercial / Restaurante / Negocio', 'Industrial / Bodega / Nave', 'Escolar / Unidad Deportiva'], qualities: [{ key: 'standard', label: 'Estándar', multiplier: 1 }, { key: 'premium', label: 'Premium', multiplier: 1.22 }, { key: 'alto', label: 'Alta especificación', multiplier: 1.45 }], addons: [{ key: 'none', label: 'Sin adicionales', rate: 0 }, { key: 'demolition', label: 'Demolición o retiro', rate: 420 }, { key: 'lighting', label: 'Iluminación integrada', rate: 680 }, { key: 'design', label: 'Modelado 3D previo', rate: 250 }], varianceLow: .9, varianceHigh: 1.12 };

declare global {
  interface Window {
    initializeLandingInteractions?: () => () => void;
    quoteCatalog?: QuoteCatalog;
  }
}

@Component({
  selector: 'app-public',
  templateUrl: './public.component.html',
})
export class PublicComponent implements AfterViewInit, OnDestroy {
  private destroyHeroAnimation: (() => void) | undefined;
  private destroyLandingInteractions: (() => void) | undefined;
  private readonly supabase = inject(SupabaseService);
  readonly quoteCatalog = signal<QuoteCatalog>(fallbackCatalog);
  readonly selectedQuoteService = signal('');
  readonly selectedQuoteMaterial = signal('');
  readonly availableQuoteMaterials = computed(() => this.quoteCatalog().services.find((service) => service.name === this.selectedQuoteService())?.materials ?? []);
  readonly portfolioProjects = signal<PortfolioProject[]>([]);
  readonly portfolioLoading = signal(true);
  readonly portfolioFilter = signal('all');
  readonly portfolioLightbox = signal<{ project: PortfolioProject; index: number } | null>(null);
  readonly portfolioCategories = computed(() => [...new Set(this.portfolioProjects().map((project) => project.portfolio_categories?.name).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, 'es')));
  readonly visiblePortfolioProjects = computed(() => {
    const filter = this.portfolioFilter();
    return filter === 'all' ? this.portfolioProjects() : this.portfolioProjects().filter((project) => project.portfolio_categories?.name === filter);
  });
  private readonly submitQuote = async (event: Event) => {
    const detail = (event as CustomEvent<{ input: LeadInput; whatsappUrl: string }>).detail;
    const button = document.querySelector<HTMLButtonElement>('#btn-submit-calc');
    const status = document.querySelector<HTMLElement>('#quote-submit-status');
    if (!detail || !button || !status) return;

    button.disabled = true;
    status.textContent = 'Guardando tu solicitud...';
    const result = await this.supabase.submitLead(detail.input);
    button.disabled = false;

    if (result.error || result.offline) {
      status.textContent = 'No fue posible registrar la solicitud. Intenta nuevamente.';
      return;
    }

    status.textContent = 'Solicitud registrada. Abriremos WhatsApp para continuar la atención.';
    window.open(detail.whatsappUrl, '_blank', 'noopener');
  };

  async ngAfterViewInit() {
    const [catalogResponse, portfolioResponse] = await Promise.all([this.supabase.getQuoteCatalog(), this.supabase.getPortfolioProjects()]);
    if (catalogResponse.data) this.quoteCatalog.set(catalogResponse.data);
    if (!portfolioResponse.error) this.portfolioProjects.set(portfolioResponse.data);
    this.portfolioLoading.set(false);
    window.quoteCatalog = this.quoteCatalog();
    this.destroyLandingInteractions = window.initializeLandingInteractions?.();
    this.destroyHeroAnimation = createHeroScrollAnimation();
    window.addEventListener('inxhinie:quote-submit', this.submitQuote);
  }

  ngOnDestroy() {
    this.destroyHeroAnimation?.();
    this.destroyLandingInteractions?.();
    window.removeEventListener('inxhinie:quote-submit', this.submitQuote);
  }

  selectQuoteService(service: string) {
    this.selectedQuoteService.set(service);
    this.selectedQuoteMaterial.set('');
  }

  selectQuoteMaterial(material: string) {
    this.selectedQuoteMaterial.set(material);
  }

  portfolioImage(project: PortfolioProject) {
    const media = project.portfolio_media[0];
    return media ? this.supabase.portfolioMediaUrl(media.storage_path) : '';
  }

  openPortfolioLightbox(project: PortfolioProject) {
    const index = 0;
    const media = project.portfolio_media[index];
    if (!media) return;
    this.portfolioLightbox.set({ project, index });
    document.body.style.overflow = 'hidden';
  }

  changePortfolioLightboxImage(direction: -1 | 1) {
    const lightbox = this.portfolioLightbox();
    if (!lightbox || lightbox.project.portfolio_media.length < 2) return;
    const count = lightbox.project.portfolio_media.length;
    this.portfolioLightbox.set({ ...lightbox, index: (lightbox.index + direction + count) % count });
  }

  lightboxImage() {
    const lightbox = this.portfolioLightbox();
    const media = lightbox?.project.portfolio_media[lightbox.index];
    return media ? this.supabase.portfolioMediaUrl(media.storage_path) : '';
  }

  lightboxTitle() {
    const lightbox = this.portfolioLightbox();
    const media = lightbox?.project.portfolio_media[lightbox.index];
    return media?.alt_text || lightbox?.project.name || 'Ampliación de proyecto';
  }

  closePortfolioLightbox() {
    this.portfolioLightbox.set(null);
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown', ['$event'])
  handleLightboxKeys(event: KeyboardEvent) {
    if (!this.portfolioLightbox()) return;
    if (event.key === 'Escape') this.closePortfolioLightbox();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.changePortfolioLightboxImage(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }
}
