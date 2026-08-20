-- INXHINIE MVP: commercial site, lead capture and CRM foundation.
create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'staff');
create type public.lead_status as enum ('new', 'contacted', 'visit_scheduled', 'quoting', 'negotiation', 'accepted', 'rejected', 'cancelled', 'unresponsive');
create type public.media_phase as enum ('before', 'during', 'after', 'general');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null,
  hero_image_path text,
  indicative_price_from numeric(12,2),
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null,
  location_label text,
  project_type text,
  area_sqm numeric(10,2),
  duration_days integer,
  published boolean not null default false,
  featured boolean not null default false,
  completed_at date,
  created_at timestamptz not null default now()
);

create table public.portfolio_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  phase public.media_phase not null default 'general',
  sort_order integer not null default 0
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text,
  phone text not null check (char_length(phone) between 8 and 20),
  email text,
  city text,
  source text not null default 'website',
  status public.lead_status not null default 'new',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  service_name text not null,
  area_sqm numeric(10,2) check (area_sqm is null or area_sqm > 0),
  budget_range text,
  planned_start text,
  description text not null check (char_length(description) >= 12),
  estimate_low numeric(12,2),
  estimate_high numeric(12,2),
  created_at timestamptz not null default now()
);

create table public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quote_requests(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  created_at timestamptz not null default now()
);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  activity_type text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create table public.estimator_rules (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete cascade,
  quality_key text not null default 'standard',
  base_rate_per_sqm numeric(12,2) not null check (base_rate_per_sqm >= 0),
  quality_multiplier numeric(5,2) not null default 1 check (quality_multiplier > 0),
  variance_low numeric(5,2) not null default .9,
  variance_high numeric(5,2) not null default 1.12,
  active boolean not null default true,
  unique (service_id, quality_key)
);

create table public.estimator_results (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  service_name text not null,
  inputs jsonb not null default '{}'::jsonb,
  estimate_low numeric(12,2),
  estimate_high numeric(12,2),
  created_at timestamptz not null default now()
);

create table public.app_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active = true);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active = true and role = 'admin');
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger leads_touch_updated_at before update on public.leads for each row execute procedure public.touch_updated_at();
create trigger services_touch_updated_at before update on public.services for each row execute procedure public.touch_updated_at();

-- Public capture runs through one constrained function so the anonymous visitor
-- can never query, update, or enumerate commercial records.
create or replace function public.submit_quote_request(
  p_first_name text, p_last_name text, p_phone text, p_email text, p_city text,
  p_service_name text, p_area_sqm numeric, p_budget_range text, p_planned_start text,
  p_description text, p_estimate_low numeric, p_estimate_high numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_lead_id uuid;
begin
  if char_length(trim(p_first_name)) = 0 or char_length(trim(p_phone)) < 8 or char_length(trim(p_description)) < 12 then
    raise exception 'Invalid quote request';
  end if;
  insert into public.leads (first_name, last_name, phone, email, city, source, status)
  values (trim(p_first_name), nullif(trim(p_last_name), ''), trim(p_phone), nullif(trim(p_email), ''), nullif(trim(p_city), ''), 'website', 'new')
  returning id into v_lead_id;
  insert into public.quote_requests (lead_id, service_name, area_sqm, budget_range, planned_start, description, estimate_low, estimate_high)
  values (v_lead_id, trim(p_service_name), p_area_sqm, nullif(trim(p_budget_range), ''), nullif(trim(p_planned_start), ''), trim(p_description), p_estimate_low, p_estimate_high);
  return v_lead_id;
end;
$$;
grant execute on function public.submit_quote_request(text, text, text, text, text, text, numeric, text, text, text, numeric, numeric) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.portfolio_projects enable row level security;
alter table public.portfolio_media enable row level security;
alter table public.leads enable row level security;
alter table public.quote_requests enable row level security;
alter table public.request_attachments enable row level security;
alter table public.lead_activities enable row level security;
alter table public.estimator_rules enable row level security;
alter table public.estimator_results enable row level security;
alter table public.app_settings enable row level security;

create policy "public reads published services" on public.services for select using (published or public.is_staff());
create policy "staff manages services" on public.services for all using (public.is_staff()) with check (public.is_staff());
create policy "public reads categories" on public.service_categories for select using (true);
create policy "staff manages categories" on public.service_categories for all using (public.is_staff()) with check (public.is_staff());
create policy "public reads portfolio" on public.portfolio_projects for select using (published or public.is_staff());
create policy "staff manages portfolio" on public.portfolio_projects for all using (public.is_staff()) with check (public.is_staff());
create policy "public reads visible portfolio media" on public.portfolio_media for select using (exists (select 1 from public.portfolio_projects p where p.id = project_id and (p.published or public.is_staff())));
create policy "staff manages portfolio media" on public.portfolio_media for all using (public.is_staff()) with check (public.is_staff());
create policy "staff reads profiles" on public.profiles for select using (public.is_staff());
create policy "admin manages profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "staff manages leads" on public.leads for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manages quote requests" on public.quote_requests for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manages attachments" on public.request_attachments for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manages activities" on public.lead_activities for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manages estimator rules" on public.estimator_rules for all using (public.is_staff()) with check (public.is_staff());
create policy "staff reads estimator results" on public.estimator_results for select using (public.is_staff());
create policy "staff manages settings" on public.app_settings for all using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true), ('request-attachments', 'request-attachments', false) on conflict (id) do nothing;
create policy "public reads portfolio assets" on storage.objects for select using (bucket_id = 'portfolio');
create policy "staff manages portfolio assets" on storage.objects for all using (bucket_id = 'portfolio' and public.is_staff()) with check (bucket_id = 'portfolio' and public.is_staff());
create policy "staff manages request files" on storage.objects for all using (bucket_id = 'request-attachments' and public.is_staff()) with check (bucket_id = 'request-attachments' and public.is_staff());

create index leads_status_created_idx on public.leads (status, created_at desc);
create index quote_requests_lead_idx on public.quote_requests (lead_id);
create index portfolio_projects_published_idx on public.portfolio_projects (published, featured);
