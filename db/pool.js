const { Pool } = require('pg');

let pool = null;

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is required. Copy .env.example and set your Neon connection string.'
    );
  }
  return url;
}

function getDirectDatabaseUrl() {
  if (process.env.DATABASE_URL_DIRECT) return process.env.DATABASE_URL_DIRECT;
  return getDatabaseUrl().replace('-pooler', '');
}

function getTestDatabaseUrl() {
  return process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
}

function getPoolConfig(connectionString) {
  const config = {
    connectionString,
    max: 10,
  };
  if (!connectionString.includes('sslmode=')) {
    config.ssl = { rejectUnauthorized: true };
  }
  return config;
}

function getPool(connectionString = getDatabaseUrl()) {
  if (!pool) {
    pool = new Pool(getPoolConfig(connectionString));
    pool.on('error', (err) => {
      console.error('[db] Unexpected pool error', err);
    });
  }
  return pool;
}

function resetPool() {
  pool = null;
}

async function query(text, params, client) {
  const executor = client || getPool();
  return executor.query(text, params);
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function checkConnectivity() {
  await query('SELECT 1');
}

module.exports = {
  getDatabaseUrl,
  getDirectDatabaseUrl,
  getTestDatabaseUrl,
  getPool,
  resetPool,
  query,
  withTransaction,
  checkConnectivity,
};
