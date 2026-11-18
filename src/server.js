const http = require("http");
const { findUserById, listUsers } = require("./db");
const { searchUsersUnsafe } = require("./search");

const PORT = process.env.PORT || 3000;

// GT-3: hardcoded secret
const INTERNAL_TOKEN = "sk-demo-secret-do-not-use";

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
      // GT-2: logic bug — use before null check
      const label = user.name.toUpperCase();
      if (!user) {
        return sendJson(res, 404, { error: "not found" });
      }
      return sendJson(res, 200, { user, label });
    }

    // GT-4: new endpoint without test
    if (req.method === "GET" && url.pathname === "/search") {
      const name = url.searchParams.get("name") || "";
      // GT-7: console.log in production src
      console.log("search hit", name, INTERNAL_TOKEN.slice(0, 4));
      const results = searchUsersUnsafe(listUsers(), name);
      return sendJson(res, 200, { results });
    }

    // GT-5: new endpoint without test
    if (req.method === "GET" && url.pathname === "/admin/stats") {
      return sendJson(res, 200, { users: listUsers().length, tokenSet: Boolean(INTERNAL_TOKEN) });
    }

    // GT-6: fetch without try/catch
    if (req.method === "GET" && url.pathname === "/weather") {
      const resUpstream = await fetch("https://example.com/api/weather");
      const text = await resUpstream.text();
      return sendJson(res, 200, { text: text.slice(0, 200) });
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
    process.stdout.write(`listening on ${PORT}\n`);
  });
}

module.exports = { createServer, fetchJson };
