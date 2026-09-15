import 'server-only';

import { createPool, Pool, PoolConnection, PoolOptions } from 'mysql2/promise';

const GLOBAL_POOL_KEY = '__tradePortalMySqlPool';

type GlobalWithPool = typeof globalThis & {
  [GLOBAL_POOL_KEY]?: Pool;
};

function requiredDatabaseUrl(): string {
  const value = process.env.MYSQL_DATABASE_URL;
  if (!value) {
    throw new Error('MYSQL_DATABASE_URL is not configured.');
  }
  return value;
}

function createMySqlPool(): Pool {
  const url = new URL(requiredDatabaseUrl());
  if (!['mysql:', 'mysqls:'].includes(url.protocol)) {
    throw new Error('MYSQL_DATABASE_URL must use the mysql:// or mysqls:// protocol.');
  }

  const port = Number(url.port || '3306');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MYSQL_DATABASE_URL contains an invalid port.');
  }

  const options: PoolOptions = {
    host: url.hostname,
    port,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || '5'),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: 'Z',
    decimalNumbers: true,
    dateStrings: true,
  };

  if (url.protocol === 'mysqls:' || process.env.MYSQL_SSL === 'true') {
    options.ssl = { rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== 'false' };
  }

  return createPool(options);
}

/** Returns the process-local pool. It is never imported by browser code. */
export function getMySqlPool(): Pool {
  const runtime = globalThis as GlobalWithPool;
  if (!runtime[GLOBAL_POOL_KEY]) {
    runtime[GLOBAL_POOL_KEY] = createMySqlPool();
  }
  return runtime[GLOBAL_POOL_KEY];
}

export function isMySqlConfigured(): boolean {
  return Boolean(process.env.MYSQL_DATABASE_URL && process.env.MYSQL_SESSION_SECRET);
}

export async function withMySqlTransaction<T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getMySqlPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
