const { before, afterEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { Pool } = require('pg');

const testUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!testUrl) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL is required to run API tests.');
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL_DIRECT
  || process.env.DATABASE_URL_DIRECT
  || testUrl.replace('-pooler', '');
process.env.DATABASE_URL_DIRECT = process.env.TEST_DATABASE_URL_DIRECT
  || process.env.DATABASE_URL_DIRECT
  || testUrl.replace('-pooler', '');

const { runMigrations } = require('../db/migrate');
const { resetPool, closePool } = require('../db/pool');
const { app } = require('../server');

let adminPool;

before(async () => {
  await closePool();
  resetPool();
  adminPool = new Pool({
    connectionString: process.env.DATABASE_URL_DIRECT,
    ssl: process.env.DATABASE_URL_DIRECT.includes('sslmode=')
      ? undefined
      : { rejectUnauthorized: true },
  });
  await runMigrations(process.env.DATABASE_URL_DIRECT);
});

afterEach(async () => {
  await adminPool.query(`
    TRUNCATE user_sessions, best_scores, user_inventory, user_redeemed_codes, user_owned_skins, admin_config, users
    RESTART IDENTITY CASCADE
  `);
  await closePool();
  resetPool();
});

describe('API integration', () => {
  it('health returns ok when database is reachable', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  it('register, login, and profile flow works', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testplayer', password: 'secret' });

    assert.equal(register.status, 200);
    assert.equal(register.body.username, 'testplayer');
    assert.ok(register.body.token);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${register.body.token}`);

    assert.equal(me.status, 200);
    assert.equal(me.body.username, 'testplayer');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testplayer', password: 'secret' });

    assert.equal(login.status, 200);
    assert.ok(login.body.token);
  });

  it('buy increases inventory and decreases balance', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ username: 'buyer', password: 'secret' });

    const userId = register.body.id;
    const token = register.body.token;

    await adminPool.query('UPDATE users SET rud_balance = 200 WHERE id = $1', [userId]);

    const buy = await request(app)
      .post(`/api/users/${userId}/buy`)
      .set('Authorization', `Bearer ${token}`)
      .send({ abilityId: 'wide-window' });

    assert.equal(buy.status, 200);
    assert.equal(buy.body.balance, 80);
    assert.equal(buy.body.inventory['wide-window'], 1);
  });

  it('buy rejects insufficient balance', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ username: 'poor', password: 'secret' });

    const userId = register.body.id;
    const token = register.body.token;

    const buy = await request(app)
      .post(`/api/users/${userId}/buy`)
      .set('Authorization', `Bearer ${token}`)
      .send({ abilityId: 'wide-window' });

    assert.equal(buy.status, 400);
    assert.match(buy.body.error, /Not enough RUD/);
  });

  it('consume decrements inventory', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ username: 'consumer', password: 'secret' });

    const userId = register.body.id;
    const token = register.body.token;

    await adminPool.query('UPDATE users SET rud_balance = 500 WHERE id = $1', [userId]);

    await request(app)
      .post(`/api/users/${userId}/buy`)
      .set('Authorization', `Bearer ${token}`)
      .send({ abilityId: 'wide-window' });

    const consume = await request(app)
      .post(`/api/users/${userId}/consume`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'play', abilityIds: ['wide-window'] });

    assert.equal(consume.status, 200);
    assert.deepEqual(consume.body.abilities, ['wide-window']);
    assert.equal(consume.body.inventory['wide-window'], undefined);

    const again = await request(app)
      .post(`/api/users/${userId}/consume`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'play', abilityIds: ['wide-window'] });

    assert.equal(again.status, 400);
  });

  it('complete increases balance and records best score', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ username: 'runner', password: 'secret' });

    const userId = register.body.id;
    const token = register.body.token;

    const complete = await request(app)
      .post(`/api/users/${userId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ score: 5000, grade: 'A', songId: 'song-1' });

    assert.equal(complete.status, 200);
    assert.ok(complete.body.balance > 0);
    assert.equal(complete.body.bestScores['song-1'], 5000);
  });

  it('citext username uniqueness is case-insensitive on register', async () => {
    const first = await request(app)
      .post('/api/auth/register')
      .send({ username: 'Alice', password: 'secret' });
    assert.equal(first.status, 200);

    const second = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'secret2' });
    assert.equal(second.status, 400);
  });
});
