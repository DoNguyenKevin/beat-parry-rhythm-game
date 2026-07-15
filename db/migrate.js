const path = require('path');
const { Client } = require('pg');
const { migrate } = require('postgres-migrations');
const { getDirectDatabaseUrl } = require('./pool');

function getSslConfig(connectionString) {
  return connectionString.includes('sslmode=') ? undefined : { rejectUnauthorized: true };
}

async function runMigrations(connectionString = getDirectDatabaseUrl()) {
  const client = new Client({
    connectionString,
    ssl: getSslConfig(connectionString),
  });

  await client.connect();
  try {
    const applied = await migrate({ client }, path.join(__dirname, '../migrations'));
    if (applied.length) {
      console.log(`[db] applied migrations: ${applied.map((m) => m.name).join(', ')}`);
    } else {
      console.log('[db] migrations up to date');
    }
    return applied;
  } finally {
    await client.end();
  }
}

module.exports = { runMigrations };
