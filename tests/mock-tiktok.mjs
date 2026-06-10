import http from "node:http";

/**
 * Tiny mock of the TikTok Events API used by the offline tracking tests.
 * Records every event/track POST (body + headers) so tests can assert on the
 * event name, dedup event_id, hashed user fields, and payload shape.
 *
 * TikTok answers 200 even on logical errors, signalling success via `code: 0` and
 * failure via a non-zero code. The mock mirrors that: success returns { code: 0 },
 * fail mode returns { code: 40001, message } at HTTP 200 so we can prove the EAPI
 * sender treats a non-zero code as a (non-fatal) failure.
 *
 * Control endpoints (called directly by tests):
 *   POST /__reset           clear recorded calls + fail mode
 *   GET  /__calls           -> { calls: [...] }
 *   POST /__fail  {fail}     toggle non-zero-code mode for event/track
 *
 * TikTok endpoint:
 *   POST /open_api/v1.3/event/track/   -> { code: 0 } (or { code: 40001 } in fail mode)
 */
export function createMockTiktok() {
  let calls = [];
  let failMode = false;

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      let body;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        body = raw;
      }

      const send = (status, obj) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(obj ?? {}));
      };

      const u = new URL(req.url, "http://localhost");
      const path = u.pathname;
      const method = req.method;

      // --- control endpoints ---
      if (method === "POST" && path === "/__reset") {
        calls = [];
        failMode = false;
        return send(200, { ok: true });
      }
      if (method === "GET" && path === "/__calls") {
        return send(200, { calls });
      }
      if (method === "POST" && path === "/__fail") {
        failMode = body?.fail !== false;
        return send(200, { failMode });
      }

      // --- tiktok events api ---
      if (method === "POST" && path === "/open_api/v1.3/event/track/") {
        calls.push({
          type: "track",
          accessToken: req.headers["access-token"],
          body,
        });
        if (failMode) {
          return send(200, { code: 40001, message: "mock tiktok failure" });
        }
        return send(200, { code: 0, message: "OK" });
      }

      send(404, { error: "not found", path });
    });
  });

  const listen = (port = 4011) =>
    new Promise((resolve) => server.listen(port, () => resolve(server)));
  const close = () => new Promise((resolve) => server.close(() => resolve()));

  return { server, listen, close };
}

// Allow running standalone: `node tests/mock-tiktok.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  createMockTiktok()
    .listen(Number(process.env.MOCK_PORT) || 4011)
    .then(() => console.log("mock tiktok listening on http://localhost:4011"));
}
