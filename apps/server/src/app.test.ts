import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnv } from "./config.js";
import { openDb } from "./db.js";
import { buildApp } from "./app.js";
import type { Inference } from "./inference.js";
const models = [
  {
    id: "test/one",
    name: "One",
    supported_parameters: ["structured_outputs"],
    architecture: { input_modalities: ["text", "image"] },
  },
  {
    id: "test/two",
    name: "Two",
    supported_parameters: [],
    architecture: { input_modalities: ["text"] },
  },
];
const score = {
  score: 5,
  rationale: "Distinctive matches with errors",
  observations: [
    {
      attribute: "color",
      verdict: "match",
      responseEvidence: "red",
      targetEvidence: "red",
      explanation: "Direct match",
    },
  ],
};
const response = (content: string) => ({
  choices: [{ message: { content }, finish_reason: "stop" }],
});
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH7sAAAAASUVORK5CYII=";
async function fixture(
  infer: Inference = async (p) => ({
    response: response(
      p.response_format ? JSON.stringify(score) : "red round smooth",
    ),
  }),
  configured = true,
) {
  const db = openDb(":memory:");
  const app = buildApp(db, infer, {
    configured,
    tracing: true,
    traceConfigured: true,
    fetchModels: async () => models,
  });
  const call = async (url: string, body?: any, method?: any) => {
    const r = await app.inject({
      url: "/api" + url,
      method: method || (body === undefined ? "GET" : "POST"),
      payload: body,
    });
    return { status: r.statusCode, data: r.json() };
  };
  await call("/models/refresh", {});
  const ps = (await call("/prompts")).data;
  const scopes = (await call("/scopes")).data;
  const input = {
    code: "RV-001",
    scopeId: scopes.find((scope: any) => scope.name === "Physical object").id,
    promptVersionId: ps.find((p: any) => p.kind === "experiment").versionId,
    models: models.map((m) => m.id),
    repetitions: 1,
    temperature: null,
  };
  const wait = async (id: number) => {
    for (let n = 0; n < 100; n++) {
      const r = (await call(`/runs/${id}`)).data;
      if (r.status !== "running") return r;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error("Timed out");
  };
  return {
    db,
    app,
    call,
    input,
    ps,
    scopes,
    wait,
    close: async () => {
      await app.close();
      db.close();
    },
  };
}
test("renaming prompts preserves versions and validates names", async () => {
  const f = await fixture();
  try {
    const p = f.ps[0];
    await f.call(`/prompts/${p.id}/versions`, {
      ...p,
      systemContent: "Second system version",
      userContent: "Second user version",
    });
    const before = (await f.call("/prompts")).data;
    const newVersion = before.find(
      (version: any) => version.id === p.id && version.version === 2,
    );
    assert.equal(newVersion.systemContent, "Second system version");
    assert.equal(newVersion.userContent, "Second user version");
    const renamed = await f.call(
      `/prompts/${p.id}`,
      { name: "  Renamed prompt  " },
      "PATCH",
    );
    assert.equal(renamed.status, 200);
    const after = (await f.call("/prompts")).data;
    assert.deepEqual(
      after,
      before.map((v: any) =>
        v.id === p.id ? { ...v, name: "Renamed prompt" } : v,
      ),
    );
    for (const name of [" ", "x".repeat(121)]) {
      assert.equal(
        (await f.call(`/prompts/${p.id}`, { name }, "PATCH")).status,
        400,
      );
    }
    assert.equal(
      (await f.call("/prompts/999999", { name: "Missing" }, "PATCH")).status,
      404,
    );
    await f.call(`/prompts/${p.id}/versions`, {
      ...p,
      name: "Renamed with version",
    });
    assert.ok(
      (await f.call("/prompts")).data
        .filter((v: any) => v.id === p.id)
        .every((v: any) => v.name === "Renamed with version"),
    );
  } finally {
    await f.close();
  }
});
test("reseed replaces prompt history while preserving run snapshots", async () => {
  const f = await fixture();
  try {
    const experiment = f.ps.find((p: any) => p.kind === "experiment");
    await f.call(`/prompts/${experiment.id}/versions`, {
      ...experiment,
      systemContent: "Temporary system prompt",
      userContent: "Temporary user prompt",
    });
    const runId = (await f.call("/runs", { ...f.input, models: ["test/one"] }))
      .data.id;
    const before = await f.wait(runId);

    const reset = await f.call("/prompts/reseed", {});
    assert.equal(reset.status, 200);
    const prompts = (await f.call("/prompts")).data;
    assert.equal(prompts.length, 2);
    assert.ok(prompts.every((prompt: any) => prompt.version === 1));
    assert.deepEqual(
      prompts.map((prompt: any) => prompt.name),
      ["First impressions", "Correspondence rubric"],
    );

    const after = (await f.call(`/runs/${runId}`)).data;
    assert.equal(after.prompt_version_id, null);
    assert.deepEqual(after.messages, before.messages);
  } finally {
    await f.close();
  }
});
test("project scopes can be added, edited, renamed, and deleted", async () => {
  const f = await fixture();
  try {
    assert.deepEqual(f.scopes.map((scope: any) => scope.name).sort(), [
      "Physical object",
      "Subject of a photograph",
      "Text written on paper",
    ]);
    const created = await f.call("/scopes", {
      name: "Sound recording",
      description: "the sounds captured in a recording inside the envelope",
    });
    assert.equal(created.status, 200);
    assert.equal(
      (
        await f.call("/scopes", {
          name: "sound RECORDING",
          description: "duplicate",
        })
      ).status,
      400,
    );
    const changed = await f.call(
      `/scopes/${created.data.id}`,
      {
        name: "Audio recording",
        description: "the subject and qualities of an enclosed audio recording",
      },
      "PATCH",
    );
    assert.equal(changed.data.name, "Audio recording");

    const runId = (
      await f.call("/runs", {
        ...f.input,
        models: ["test/one"],
        scopeId: created.data.id,
      })
    ).data.id;
    await f.wait(runId);
    await f.call(`/scopes/${created.data.id}`, undefined, "DELETE");
    const run = (await f.call(`/runs/${runId}`)).data;
    assert.equal(run.scope_id, null);
    assert.equal(run.scope_name, "Audio recording");
    assert.equal(
      run.scope_description,
      "the subject and qualities of an enclosed audio recording",
    );
    assert.equal(
      (await f.call(`/scopes/${created.data.id}`, undefined, "DELETE")).status,
      404,
    );
  } finally {
    await f.close();
  }
});
test("runs and all of their owned records can be deleted", async () => {
  const f = await fixture();
  try {
    const id = (await f.call("/runs", { ...f.input, models: ["test/one"] }))
      .data.id;
    await f.wait(id);
    await f.call(`/runs/${id}/reveal`, {
      description: "secret red marble",
      image: png,
    });
    await f.call(`/runs/${id}/evaluate`, {
      model: "test/one",
      promptVersionId: f.ps.find((p: any) => p.kind === "evaluator").versionId,
    });
    await f.wait(id);

    const deleted = await f.call(`/runs/${id}`, undefined, "DELETE");
    assert.equal(deleted.status, 200);
    assert.equal((await f.call(`/runs/${id}`)).status, 404);
    for (const table of ["jobs", "batches", "reveals", "runs"])
      assert.equal(
        (f.db.prepare(`SELECT COUNT(*) count FROM ${table}`).get() as any)
          .count,
        0,
      );
    assert.equal(
      (await f.call(`/runs/${id}`, undefined, "DELETE")).status,
      404,
    );
  } finally {
    await f.close();
  }
});
test("deleting an active run aborts its in-flight work", async () => {
  let aborted = 0;
  const f = await fixture(
    async (_payload, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            aborted++;
            reject(new Error("aborted"));
          },
          { once: true },
        );
      }),
  );
  try {
    const id = (await f.call("/runs", { ...f.input, models: ["test/one"] }))
      .data.id;
    assert.equal(
      (await f.call(`/runs/${id}`, undefined, "DELETE")).status,
      200,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(aborted, 1);
    assert.equal((await f.call(`/runs/${id}`)).status, 404);
  } finally {
    await f.close();
  }
});
test("full experiment, immutable prompts, identical payloads, reveal and evaluation snapshots", async () => {
  const calls: any[] = [];
  const traceMetadata: Record<string, unknown>[] = [];
  const f = await fixture(async (p, _signal, meta) => {
    calls.push(p);
    traceMetadata.push(meta);
    return {
      response: response(
        p.response_format ? JSON.stringify(score) : "red round smooth",
      ),
      traceId: "trace",
      traceUrl: "https://smith.langchain.com/trace",
    };
  });
  try {
    await f.call("/settings", { outputTokenLimit: 6123 }, "PUT");
    const id = (await f.call("/runs", f.input)).data.id;
    let r = await f.wait(id);
    assert.equal(r.jobs.length, 2);
    assert.deepEqual(calls[0].messages, calls[1].messages);
    assert.equal(calls[0].messages[0].role, "system");
    assert.ok(
      calls[0].messages[0].content.includes(
        "Produce a fresh, imaginative, and testable session report",
      ),
    );
    assert.deepEqual(calls[0].messages[1], {
      role: "user",
      content:
        "Begin a new independent session for target RV-001.\n\nApply the target scope exactly as stated. Capture the first coherent pattern, develop it into specific testable details, and finish with ranked guesses and one final lock-in.",
    });
    assert.equal(calls[0].tool_choice, "none");
    assert.deepEqual(calls[0].plugins, []);
    assert.equal(calls[0].tools, undefined);
    assert.equal(calls[0].temperature, undefined);
    assert.equal(calls[0].max_tokens, 6123);
    assert.equal(r.settings.outputTokenLimit, 6123);
    assert.deepEqual(
      {
        target_id: traceMetadata[0].target_id,
        target_scope: traceMetadata[0].target_scope,
        run_id: traceMetadata[0].run_id,
        job_id: traceMetadata[0].job_id,
        kind: traceMetadata[0].kind,
        attempt: traceMetadata[0].attempt,
      },
      {
        target_id: "RV-001",
        target_scope: "Physical object",
        run_id: id,
        job_id: 1,
        kind: "generation",
        attempt: 1,
      },
    );
    const p = f.ps.find((p: any) => p.kind === "experiment");
    await f.call(`/prompts/${p.id}/versions`, {
      name: p.name,
      kind: p.kind,
      systemContent: "New system instructions",
      userContent: "New user instructions",
    });
    assert.equal(
      (await f.call(`/runs/${id}`)).data.messages[0].content,
      r.messages[0].content,
    );
    await f.call(`/runs/${id}/reveal`, {
      description: "secret red marble",
      image: png,
    });
    assert.ok(!JSON.stringify(calls.slice(0, 2)).includes("secret"));
    assert.equal(
      (
        await f.call(`/runs/${id}/evaluate`, {
          model: "test/two",
          promptVersionId: f.ps.find((p: any) => p.kind === "evaluator")
            .versionId,
        })
      ).status,
      400,
    );
    const evaluation = {
      model: "test/one",
      promptVersionId: f.ps.find((p: any) => p.kind === "evaluator").versionId,
    };
    await f.call(`/runs/${id}/evaluate`, evaluation);
    r = await f.wait(id);
    assert.equal(calls[2].messages[0].role, "system");
    assert.equal(calls[2].max_tokens, 6123);
    assert.equal(calls[2].messages[1].role, "user");
    assert.ok(
      calls[2].messages[0].content.includes(
        "Return only JSON matching the required schema",
      ),
    );
    assert.equal(r.jobs.filter((j: any) => j.result?.score === 5).length, 2);
    assert.ok(
      calls[2].messages[1].content[0].text.includes("secret red marble"),
    );
    assert.ok(
      calls[2].messages[1].content[0].text.includes("red round smooth"),
    );
    assert.ok(!calls[2].messages[1].content[0].text.includes("test/"));
    assert.equal(calls[2].messages[1].content[1].image_url.url, png);
    assert.equal(traceMetadata[2].target_id, "RV-001");
    assert.equal(traceMetadata[2].kind, "evaluation");
    assert.equal(traceMetadata[2].batch_id, 1);
    assert.equal(traceMetadata[2].source_job_id, 1);
    await f.call(`/runs/${id}/reveal`, {
      description: "corrected blue marble",
    });
    await f.call(`/runs/${id}/evaluate`, evaluation);
    r = await f.wait(id);
    assert.equal(r.batches.length, 2);
    assert.equal(r.batches[1].reveal.description, "secret red marble");
    assert.equal(r.batches[1].reveal.image, png);
    assert.equal(r.batches[0].reveal.description, "corrected blue marble");
    assert.equal(r.jobs.length, 6);
  } finally {
    await f.close();
  }
});
test("partial failure and explicit retry replace the failed item; trace warnings preserve output", async () => {
  let fail = true;
  const f = await fixture(async (p) => {
    if (p.model === "test/two" && fail) throw new Error("Provider unavailable");
    return {
      response: response("red"),
      traceError: "Trace service unavailable",
    };
  });
  try {
    const id = (await f.call("/runs", f.input)).data.id;
    let r = await f.wait(id);
    assert.equal(r.status, "needs attention");
    const failed = r.jobs.find((j: any) => j.status === "error");
    assert.equal(r.jobs[0].status, "complete");
    assert.equal(r.jobs[0].trace_error, "Trace service unavailable");
    fail = false;
    await f.call(`/jobs/${failed.id}/retry`, {});
    r = await f.wait(id);
    assert.equal(r.jobs.length, 2);
    assert.equal(r.jobs[1].id, failed.id);
    assert.equal(r.jobs[1].attempt, 2);
    assert.equal(r.jobs[1].status, "complete");
    assert.equal(r.status, "complete");
    assert.equal((await f.call(`/jobs/${failed.id}/retry`, {})).status, 400);
  } finally {
    await f.close();
  }
});
test("active reveal blocked; cancellation prevents pending jobs from dispatching", async () => {
  let calls = 0;
  const f = await fixture(async (_p, signal) => {
    calls++;
    return await new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(new Error("Aborted"))),
    );
  });
  try {
    const id = (await f.call("/runs", { ...f.input, repetitions: 3 })).data.id;
    assert.equal(calls, 3);
    assert.equal(
      (await f.call(`/runs/${id}/reveal`, { description: "red" })).status,
      400,
    );
    await f.call(`/runs/${id}/cancel`, {});
    const r = await f.wait(id);
    assert.ok(r.jobs.every((j: any) => j.status === "cancelled"));
    assert.equal(calls, 3);
    await f.call(`/runs/${id}/reveal`, { description: "red" });
    assert.equal((await f.call(`/jobs/${r.jobs[0].id}/retry`, {})).status, 400);
  } finally {
    await f.close();
  }
});
test("invalid scoring can be replaced by a valid evaluator retry", async () => {
  let valid = false;
  const f = await fixture(async (p) => ({
    response: response(
      p.response_format
        ? JSON.stringify({ ...score, score: valid ? 5 : 99 })
        : "red",
    ),
  }));
  try {
    const id = (await f.call("/runs", { ...f.input, models: ["test/one"] }))
      .data.id;
    await f.wait(id);
    await f.call(`/runs/${id}/reveal`, { description: "red" });
    await f.call(`/runs/${id}/evaluate`, {
      model: "test/one",
      promptVersionId: f.ps.find((p: any) => p.kind === "evaluator").versionId,
    });
    let r = await f.wait(id);
    const bad = r.jobs[1];
    assert.equal(bad.status, "error");
    assert.ok(bad.response);
    valid = true;
    await f.call(`/jobs/${bad.id}/retry`, {});
    r = await f.wait(id);
    assert.equal(r.jobs.length, 2);
    assert.equal(r.jobs[1].id, bad.id);
    assert.equal(r.jobs[1].attempt, 2);
    assert.equal(r.jobs[1].result.score, 5);
  } finally {
    await f.close();
  }
});
test("rate limits retry automatically after the configured delay", async () => {
  let calls = 0;
  const f = await fixture(async () => {
    calls++;
    if (calls === 1)
      throw Object.assign(new Error("429 Provider returned error"), {
        statusCode: 429,
      });
    return { response: response("red") };
  });
  try {
    const id = (
      await f.call("/runs", {
        ...f.input,
        models: ["test/one"],
        autoRetry: true,
        autoRetryDelaySeconds: 1,
        autoRetryMaxRetries: 1,
      })
    ).data.id;
    const scheduled = (await f.call(`/runs/${id}`)).data;
    assert.equal(scheduled.jobs.length, 1);
    assert.equal(scheduled.jobs[0].status, "retrying");
    assert.match(scheduled.jobs[0].error, /Automatically retrying in 1 second/);

    let completed: any;
    for (let n = 0; n < 300; n++) {
      completed = (await f.call(`/runs/${id}`)).data;
      if (completed.status !== "running") break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(calls, 2);
    assert.equal(completed.status, "complete");
    assert.equal(completed.jobs.length, 1);
    assert.equal(completed.jobs[0].attempt, 2);
    assert.equal(completed.jobs[0].error, null);
  } finally {
    await f.close();
  }
});
test("restart marks queued, active, and scheduled work interrupted without modifying complete attempts", () => {
  const dir = mkdtempSync(join(tmpdir(), "rv-test-"));
  try {
    let db = openDb(join(dir, "bench.sqlite"));
    db.prepare(
      "INSERT INTO runs(id,code,scope_name,scope_description,messages,settings) VALUES(1,'x','Physical object','an object','[]','{}')",
    ).run();
    for (const status of ["queued", "running", "retrying", "complete"])
      db.prepare(
        "INSERT INTO jobs(run_id,kind,model,repetition,status,payload) VALUES(1,'generation','test/one',1,?,'{}')",
      ).run(status);
    db.close();
    db = openDb(join(dir, "bench.sqlite"));
    assert.deepEqual(db.prepare("SELECT status FROM jobs ORDER BY id").all(), [
      { status: "interrupted" },
      { status: "interrupted" },
      { status: "interrupted" },
      { status: "complete" },
    ]);
    db.close();
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test("configuration missing blocks inference, settings persist, foreign origins rejected", async () => {
  const f = await fixture(undefined, false);
  try {
    assert.equal((await f.call("/runs", f.input)).status, 400);
    assert.equal((await f.call("/runs")).status, 200);
    assert.equal((await f.call("/settings")).data.outputTokenLimit, 5000);
    const c = (await f.call("/config")).data;
    assert.deepEqual(Object.keys(c).sort(), [
      "langsmith",
      "openrouter",
      "tracing",
    ]);
    await f.call(
      "/settings",
      {
        models: ["test/one"],
        repetitions: 2,
        outputTokenLimit: 3000,
        temperature: 0.5,
        evaluatorModel: "test/one",
      },
      "PUT",
    );
    assert.equal((await f.call("/settings")).data.repetitions, 2);
    assert.equal((await f.call("/settings")).data.outputTokenLimit, 3000);
    assert.equal((await f.call("/settings")).data.autoRetry, true);
    assert.equal((await f.call("/settings")).data.autoRetryDelaySeconds, 10);
    const bad = await f.app.inject({
      url: "/api/config",
      headers: { origin: "https://untrusted.example" },
    });
    assert.equal(bad.statusCode, 403);
    const host = await f.app.inject({
      url: "/api/config",
      headers: { host: "untrusted.example" },
    });
    assert.equal(host.statusCode, 403);
    assert.match(
      readFileSync(new URL("../../../.gitignore", import.meta.url), "utf8"),
      /^\.env$/m,
    );
  } finally {
    await f.close();
  }
});

test("root .env loads independently of cwd and preserves existing environment", () => {
  const dir = mkdtempSync(join(tmpdir(), "rv-env-"));
  const key = "RV_BENCH_CONFIG_TEST";
  const previous = process.env[key];
  try {
    writeFileSync(join(dir, ".env"), `${key}=fixture-value\n`);
    delete process.env[key];
    loadEnv(dir);
    assert.equal(process.env[key], "fixture-value");
    process.env[key] = "existing";
    loadEnv(dir);
    assert.equal(process.env[key], "existing");
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
    rmSync(dir, { recursive: true });
  }
});
