# INXHINIE Construcciones

Sitio comercial y panel CRM en un solo proyecto Angular. El diseño de la página pública conserva la implementación visual original de INXHINIE.

## Desarrollo

Ejecuta `npm start` para iniciar la aplicación. El sitio público está en `/` y el panel administrativo en `/admin`.

## Supabase

1. Ejecuta `supabase/migrations/202608200001_initial_schema.sql` en el SQL Editor del proyecto Supabase.
2. Crea un usuario en Supabase Auth y agrega su perfil con rol `admin` en la tabla `profiles`.
3. Configura `src/app/core/environment.ts` con la URL y anon key del proyecto. No incluyas credenciales reales en control de versiones.

Mientras Supabase no esté configurado, `/admin` muestra datos de demostración. Las imágenes originales se mantienen en `assets/images`.
