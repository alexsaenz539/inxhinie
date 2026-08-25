import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from './environment';

export interface LeadInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  service: string;
  area: number | null;
  budget: string;
  startDate: string;
  description: string;
  estimateLow: number | null;
  estimateHigh: number | null;
}

export interface QuoteCatalog { services: { name: string; rate: number; materials: string[] }[]; materials: string[]; properties: string[]; qualities: { key: string; label: string; multiplier: number }[]; addons: { key: string; label: string; rate: number }[]; varianceLow: number; varianceHigh: number; }

export function normalizeQuoteCatalog(catalog: QuoteCatalog) {
  return {
    ...catalog,
    services: catalog.services.map((service) => ({ ...service, materials: service.materials ?? [...catalog.materials] })),
  };
}

export interface PortfolioMedia {
  id: string;
  project_id: string;
  storage_path: string;
  alt_text: string;
  phase: 'general' | 'before' | 'during' | 'after';
  sort_order: number;
}

export interface PortfolioCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
}

export interface PortfolioProject {
  id: string;
  name: string;
  slug: string;
  description: string;
  location_label: string | null;
  category_id: string;
  area_sqm: number | null;
  duration_days: number | null;
  published: boolean;
  featured: boolean;
  completed_at: string | null;
  created_at: string;
  portfolio_media: PortfolioMedia[];
  portfolio_categories: PortfolioCategory | null;
}

