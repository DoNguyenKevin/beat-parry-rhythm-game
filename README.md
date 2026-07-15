# Beat Parry

A browser-based rhythm game where you parry incoming balls to the beat.

## How to Play

1. Start the server (required for saving RUD currency per player).
2. Open http://localhost:3000 and create an account (Register).
3. Pick a song from the menu.
4. Balls roll along a thin line toward your ball in the center.
5. Press the matching key when a ball reaches the center:

| Key | Side | Lane |
|-----|------|------|
| **F** | Left | Upper |
| **G** | Left | Lower |
| **J** | Right | Upper |
| **K** | Right | Lower |

## RUD Currency

- Each player has a **RUD** balance stored in **Neon Postgres** (hosted database).
- Higher scores earn more RUD after each song or training run.
- Beating your personal best on a song gives a bonus.

## Database (Neon Postgres)

Player progress, auth sessions, inventory, skins, and scores are stored in Neon Postgres — not a local file.

### Setup

1. Create a [Neon](https://neon.tech) project (or use an existing one).
2. Copy the **pooled** connection string → `DATABASE_URL` in `.env`.
3. Copy the **direct** (non-pooler) connection string → `DATABASE_URL_DIRECT` in `.env`.
4. For local dev, create a Neon **branch** (e.g. `dev`) so experiments do not touch production data.
5. Copy `.env.example` to `.env` and fill in the values.

```bash
cp .env.example .env
# edit .env with your Neon connection strings
```

The server runs schema migrations automatically on startup. `GET /api/health` checks database connectivity (`SELECT 1`).

### Migrating from SQLite

If you have an existing `data/beat-parry.db` from before the Neon migration:

```bash
npm run migrate:sqlite
# or: node scripts/migrate-sqlite-to-neon.js --sqlite-path data/beat-parry.db
```

The script preserves user IDs so existing browser sessions keep working. It aborts if case-duplicate usernames are found (invalid in Postgres).

Run the migration **before** the first `npm start` on a fresh Neon branch if you have SQLite data — otherwise secret-eligible bootstrap accounts (`kevin`, `keios`) created at startup can conflict with imported usernames.

For very large databases, [pgloader](https://pgloader.io/) is an alternative — see Neon docs.

### Running tests

Integration tests need a disposable database (a Neon dev branch works well):

```bash
TEST_DATABASE_URL='postgresql://...-pooler.../neondb?sslmode=require' \
TEST_DATABASE_URL_DIRECT='postgresql://...direct.../neondb?sslmode=require' \
npm test
```

## Parry Sounds

Default parry SFX use the **classic in-game tones**. Open the **Sounds** tab to switch keycap packs:

1. **Creamy Keycap** — soft, muted thock
2. **Blue Switch Keycap** — clicky tactile bump
3. **Red Switch Keycap** — smooth linear press

Use **Reset to Normal Sound** to go back to the default. Keycap WAVs live in `sounds/keycap/{creamy,blue,red}/`. Replace them with your own files (same names). Regenerate placeholders with:

```bash
npm run generate-sounds
```

## Run Locally

```bash
npm install
cp .env.example .env   # then add Neon connection strings
npm run generate-sounds   # first time only (or after deleting sounds)
npm start
```

Then open http://localhost:3000

## Deploy to Cloudflare Workers

The game frontend is static files; the API runs as an Express worker script. Cloudflare **does not allow environment variables on Workers that only serve static assets** — you need a `main` worker entry (see `worker/index.js` and `wrangler.jsonc`).

### One-time setup

```bash
npm install
cp .dev.vars.example .dev.vars   # add your Neon connection strings
npx wrangler login
npx wrangler secret put DATABASE_URL
npx wrangler secret put DATABASE_URL_DIRECT   # optional; used for migrations
```

### Local Workers dev

```bash
npm run cf:dev
```

Opens the app at http://localhost:8787 (static assets + `/api/*` on the same origin).

### Production deploy

```bash
npm run cf:deploy
```

After deploy, add or edit secrets in the Cloudflare dashboard under **Workers & Pages → beat-parry-rhythm-game → Settings → Variables and Secrets**.

## Ratings

- **Excellent** — perfect timing (300 pts)
- **Good** — close timing (200 pts)
- **Medium** — acceptable (100 pts)
- **Bad** — too early/late or wrong key (−150 pts)
- **Miss** — ball passed you (−50 pts, breaks combo)

## Grades

| Grade | Accuracy |
|-------|----------|
| S | 95%+ |
| A | 90%+ |
| B | 80%+ |
| C | 70%+ |
| D | 60%+ |
| F | below 60% |

Songs get harder as they progress — faster balls, denser patterns, and simultaneous notes from both sides.
