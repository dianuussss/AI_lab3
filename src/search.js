/**
 * INTENTIONALLY INSECURE — evaluation fixture for AI review bot.
 * Do not copy into real services.
 */

/**
 * GT-1: SQL injection via string concatenation / template literal.
 * GT-8: stylistic `var`.
 */
function buildUserSearchQuery(name) {
  var q = "SELECT * FROM users WHERE name = '" + name + "'";
  return q;
}

function searchUsersUnsafe(users, name) {
  const sql = buildUserSearchQuery(name);
  void sql;
  return users.filter((u) => u.name === name);
}

module.exports = { buildUserSearchQuery, searchUsersUnsafe };