export type PortfolioProjectInput = Pick<PortfolioProject, 'name' | 'slug' | 'description' | 'location_label' | 'category_id' | 'area_sqm' | 'duration_days' | 'published' | 'featured' | 'completed_at'>;

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly configured = Boolean(environment.supabaseUrl && environment.supabaseAnonKey);
  readonly client: SupabaseClient | null = this.configured
    ? createClient(environment.supabaseUrl, environment.supabaseAnonKey)
    : null;

  async submitLead(input: LeadInput) {
    if (!this.client) return { data: null, error: null, offline: true };
    const { data, error } = await this.client.rpc('submit_quote_request', {
      p_first_name: input.firstName,
      p_last_name: input.lastName || null,
      p_phone: input.phone,
      p_email: input.email || null,
      p_city: input.city || null,
      p_service_name: input.service,
      p_area_sqm: input.area,
      p_budget_range: input.budget || null,
      p_planned_start: input.startDate || null,
      p_description: input.description,
      p_estimate_low: input.estimateLow,
      p_estimate_high: input.estimateHigh,
    });
    return { data, error, offline: false };
  }

  async signIn(email: string, password: string) {
    if (!this.client) return { error: new Error('Supabase no está configurado.') };
    return this.client.auth.signInWithPassword({ email, password });
  }

  async setPassword(password: string) {
    if (!this.client) return { error: new Error('Supabase no está configurado.') };
    return this.client.auth.updateUser({ password });
  }

  async isAuthenticated() {
    if (!this.client) return false;
    const { data } = await this.client.auth.getSession();
    return Boolean(data.session);
  }

  async signOut() { await this.client?.auth.signOut(); }

  async getLeads() {
    if (!this.client) return { data: [], error: null };
    return this.client.from('leads').select('*, quote_requests(*)').order('created_at', { ascending: false });
  }

  async getPortfolioStorageUsage() {
    if (!this.client) return { bytes: 0, error: null };
    const visit = async (path: string): Promise<number> => {
      const { data, error } = await this.client!.storage.from('portfolio').list(path, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      return (await Promise.all((data ?? []).map((entry) => {
        const childPath = path ? `${path}/${entry.name}` : entry.name;
        return entry.metadata?.size != null ? Number(entry.metadata.size) : visit(childPath);
      }))).reduce((total, size) => total + size, 0);
    };
    try {
      return { bytes: await visit(''), error: null };
    } catch (error) {
      return { bytes: 0, error };
    }
  }

  async updateLeadStatus(id: string, status: string) {
    return this.client?.from('leads').update({ status }).eq('id', id);
  }

  async createStaffLead(input: LeadInput, source: string) {
    if (!this.client) return { error: new Error('Supabase no está configurado.') };
    const { data: lead, error: leadError } = await this.client.from('leads').insert({ first_name: input.firstName, last_name: input.lastName || null, phone: input.phone, email: input.email || null, city: input.city || null, source, status: 'new' }).select('id').single();
    if (leadError || !lead) return { error: leadError ?? new Error('No fue posible crear el prospecto.') };
    const { error } = await this.client.from('quote_requests').insert({ lead_id: lead.id, service_name: input.service, area_sqm: input.area, budget_range: input.budget || null, planned_start: input.startDate || null, description: input.description, estimate_low: input.estimateLow, estimate_high: input.estimateHigh });
    return { error };
  }

  async getQuoteCatalog() {
    if (!this.client) return { data: null, error: null };
    const { data, error } = await this.client.from('app_settings').select('setting_value').eq('setting_key', 'quote_catalog').maybeSingle();
    const catalog = data?.setting_value as QuoteCatalog | undefined;
    return { data: catalog ? normalizeQuoteCatalog(catalog) : undefined, error };
  }

  async saveQuoteCatalog(catalog: QuoteCatalog) {
    if (!this.client) return { error: new Error('Supabase no está configurado.') };
    return this.client.from('app_settings').upsert({ setting_key: 'quote_catalog', setting_value: catalog });
  }

  async getPortfolioProjects() {
    if (!this.client) return { data: [] as PortfolioProject[], error: null };
    const { data, error } = await this.client
      .from('portfolio_projects')
      .select('*, portfolio_media(*), portfolio_categories(*)')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });
    return { data: (data ?? []).map((project) => ({ ...project, portfolio_media: [...(project.portfolio_media ?? [])].sort((a, b) => a.sort_order - b.sort_order) })) as PortfolioProject[], error };
  }

  async createPortfolioProject(input: PortfolioProjectInput) {
    if (!this.client) return { data: null, error: new Error('Supabase no está configurado.') };
    return this.client.from('portfolio_projects').insert(input).select('*, portfolio_media(*), portfolio_categories(*)').single();
  }

  async updatePortfolioProject(id: string, input: PortfolioProjectInput) {
    if (!this.client) return { data: null, error: new Error('Supabase no está configurado.') };
    return this.client.from('portfolio_projects').update(input).eq('id', id).select('*, portfolio_media(*), portfolio_categories(*)').single();
  }

  async deletePortfolioProject(project: PortfolioProject) {
    if (!this.client) return { error: new Error('Supabase no está configurado.') };
    const paths = project.portfolio_media.map((media) => media.storage_path);
    if (paths.length) {
      const { error } = await this.client.storage.from('portfolio').remove(paths);
      if (error) return { error };
    }
    return this.client.from('portfolio_projects').delete().eq('id', project.id);
  }

  async uploadPortfolioMedia(project: PortfolioProject, files: File[]) {
    if (!this.client) return { error: new Error('Supabase no está configurado.') };
    const media: PortfolioMedia[] = [];
    for (const [index, file] of files.entries()) {
      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${project.id}/${Date.now()}-${index}.${extension}`;
      const { error: uploadError } = await this.client.storage.from('portfolio').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) return { error: uploadError };
      const { data, error } = await this.client.from('portfolio_media').insert({ project_id: project.id, storage_path: path, alt_text: project.name, sort_order: project.portfolio_media.length + media.length }).select().single();
      if (error) {
        await this.client.storage.from('portfolio').remove([path]);
        return { error };
      }
      media.push(data as PortfolioMedia);
    }
    return { data: media, error: null };
  }

  async deletePortfolioMedia(media: PortfolioMedia) {
    if (!this.client) return { error: new Error('Supabase no está configurado.') };
    const { error: storageError } = await this.client.storage.from('portfolio').remove([media.storage_path]);
    if (storageError) return { error: storageError };
    return this.client.from('portfolio_media').delete().eq('id', media.id);
  }

  async setPortfolioMediaCover(projectId: string, mediaId: string) {
    if (!this.client) return { error: new Error('Supabase no está configurado.') };
    const { data, error } = await this.client.from('portfolio_media').select('id, sort_order').eq('project_id', projectId).order('sort_order');
    if (error) return { error };
    const ordered = [mediaId, ...(data ?? []).map((media) => media.id).filter((id) => id !== mediaId)];
    const results = await Promise.all(ordered.map((id, index) => this.client!.from('portfolio_media').update({ sort_order: index }).eq('id', id)));
    return { error: results.find((result) => result.error)?.error ?? null };
  }

  portfolioMediaUrl(storagePath: string) {
    return this.client?.storage.from('portfolio').getPublicUrl(storagePath).data.publicUrl ?? '';
  }

  async getPortfolioCategories() {
    if (!this.client) return { data: [] as PortfolioCategory[], error: null };
    return this.client.from('portfolio_categories').select('*').order('sort_order').order('name');
  }

  async createPortfolioCategory(name: string) {
    if (!this.client) return { data: null, error: new Error('Supabase no está configurado.') };
    const slug = `${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()}`;
    return this.client.from('portfolio_categories').insert({ name: name.trim(), slug }).select().single();
  }

  async updatePortfolioCategory(category: PortfolioCategory) {
    if (!this.client) return { error: new Error('Supabase no está configurado.') };
    return this.client.from('portfolio_categories').update({ name: category.name.trim() }).eq('id', category.id);
  }

  async deletePortfolioCategory(id: string) {
    if (!this.client) return { error: new Error('Supabase no está configurado.') };
    return this.client.from('portfolio_categories').delete().eq('id', id);
  }
}
