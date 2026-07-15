const { query } = require('./pool');

async function getBestScores(userId, client) {
  const result = await query(
    'SELECT song_id, score FROM best_scores WHERE user_id = $1',
    [userId],
    client
  );
  const map = {};
  for (const row of result.rows) map[row.song_id] = row.score;
  return map;
}

async function getBestScore(userId, songId, client) {
  const result = await query(
    'SELECT score FROM best_scores WHERE user_id = $1 AND song_id = $2',
    [userId, songId],
    client
  );
  return result.rows[0]?.score ?? 0;
}

async function upsertBestScore(userId, songId, score, client) {
  await query(
    `INSERT INTO best_scores (user_id, song_id, score, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, song_id) DO UPDATE SET
       score = EXCLUDED.score,
       updated_at = EXCLUDED.updated_at`,
    [userId, songId, score],
    client
  );
}

module.exports = {
  getBestScores,
  getBestScore,
  upsertBestScore,
};
