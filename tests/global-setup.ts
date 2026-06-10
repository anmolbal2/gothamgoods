import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

/**
 * Boots the mock Printify server (tests/mock-printify.mjs on :4010) and the mock
 * TikTok Events API server (tests/mock-tiktok.mjs on :4011) as real Node child
 * processes before the suite runs, and returns a teardown that kills them.
 *
 * We spawn them (rather than import) so the .mjs files run natively as ESM —
 * importing through Playwright's transformer breaks (CJS `exports` in ESM scope).
 */
export default async function globalSetup() {
  const printify = spawnMock("mock-printify.mjs", "4010");
  const tiktok = spawnMock("mock-tiktok.mjs", "4011");

  await waitForReady("http://localhost:4010/__calls");
  await waitForReady("http://localhost:4011/__calls");
  console.log("[global-setup] mock printify ready on :4010, mock tiktok on :4011");

  return async () => {
    printify.kill();
    tiktok.kill();
  };
}

function spawnMock(file: string, port: string): ChildProcess {
  const mockPath = path.join(process.cwd(), "tests", file);
  return spawn(process.execPath, [mockPath], {
    stdio: "inherit",
    env: { ...process.env, MOCK_PORT: port },
  });
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
  throw new Error(`Mock did not become ready at ${url}`);
}
