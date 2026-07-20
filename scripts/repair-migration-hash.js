#!/usr/bin/env node
require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { getDirectDatabaseUrl } = require('../db/pool');

const fileName = '001_initial.sql';
const filePath = path.join(__dirname, '../migrations', fileName);
const sql = fs.readFileSync(filePath, 'utf8');
const hash = crypto.createHash('sha1').update(fileName + sql, 'utf8').digest('hex');

function getSslConfig(connectionString) {
  return connectionString.includes('sslmode=') ? undefined : { rejectUnauthorized: true };
}

async function main() {
  const connectionString = getDirectDatabaseUrl();
  const client = new Client({
    connectionString,
    ssl: getSslConfig(connectionString),
  });

  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT id, name, hash FROM migrations WHERE name = $1 OR name = $2',
      ['initial', fileName]
    );

    if (!rows.length) {
      throw new Error(`No migration row found for ${fileName}. Is the database initialized?`);
    }

    const row = rows[0];
    if (row.hash === hash) {
      console.log(`[db] migration hash already matches for ${fileName}`);
      return;
    }

    await client.query('UPDATE migrations SET hash = $1 WHERE id = $2', [hash, row.id]);
    console.log(`[db] updated migration hash for ${fileName} (id ${row.id})`);
    console.log(`[db] old: ${row.hash}`);
    console.log(`[db] new: ${hash}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db] repair failed:', err.message);
  process.exit(1);
});
