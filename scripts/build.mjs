import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';

if (process.env.VERCEL && (!supabaseUrl || !supabaseAnonKey)) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY must be configured in Vercel.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['node_modules/@angular/cli/bin/ng.js',
  'build',
  '--define', `SUPABASE_URL=${JSON.stringify(supabaseUrl)}`,
  '--define', `SUPABASE_ANON_KEY=${JSON.stringify(supabaseAnonKey)}`,
], { stdio: 'inherit' });

if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
