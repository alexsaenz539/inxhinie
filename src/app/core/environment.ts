declare const SUPABASE_URL: string | undefined;
declare const SUPABASE_ANON_KEY: string | undefined;

export const environment = {
  // Values are injected by scripts/build.mjs from Vercel's build environment.
  supabaseUrl: typeof SUPABASE_URL === 'string' ? SUPABASE_URL : '',
  supabaseAnonKey: typeof SUPABASE_ANON_KEY === 'string' ? SUPABASE_ANON_KEY : '',
};
