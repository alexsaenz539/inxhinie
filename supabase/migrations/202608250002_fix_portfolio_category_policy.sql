drop policy if exists "public reads used portfolio categories" on public.portfolio_categories;

create policy "public reads used portfolio categories" on public.portfolio_categories
  for select using (public.is_staff() or exists (
    select 1 from public.portfolio_projects project
    where project.category_id = portfolio_categories.id and project.published
  ));
