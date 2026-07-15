const users = require('./users');
const sessions = require('./sessions');
const scores = require('./scores');
const inventory = require('./inventory');
const skins = require('./skins');
const codes = require('./codes');
const pool = require('./pool');
const migrate = require('./migrate');

module.exports = {
  ...users,
  ...sessions,
  ...scores,
  ...inventory,
  ...skins,
  ...codes,
  ...pool,
  ...migrate,
};
