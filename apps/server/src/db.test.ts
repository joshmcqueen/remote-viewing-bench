import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultScopes } from "@rv/shared";
import { openDb } from "./db.js";
import { nukeDatabase } from "./nuke.js";
import { promptSeeds } from "./prompt-seeds.js";

test("nuke recreates a blank database with only starter scopes and prompts", () => {
  const dir = mkdtempSync(join(tmpdir(), "rv-nuke-"));
  const path = join(dir, "bench.sqlite");
  try {
    const before = openDb(path);
    const experimentVersion = (
      before
        .prepare(
          "SELECT v.id FROM versions v JOIN prompts p ON p.id=v.prompt_id WHERE p.kind='experiment'",
        )
        .get() as { id: number }
    ).id;
    const scope = before.prepare("SELECT id FROM scopes LIMIT 1").get() as {
      id: number;
    };
    before.prepare("INSERT INTO settings VALUES(1, '{}')").run();
    before.prepare("INSERT INTO catalog(id,value) VALUES(1, '[]')").run();
    before
      .prepare(
        "INSERT INTO runs(code,scope_id,scope_name,scope_description,prompt_version_id,messages,settings) VALUES('old',?,'old','old',?,'[]','{}')",
      )
      .run(scope.id, experimentVersion);
    before.close();

    nukeDatabase(path);

    assert.equal(existsSync(path), true);
    const after = openDb(path);
    assert.equal(
      (after.prepare("SELECT COUNT(*) count FROM runs").get() as any).count,
      0,
    );
    assert.equal(
      (after.prepare("SELECT COUNT(*) count FROM settings").get() as any).count,
      0,
    );
    assert.equal(
      (after.prepare("SELECT COUNT(*) count FROM catalog").get() as any).count,
      0,
    );
    assert.deepEqual(
      after.prepare("SELECT name,description FROM scopes ORDER BY id").all(),
      defaultScopes,
    );
    assert.deepEqual(
      after
        .prepare(
          "SELECT p.name,p.kind,v.system_content systemContent,v.user_content userContent FROM prompts p JOIN versions v ON v.prompt_id=p.id ORDER BY p.id",
        )
        .all(),
      promptSeeds.map((prompt) => ({ ...prompt })),
    );
    assert.deepEqual(
      after.prepare("SELECT version FROM migrations ORDER BY version").all(),
      [{ version: 1 }, { version: 2 }],
    );
    assert.ok(
      after
        .prepare("PRAGMA table_info(jobs)")
        .all()
        .some((column: any) => column.name === "started_at"),
    );
    after.close();
  } finally {
    rmSync(dir, { recursive: true });
  }
});
