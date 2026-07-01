# Beat Parry

A browser-based rhythm game where you parry incoming balls to the beat.

## How to Play

1. Open `index.html` in a browser (or run a local server).
2. Pick a song from the menu.
3. Balls roll along a thin line toward your ball in the center.
4. Press the matching key when a ball reaches the center:

| Key | Side | Lane |
|-----|------|------|
| **F** | Left | Upper |
| **G** | Left | Lower |
| **J** | Right | Upper |
| **K** | Right | Lower |

## Ratings

- **Excellent** — perfect timing (300 pts)
- **Good** — close timing (200 pts)
- **Medium** — acceptable (100 pts)
- **Bad** — too early/late or wrong key (50 pts)
- **Miss** — ball passed you (0 pts, breaks combo)

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

## Run Locally

```bash
npx serve .
```

Or open `index.html` directly in Chrome/Edge/Firefox.
