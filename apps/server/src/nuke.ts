import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const databasePath = resolve(root, "data/bench.sqlite");

export function nukeDatabase(path: string) {
  for (const suffix of ["", "-shm", "-wal"])
    rmSync(`${path}${suffix}`, { force: true });

  mkdirSync(dirname(path), { recursive: true });
  const db = openDb(path);
  db.close();
}

async function appServerIsRunning() {
  try {
    const response = await fetch("http://127.0.0.1:3001/api/config", {
      signal: AbortSignal.timeout(750),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as Record<string, unknown>;
    return ["openrouter", "langsmith", "tracing"].every((key) => key in body);
  } catch {
    return false;
  }
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  if (await appServerIsRunning()) {
    console.error(
      "Remote Viewing Bench is running. Stop pnpm dev/start, then run pnpm nuke again.",
    );
    process.exitCode = 1;
  } else {
    nukeDatabase(databasePath);
    console.log(
      "Reset complete: removed all app data and restored the starter scopes and prompts.",
    );
  }
}
