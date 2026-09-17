'use client';

import { Company, User } from './types';
import { getConfiguredPortalBackend } from './portal-backend';

export interface RegistrationInput {
  company: Partial<Company>;
  representative: {
    full_name: string;
    email: string;
    username: string;
    password?: string;
    cnic: string;
    designation: string;
    mobile: string;
  };
  registration_number: string;
}

export interface RegistrationResult {
  user?: User;
  company?: Company;
  error?: string;
}

async function registerMySqlExporter(input: RegistrationInput): Promise<RegistrationResult> {
  try {
    const response = await fetch('/api/mysql/auth/register', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const result = await response.json().catch(() => ({})) as RegistrationResult;
    return response.ok ? result : { error: result.error || 'Registration could not be submitted.' };
  } catch {
    return { error: 'The registration service is unavailable.' };
  }
}

/** Creates a MySQL exporter account and company application. */
export async function registerExporter(input: RegistrationInput): Promise<RegistrationResult> {
  if (getConfiguredPortalBackend() !== 'mysql') {
    return { error: 'Exporter registration requires the MySQL backend.' };
  }
  return registerMySqlExporter(input);
}
