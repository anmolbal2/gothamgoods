import http from "node:http";

/**
 * Tiny mock of the Printify API used by the offline webhook tests.
 * Records every order create / send_to_production call so tests can assert on
 * counts and the request bodies (e.g. address mapping).
 *
 * Control endpoints (called directly by tests):
 *   POST /__reset           clear recorded calls + fail mode
 *   GET  /__calls           -> { calls: [...] }
 *   POST /__fail  {fail}     toggle 500 mode for order endpoints
 *
 * Printify endpoints:
 *   POST /shops/:shop/orders.json                          -> { id: "po_mock_1" }
 *   POST /shops/:shop/orders/:id/send_to_production.json   -> { ok: true }
 * Both return 500 when fail mode is on, or when called with ?fail=1.
 */
export function createMockPrintify() {
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

      // --- printify endpoints ---
      const create = path.match(/^\/shops\/([^/]+)\/orders\.json$/);
      const prod = path.match(
        /^\/shops\/([^/]+)\/orders\/([^/]+)\/send_to_production\.json$/,
      );
      const wantFail = failMode || u.searchParams.get("fail") === "1";

      if (method === "POST" && create) {
        calls.push({ type: "create", shop: create[1], body });
        if (wantFail) return send(500, { error: "mock printify failure" });
        return send(200, { id: "po_mock_1" });
      }
      if (method === "POST" && prod) {
        calls.push({ type: "send_to_production", shop: prod[1], orderId: prod[2], body });
        if (wantFail) return send(500, { error: "mock printify failure" });
        return send(200, { ok: true });
      }

      send(404, { error: "not found", path });
    });
  });

  const listen = (port = 4010) =>
    new Promise((resolve) => server.listen(port, () => resolve(server)));
  const close = () => new Promise((resolve) => server.close(() => resolve()));

  return { server, listen, close };
}

// Allow running standalone: `node tests/mock-printify.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  createMockPrintify()
    .listen(Number(process.env.MOCK_PORT) || 4010)
    .then(() => console.log("mock printify listening on http://localhost:4010"));
}
