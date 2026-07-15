const { query } = require('./pool');

async function getRedeemedAbilityIds(userId, client) {
  const result = await query(
    'SELECT ability_id FROM user_redeemed_codes WHERE user_id = $1',
    [userId],
    client
  );
  return result.rows.map((row) => row.ability_id);
}

async function hasRedeemedCode(userId, abilityId, client) {
  const result = await query(
    'SELECT 1 FROM user_redeemed_codes WHERE user_id = $1 AND ability_id = $2',
    [userId, abilityId],
    client
  );
  return result.rows.length > 0;
}

async function insertRedeemedCode(userId, code, abilityId, client) {
  await query(
    `INSERT INTO user_redeemed_codes (user_id, code, ability_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, ability_id) DO NOTHING`,
    [userId, code, abilityId],
    client
  );
}

module.exports = {
  getRedeemedAbilityIds,
  hasRedeemedCode,
  insertRedeemedCode,
};
