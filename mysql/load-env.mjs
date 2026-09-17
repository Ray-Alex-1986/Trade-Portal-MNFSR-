import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseEnvFile(filePath) {
  const parsed = {};
  if (!existsSync(filePath)) return parsed;
  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

/** Load `.env` then `.env.local`. Existing process env wins. */
export function loadDotEnv(cwd = process.cwd()) {
  const parsed = {
    ...parseEnvFile(resolve(cwd, '.env')),
    ...parseEnvFile(resolve(cwd, '.env.local')),
  };
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function getDatabaseUrl() {
  const value = process.env.MYSQL_DATABASE_URL || process.env.DATABASE_URL;
  if (!value) {
    throw new Error('Set DATABASE_URL or MYSQL_DATABASE_URL in .env');
  }
  return value;
}
