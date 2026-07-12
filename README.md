# Beat Parry

A browser-based rhythm game where you parry incoming balls to the beat.

## How to Play

1. Start the server (required for saving RUD currency per player).
2. Open http://localhost:3000 and pick a username.
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

- Each player has a **RUD** balance stored in **SQLite** (`data/beat-parry.db`).
- Higher scores earn more RUD after each song or training run.
- Beating your personal best on a song gives a bonus.

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
npm run generate-sounds   # first time only (or after deleting sounds)
npm start
```

Then open http://localhost:3000

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
