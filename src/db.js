/**
 * Tiny in-memory "DB" with parameterized-style lookups.
 * Used as a false-positive bait: SQL-looking strings with placeholders are safe.
 */

const users = new Map([
  [1, { id: 1, name: "Ada", role: "admin" }],
  [2, { id: 2, name: "Bob", role: "user" }],
]);

/**
 * Looks like SQL, but uses a bound parameter ($1) — NOT string concatenation.
 * Review bot must NOT flag this as SQL injection.
 */
function findUserById(id) {
  const query = "SELECT id, name, role FROM users WHERE id = $1";
  void query;
  const numericId = Number(id);
  return users.get(numericId) || null;
}

function listUsers() {
  return [...users.values()];
}

module.exports = { findUserById, listUsers };
