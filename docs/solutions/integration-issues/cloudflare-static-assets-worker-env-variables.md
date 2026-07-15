---
title: Cloudflare rejects env variables on static-assets-only Workers
date: 2026-07-15
category: integration-issues
module: Cloudflare Workers deployment
problem_type: integration_issue
component: tooling
symptoms:
  - "Variables cannot be added to a Worker that only has static assets"
  - "wrangler secret put DATABASE_URL fails or dashboard Variables/Secrets UI is blocked"
root_cause: config_error
resolution_type: code_fix
severity: high
tags: [cloudflare, wrangler, workers, static-assets, secrets, express, nodejs-compat]
---

# Cloudflare rejects env variables on static-assets-only Workers

## Problem

Deploying Beat Parry to Cloudflare Workers with only an `assets` block in `wrangler.jsonc` blocks production database configuration. The dashboard and CLI refuse to add secrets such as `DATABASE_URL` because the Worker is classified as static-assets-only.

## Symptoms

- Cloudflare dashboard error: **"Variables cannot be added to a Worker that only has static assets"**
- `npx wrangler secret put DATABASE_URL` cannot be configured for the Worker
- Neon Postgres connection strings have nowhere to live in production

## What Didn't Work

- Adding `vars` or `secrets` to a `wrangler.jsonc` that only defined `assets` (no `main` script)
- Expecting the Cloudflare dashboard **Variables and Secrets** UI to accept bindings without a Worker script entry point

## Solution

Add a minimal Worker entry that runs the existing Express API via `cloudflare:node`, and route `/api/*` through the Worker before static asset fallback.

**`wrangler.jsonc`** — Worker script + assets + API routing:

```jsonc
{
  "main": "worker/index.js",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*"],
    "not_found_handling": "single-page-application"
  },
  "secrets": {
    "required": ["DATABASE_URL"]
  }
}
```

**`worker/index.js`** — bridge Worker `env` into Express and Node (see `worker/index.js` for full boot caching):

```javascript
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
  // DATABASE_URL_DIRECT / DATABASE_URL_UNPOOLED synced similarly
}

function ensureBooted(env) {
  syncEnv(env);
  if (!bootPromise) bootPromise = prepareServer();
  return bootPromise;
}

export default {
  async fetch(request, env, ctx) {
    await ensureBooted(env);
    return apiHandler.fetch(request, env, ctx);
  },
};
```

**`server.js`** — export boot logic for reuse:

```javascript
async function prepareServer() {
  db.getDatabaseUrl();
  await db.runMigrations();
  await ensureSecretEligibleAccounts();
}

module.exports = { app, start, prepareServer };
```

**`.assetsignore`** — exclude server code and tooling from the static asset bundle (see repo file for full list).

**Local dev** — copy `.dev.vars.example` to `.dev.vars`, then `npm run cf:dev` (port 8787).

**Production secrets**:

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put DATABASE_URL_DIRECT   # optional
npm run cf:deploy
```

## Why This Works

Cloudflare treats a Worker with only static assets as a pure asset host. Environment bindings (vars and secrets) attach to the **Worker script runtime**, not to the asset pipeline alone. Adding `main` gives Wrangler a script Worker that can receive `env` bindings; `run_worker_first: ["/api/*"]` sends API traffic to Express while other paths still serve static game files. `nodejs_compat` and `cloudflare:node` let the existing Express `server.js` run inside the Worker without rewriting routes.

## Prevention

- When deploying Express (or any dynamic backend) alongside static files on Cloudflare, always configure **both** `main` and `assets` — never assets-only if you need secrets.
- Declare required secrets in `wrangler.jsonc` under `secrets.required` so deploy-time checks fail early.
- Keep API code out of the asset bundle via `.assetsignore`.
- Document secret setup in README and `.dev.vars.example` before first production deploy.

## Related Issues

- Fixed in PR #2 (`fix/cloudflare-worker-env-bindings`), merged to `main` as `adcffe3`
- Deploy instructions: `README.md` → "Deploy to Cloudflare Workers"
