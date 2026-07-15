# Concepts

> Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Game runtime

### Beat Parry server
The Node/Express process that serves the rhythm-game frontend and handles `/api/*` routes for auth, progress, shop, and leaderboard. Locally it runs via `npm start`; on Cloudflare it runs inside a Worker script bridged through `cloudflare:node`.

### Neon progress store
The Postgres-backed persistence layer (via Neon) holding user accounts, run progress, inventory, and leaderboard data. Connection strings arrive through environment variables (`DATABASE_URL`, optional direct/unpooled variants for migrations).

## Cloudflare deployment

### Worker entry
The `main` script Cloudflare executes per request. Required whenever the deployment needs environment bindings (secrets or vars); a static-assets-only configuration cannot receive them.

### Static asset bundle
The files Wrangler publishes from the project root for browser delivery (HTML, JS, CSS, images). Exclusions are controlled by `.assetsignore` so server code and tooling are not shipped to clients.

### run_worker_first
Wrangler routing rule that sends matching paths (here `/api/*`) to the Worker script before falling back to static assets. Keeps API and frontend on one origin in production.
