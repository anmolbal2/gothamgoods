import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

/**
 * Boots the mock Printify server (tests/mock-printify.mjs) on :4010 as a real
 * Node child process before the suite runs, and returns a teardown that kills it.
 *
 * We spawn it (rather than import it) so the .mjs runs natively as ESM — importing
 * it through Playwright's transformer breaks (CJS `exports` injected into ESM scope).
 */
export default async function globalSetup() {
  const mockPath = path.join(process.cwd(), "tests", "mock-printify.mjs");
  const child: ChildProcess = spawn(process.execPath, [mockPath], {
    stdio: "inherit",
    env: { ...process.env, MOCK_PORT: "4010" },
  });

  await waitForReady("http://localhost:4010/__calls");
  // eslint-disable-next-line no-console
  console.log("[global-setup] mock printify ready on :4010");

  return async () => {
    child.kill();
  };
}

async function waitForReady(url: string, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Mock Printify did not become ready at ${url}`);
}
