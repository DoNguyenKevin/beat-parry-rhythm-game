const path = require('path');
const { migrate } = require('postgres-migrations');
const { getDirectDatabaseUrl } = require('./pool');

async function runMigrations(connectionString = getDirectDatabaseUrl()) {
  const dbConfig = {
    connectionString,
    ssl: connectionString.includes('sslmode=') ? undefined : { rejectUnauthorized: true },
  };

  const applied = await migrate(dbConfig, path.join(__dirname, '../migrations'));
  if (applied.length) {
    console.log(`[db] applied migrations: ${applied.join(', ')}`);
  } else {
    console.log('[db] migrations up to date');
  }
  return applied;
}

module.exports = { runMigrations };
