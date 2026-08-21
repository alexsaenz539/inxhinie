import { AfterViewInit, Component, OnDestroy, inject, signal } from '@angular/core';
import { createHeroScrollAnimation } from './hero-scroll.animation';
import { LeadInput, QuoteCatalog, SupabaseService } from '../../core/supabase.service';

const fallbackCatalog: QuoteCatalog = { services: [{ name: 'Pérgola Residencial / Comercial', rate: 5200 }, { name: 'Estructura Metálica & Semi-Arcos', rate: 4400 }, { name: 'Domo & Techumbre', rate: 3900 }, { name: 'Acabados Imitación Madera', rate: 2300 }, { name: 'Remodelación & Proyecto 3D', rate: 6100 }], materials: ['Membrana Tensada Nacional', 'Membrana Importada Premium', 'Lona Arquitectónica Impermeable', 'Policarbonato Celular o Sólido', 'Deck PVC & Lambrín Imitación Madera', 'Panel Aislante Térmico', 'Lámina Pintro / Galvanizada', 'Requiero asesoría técnica'], properties: ['Residencial / Casa Habitación', 'Comercial / Restaurante / Negocio', 'Industrial / Bodega / Nave', 'Escolar / Unidad Deportiva'], qualities: [{ key: 'standard', label: 'Estándar', multiplier: 1 }, { key: 'premium', label: 'Premium', multiplier: 1.22 }, { key: 'alto', label: 'Alta especificación', multiplier: 1.45 }], addons: [{ key: 'none', label: 'Sin adicionales', rate: 0 }, { key: 'demolition', label: 'Demolición o retiro', rate: 420 }, { key: 'lighting', label: 'Iluminación integrada', rate: 680 }, { key: 'design', label: 'Modelado 3D previo', rate: 250 }], varianceLow: .9, varianceHigh: 1.12 };

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
    const response = await this.supabase.getQuoteCatalog();
    if (response.data) this.quoteCatalog.set(response.data);
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
}
