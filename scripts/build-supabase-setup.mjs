#!/usr/bin/env node
/**
 * Concatenates the Supabase schema and its migrations, in dependency order,
 * into a single supabase/setup.sql that can be pasted into the Supabase SQL
 * editor in one go. The individual files stay the source of truth; re-run this
 * script after changing any of them.
 *
 *   node scripts/build-supabase-setup.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Order matters: the base schema creates the tables the migrations alter, and
// the seed migration depends on the RPCs and columns added by 001.
const SOURCES = [
  'supabase-schema.sql',
  'supabase/migrations/001_portal_updates.sql',
  'supabase/migrations/002_demo_seed.sql',
  'supabase/migrations/003_public_portal_stats.sql',
  'supabase/migrations/004_document_realtime.sql',
];

const OUTPUT = 'supabase/setup.sql';

const banner = (text) => [
  '-- ' + '='.repeat(74),
  `-- ${text}`,
  '-- ' + '='.repeat(74),
].join('\n');

const header = [
  banner('National Export Portal — complete Supabase setup'),
  '--',
  '-- GENERATED FILE. Do not edit by hand.',
  '-- Rebuild with: node scripts/build-supabase-setup.mjs',
  '--',
  '-- Paste this whole file into the Supabase SQL editor and run it once on a',
  '-- NEW, EMPTY project. It creates the schema, row-level security policies,',
  '-- RPC functions, realtime publication, and the demo dataset.',
  '--',
  '-- It is not idempotent: running it twice on the same project will fail on',
  '-- the CREATE TABLE statements. To reload only the demo data afterwards,',
  '-- run: SELECT reset_demo_data();',
  '--',
  '-- Source files, applied in this order:',
  ...SOURCES.map((file, index) => `--   ${index + 1}. ${file}`),
  '',
  '',
].join('\n');

const sections = SOURCES.map((file) => {
  const contents = readFileSync(join(root, file), 'utf8').trimEnd();
  return `${banner(`BEGIN ${file}`)}\n\n${contents}\n\n${banner(`END ${file}`)}\n`;
});

const output = `${header}${sections.join('\n\n')}`;
writeFileSync(join(root, OUTPUT), output);

const lines = output.split('\n').length;
console.log(`Wrote ${OUTPUT} (${SOURCES.length} source files, ${lines} lines).`);
