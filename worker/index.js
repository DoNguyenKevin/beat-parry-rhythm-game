import { httpServerHandler } from 'cloudflare:node';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { app, prepareServer } = require('../server.js');

const WORKER_PORT = 8787;

app.listen(WORKER_PORT);

const apiHandler = httpServerHandler({ port: WORKER_PORT });

let bootPromise = null;

function syncEnv(env) {
  if (env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
  if (env.DATABASE_URL_DIRECT) process.env.DATABASE_URL_DIRECT = env.DATABASE_URL_DIRECT;
  if (env.DATABASE_URL_UNPOOLED) process.env.DATABASE_URL_UNPOOLED = env.DATABASE_URL_UNPOOLED;
}

function ensureBooted(env) {
  syncEnv(env);
  if (!bootPromise) {
    bootPromise = prepareServer().catch((err) => {
      bootPromise = null;
      throw err;
    });
  }
  return bootPromise;
}

export default {
  async fetch(request, env, ctx) {
    await ensureBooted(env);
    return apiHandler.fetch(request, env, ctx);
  },
};
