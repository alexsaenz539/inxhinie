create table public.portfolio_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index portfolio_categories_name_lower_idx on public.portfolio_categories (lower(name));

alter table public.portfolio_projects add column category_id uuid references public.portfolio_categories(id);

insert into public.portfolio_categories (name, slug)
select distinct trim(project_type), lower(regexp_replace(trim(project_type), '[^a-zA-Z0-9]+', '-', 'g'))
from public.portfolio_projects
where nullif(trim(project_type), '') is not null
on conflict do nothing;

insert into public.portfolio_categories (name, slug)
values ('Sin categoría', 'sin-categoria')
on conflict do nothing;

update public.portfolio_projects project
set category_id = category.id
from public.portfolio_categories category
where category_id is null
  and lower(category.name) = lower(coalesce(nullif(trim(project.project_type), ''), 'Sin categoría'));

alter table public.portfolio_projects alter column category_id set not null;
alter table public.portfolio_projects drop column project_type;

alter table public.portfolio_categories enable row level security;

create policy "public reads used portfolio categories" on public.portfolio_categories
  for select using (public.is_staff() or exists (
    select 1 from public.portfolio_projects project
    where project.category_id = id and project.published
  ));

create policy "staff manages portfolio categories" on public.portfolio_categories
  for all using (public.is_staff()) with check (public.is_staff());

create index portfolio_projects_category_idx on public.portfolio_projects (category_id, published);
