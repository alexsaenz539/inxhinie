-- Preserve the current behavior by assigning every existing material to each service.
-- Administrators can then narrow each service's list from the catalog editor.
update public.app_settings as settings
set setting_value = jsonb_set(
  settings.setting_value,
  '{services}',
  (
    select jsonb_agg(
      case
        when service ? 'materials' then service
        else service || jsonb_build_object('materials', settings.setting_value -> 'materials')
      end
    )
    from jsonb_array_elements(settings.setting_value -> 'services') as service
  )
)
where settings.setting_key = 'quote_catalog';
