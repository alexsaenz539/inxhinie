-- Public catalog used by the quote calculator. Only administrators can edit it.
insert into public.app_settings (setting_key, setting_value)
values ('quote_catalog', '{
  "services": [
    {"name":"Pérgola Residencial / Comercial","rate":5200},
    {"name":"Estructura Metálica & Semi-Arcos","rate":4400},
    {"name":"Domo & Techumbre","rate":3900},
    {"name":"Acabados Imitación Madera","rate":2300},
    {"name":"Remodelación & Proyecto 3D","rate":6100}
  ],
  "materials": ["Membrana Tensada Nacional","Membrana Importada Premium","Lona Arquitectónica Impermeable","Policarbonato Celular o Sólido","Deck PVC & Lambrín Imitación Madera","Panel Aislante Térmico","Lámina Pintro / Galvanizada","Requiero asesoría técnica"],
  "properties": ["Residencial / Casa Habitación","Comercial / Restaurante / Negocio","Industrial / Bodega / Nave","Escolar / Unidad Deportiva"],
  "qualities": [{"key":"standard","label":"Estándar","multiplier":1},{"key":"premium","label":"Premium","multiplier":1.22},{"key":"alto","label":"Alta especificación","multiplier":1.45}],
  "addons": [{"key":"none","label":"Sin adicionales","rate":0},{"key":"demolition","label":"Demolición o retiro","rate":420},{"key":"lighting","label":"Iluminación integrada","rate":680},{"key":"design","label":"Modelado 3D previo","rate":250}],
  "varianceLow": 0.9,
  "varianceHigh": 1.12
}'::jsonb)
on conflict (setting_key) do nothing;

create policy "public reads quote catalog" on public.app_settings for select using (setting_key = 'quote_catalog');
create policy "admin manages settings" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());
