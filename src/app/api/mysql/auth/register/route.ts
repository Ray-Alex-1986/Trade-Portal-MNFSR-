import { NextResponse } from 'next/server';
import { MySqlRegistrationInput, registerMySqlExporter } from '@/lib/mysql/portal';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as MySqlRegistrationInput | null;
  if (!input) return NextResponse.json({ error: 'A registration payload is required.' }, { status: 400 });

  const result = await registerMySqlExporter(input);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ user: result.user, company: result.company }, { status: 201 });
}
