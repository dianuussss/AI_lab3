const http = require("http");
const { findUserById, listUsers } = require("./db");

const PORT = process.env.PORT || 3000;

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`upstream ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    return { error: String(err.message || err) };
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/users") {
      return sendJson(res, 200, { users: listUsers() });
    }

    if (req.method === "GET" && url.pathname.startsWith("/users/")) {
      const id = url.pathname.split("/")[2];
      const user = findUserById(id);
      if (!user) {
        return sendJson(res, 404, { error: "not found" });
      }
      return sendJson(res, 200, { user });
    }

    if (req.method === "GET" && url.pathname === "/proxy-time") {
      const data = await fetchJson("https://worldtimeapi.org/api/timezone/Etc/UTC");
      return sendJson(res, 200, data);
    }

    return sendJson(res, 404, { error: "not found" });
  });
}

if (require.main === module) {
  createServer().listen(PORT, () => {
    // intentional: startup log is fine for a tiny demo server
    process.stdout.write(`listening on ${PORT}\n`);
  });
}

module.exports = { createServer, fetchJson };
