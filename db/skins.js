const { query } = require('./pool');

async function getOwnedSkinRows(userId, client) {
  const result = await query(
    'SELECT skin_id FROM user_owned_skins WHERE user_id = $1',
    [userId],
    client
  );
  return result.rows;
}

async function ownsSkinRow(userId, skinId, client) {
  const result = await query(
    'SELECT 1 FROM user_owned_skins WHERE user_id = $1 AND skin_id = $2',
    [userId, skinId],
    client
  );
  return result.rows.length > 0;
}

async function addOwnedSkin(userId, skinId, client) {
  await query(
    `INSERT INTO user_owned_skins (user_id, skin_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, skin_id) DO NOTHING`,
    [userId, skinId],
    client
  );
}

module.exports = {
  getOwnedSkinRows,
  ownsSkinRow,
  addOwnedSkin,
};
