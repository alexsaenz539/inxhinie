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
}
