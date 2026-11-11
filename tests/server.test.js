const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createServer, fetchJson } = require("../src/server");
const { findUserById } = require("../src/db");

describe("findUserById", () => {
  it("returns known user", () => {
    assert.equal(findUserById(1).name, "Ada");
  });

  it("returns null for missing", () => {
    assert.equal(findUserById(999), null);
  });
});

describe("HTTP server", () => {
  it("GET /health", async () => {
    const server = createServer();
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    await new Promise((resolve) => server.close(resolve));
  });

  it("GET /users/:id", async () => {
    const server = createServer();
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/users/2`);
    const body = await res.json();
    assert.equal(body.user.name, "Bob");
    await new Promise((resolve) => server.close(resolve));
  });
});

describe("fetchJson", () => {
  it("swallows network errors", async () => {
    const result = await fetchJson("http://127.0.0.1:1/");
    assert.ok(result.error);
  });
});
