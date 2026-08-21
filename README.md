# INXHINIE Construcciones

Sitio comercial y panel CRM en un solo proyecto Angular. El diseño de la página pública conserva la implementación visual original de INXHINIE.

## Desarrollo

Ejecuta `npm start` para iniciar la aplicación. El sitio público está en `/` y el panel administrativo en `/admin`.

## Supabase

1. Ejecuta `supabase/migrations/202608200001_initial_schema.sql` en el SQL Editor del proyecto Supabase.
2. Crea un usuario en Supabase Auth y agrega su perfil con rol `admin` en la tabla `profiles`.
3. Para una compilación local con Supabase, define `SUPABASE_URL` y `SUPABASE_ANON_KEY` en la terminal antes de ejecutar `npm run build`. Usa `.env.example` únicamente como referencia de nombres y no agregues credenciales reales al repositorio.

Mientras Supabase no esté configurado, `/admin` muestra datos de demostración. Las imágenes originales se mantienen en `assets/images`.

## Despliegue en Vercel

El proyecto incluye `vercel.json` para generar Angular y servir las rutas de la SPA, incluyendo `/admin`.

1. Importa el repositorio en Vercel.
2. En **Settings > Environment Variables**, agrega `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `Production` y `Preview`.
3. Vuelve a desplegar. La compilación inserta ambos valores en el bundle de Angular.

`SUPABASE_ANON_KEY` es una clave pública de cliente y debe estar protegida con las políticas RLS de Supabase. Nunca configures una clave `service_role` en Vercel para esta aplicación.
