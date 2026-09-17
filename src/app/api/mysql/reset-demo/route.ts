import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { getMySqlSessionUser } from '@/lib/mysql/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function runSeedScript(): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(process.cwd(), 'mysql/seed-portal-data.mjs')], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolvePromise();
      else reject(new Error(stderr.trim() || `Seed script exited with code ${code}`));
    });
  });
}

/** Super-admin only: reloads the rich local MySQL demo dataset. */
export async function POST(request: Request) {
  try {
    const user = await getMySqlSessionUser(request);
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super-admin access is required.' }, { status: 403 });
    }
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MYSQL_DEMO_RESET !== 'true') {
      return NextResponse.json({ error: 'Demo reset is disabled in this environment.' }, { status: 403 });
    }

    await runSeedScript();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[mysql-reset-demo]', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'The demo reset could not be completed.',
    }, { status: 500 });
  }
}
