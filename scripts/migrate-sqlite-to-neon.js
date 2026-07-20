#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { getDirectDatabaseUrl } = require('../db/pool');
const { runMigrations } = require('../db/migrate');

function parseArgs(argv) {
  const args = { sqlitePath: path.join(__dirname, '../data/beat-parry.db') };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--sqlite-path' && argv[i + 1]) {
      args.sqlitePath = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

async function openSqliteDatabase(sqlitePath) {
  try {
    const Database = require('better-sqlite3');
    return { kind: 'better-sqlite3', db: new Database(sqlitePath, { readonly: true }) };
  } catch (_err) {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(sqlitePath);
    return { kind: 'sql.js', db: new SQL.Database(buffer) };
  }
}

function queryAll(adapter, sql) {
  if (adapter.kind === 'better-sqlite3') {
    return adapter.db.prepare(sql).all();
  }
  const result = adapter.db.exec(sql);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

function closeSqlite(adapter) {
  if (adapter.kind === 'better-sqlite3') {
    adapter.db.close();
    return;
  }
  adapter.db.close();
}

function findCaseDuplicateUsernames(users) {
  const seen = new Map();
  for (const user of users) {
    const key = String(user.username || '').toLowerCase();
    if (seen.has(key) && seen.get(key) !== user.id) {
      return { key, ids: [seen.get(key), user.id] };
    }
    seen.set(key, user.id);
  }
  return null;
}

async function importTable(client, tableName, rows, columns, idColumn = 'id') {
  if (!rows.length) {
    console.log(`[migrate] ${tableName}: 0 rows`);
    return;
  }

  const colList = columns.join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${tableName} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  for (const row of rows) {
    const values = columns.map((col) => {
      const value = row[col];
      if (col === 'rud_balance' && value != null) {
        const n = Number(value);
        if (Number.isFinite(n)) {
          return Math.min(Math.max(Math.trunc(n), -2147483648), 2147483647);
        }
      }
      return value;
    });
    await client.query(sql, values);
  }

  if (idColumn && tableName === 'users') {
    const maxId = Math.max(...rows.map((row) => Number(row[idColumn]) || 0));
    if (maxId > 0) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('users', 'id'), $1, true)`,
        [maxId]
      );
    }
  }

  console.log(`[migrate] ${tableName}: ${rows.length} rows`);
}

async function main() {
  const { sqlitePath } = parseArgs(process.argv);

  if (!fs.existsSync(sqlitePath)) {
    console.log(`[migrate] SQLite file not found at ${sqlitePath}. Nothing to import.`);
    console.log('[migrate] For a fresh Neon setup, start the server to apply schema migrations.');
    process.exit(0);
  }

  const connectionString = getDirectDatabaseUrl();
  await runMigrations(connectionString);

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('sslmode=') ? undefined : { rejectUnauthorized: true },
  });

  const adapter = await openSqliteDatabase(sqlitePath);

  try {
    const users = queryAll(
      adapter,
      'SELECT id, username, password_hash, rud_balance, equipped_skin, created_at, last_free_spin_at, wheel_bonus_spins FROM users'
    );
    const duplicate = findCaseDuplicateUsernames(users);
    if (duplicate) {
      console.error(
        `[migrate] Aborting: case-duplicate usernames detected for "${duplicate.key}" (ids: ${duplicate.ids.join(', ')})`
      );
      process.exit(1);
    }

    const sessions = queryAll(adapter, 'SELECT token, user_id, expires_at, created_at FROM user_sessions');
    const scores = queryAll(adapter, 'SELECT user_id, song_id, score, updated_at FROM best_scores');
    const inventory = queryAll(adapter, 'SELECT user_id, ability_id, quantity FROM user_inventory');
    const redeemed = queryAll(adapter, 'SELECT user_id, code, ability_id, redeemed_at FROM user_redeemed_codes');
    const skins = queryAll(adapter, 'SELECT user_id, skin_id, purchased_at FROM user_owned_skins');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await importTable(client, 'users', users, [
        'id',
        'username',
        'password_hash',
        'rud_balance',
        'equipped_skin',
        'created_at',
        'last_free_spin_at',
        'wheel_bonus_spins',
      ]);
      await importTable(client, 'user_sessions', sessions, ['token', 'user_id', 'expires_at', 'created_at'], null);
      await importTable(client, 'best_scores', scores, ['user_id', 'song_id', 'score', 'updated_at'], null);
      await importTable(client, 'user_inventory', inventory, ['user_id', 'ability_id', 'quantity'], null);
      await importTable(client, 'user_redeemed_codes', redeemed, ['user_id', 'code', 'ability_id', 'redeemed_at'], null);
      await importTable(client, 'user_owned_skins', skins, ['user_id', 'skin_id', 'purchased_at'], null);
      await client.query('COMMIT');
      console.log('[migrate] Import complete.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } finally {
    closeSqlite(adapter);
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
