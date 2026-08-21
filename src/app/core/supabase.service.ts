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

export interface QuoteCatalog { services: { name: string; rate: number }[]; materials: string[]; properties: string[]; qualities: { key: string; label: string; multiplier: number }[]; addons: { key: string; label: string; rate: number }[]; varianceLow: number; varianceHigh: number; }

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
    return { data: data?.setting_value as QuoteCatalog | undefined, error };
  }

  async saveQuoteCatalog(catalog: QuoteCatalog) {
    if (!this.client) return { error: new Error('Supabase no está configurado.') };
    return this.client.from('app_settings').upsert({ setting_key: 'quote_catalog', setting_value: catalog });
  }
}
