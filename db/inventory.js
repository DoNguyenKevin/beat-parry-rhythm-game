const { query } = require('./pool');

async function getInventory(userId, client) {
  const result = await query(
    'SELECT ability_id, quantity FROM user_inventory WHERE user_id = $1 AND quantity > 0',
    [userId],
    client
  );
  const map = {};
  for (const row of result.rows) map[row.ability_id] = row.quantity;
  return map;
}

async function addInventory(userId, abilityId, amount = 1, client) {
  await query(
    `INSERT INTO user_inventory (user_id, ability_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, ability_id) DO UPDATE SET
       quantity = user_inventory.quantity + EXCLUDED.quantity`,
    [userId, abilityId, amount],
    client
  );
}

async function consumeInventory(userId, abilityIds, client) {
  const consumed = [];
  for (const abilityId of abilityIds) {
    const result = await query(
      'SELECT quantity FROM user_inventory WHERE user_id = $1 AND ability_id = $2',
      [userId, abilityId],
      client
    );
    const row = result.rows[0];
    if (!row || row.quantity <= 0) {
      return { ok: false, error: `Not enough ${abilityId} in inventory.` };
    }
  }

  for (const abilityId of abilityIds) {
    const result = await query(
      `UPDATE user_inventory SET quantity = quantity - 1
       WHERE user_id = $1 AND ability_id = $2 AND quantity > 0`,
      [userId, abilityId],
      client
    );
    if (result.rowCount === 0) {
      return { ok: false, error: `Not enough ${abilityId} in inventory.` };
    }
    await query(
      'DELETE FROM user_inventory WHERE user_id = $1 AND ability_id = $2 AND quantity <= 0',
      [userId, abilityId],
      client
    );
    consumed.push(abilityId);
  }

  return { ok: true, consumed };
}

module.exports = {
  getInventory,
  addInventory,
  consumeInventory,
};
