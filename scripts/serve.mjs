import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const result = spawnSync(process.execPath, [
  'node_modules/@angular/cli/bin/ng.js',
  'serve',
  '--define', `SUPABASE_URL=${JSON.stringify(process.env.SUPABASE_URL ?? '')}`,
  '--define', `SUPABASE_ANON_KEY=${JSON.stringify(process.env.SUPABASE_ANON_KEY ?? '')}`,
  ...process.argv.slice(2),
], { stdio: 'inherit' });

if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
