import Fastify from "fastify";
import { z } from "zod";
import {
  PromptInput,
  ScopeInput,
  Settings,
  RunInput,
  RevealInput,
  EvaluationInput,
  Score,
  experimentMessages,
  renderEvaluatorPrompt,
  eligibleModel,
  type Model,
} from "@rv/shared";
import type { DB } from "./db.js";
import { seedPrompts } from "./db.js";
import type { Inference } from "./inference.js";
const active = "('queued','running','retrying')";
export function buildApp(
  db: DB,
  infer: Inference,
  options: {
    configured?: boolean;
    tracing?: boolean;
    traceConfigured?: boolean;
    fetchModels?: () => Promise<Model[]>;
  } = {},
) {
  const app = Fastify({ bodyLimit: 15 * 1024 * 1024 });
  const controllers = new Map<number, AbortController>();
  const retryTimers = new Map<number, ReturnType<typeof setTimeout>>();
  let closing = false;
  const row = (sql: string, ...args: any[]) =>
    db.prepare(sql).get(...args) as any;
  const all = (sql: string, ...args: any[]) =>
    db.prepare(sql).all(...args) as any[];
  const currentJobs = (runId: number) =>
    all(
      `SELECT j.* FROM jobs j
       WHERE j.run_id=? AND NOT EXISTS (
         SELECT 1 FROM jobs newer
         WHERE newer.run_id=j.run_id
           AND newer.kind=j.kind
           AND newer.model=j.model
           AND newer.repetition=j.repetition
           AND newer.batch_id IS j.batch_id
           AND (newer.attempt>j.attempt OR (newer.attempt=j.attempt AND newer.id>j.id))
       )
       ORDER BY j.id`,
      runId,
    );
  const requireRow = (value: any) => {
    if (!value)
      throw Object.assign(new Error("Not found"), { statusCode: 404 });
    return value;
  };
  const fail = (message: string) => {
    throw Object.assign(new Error(message), { statusCode: 400 });
  };
  const config = () => ({
    openrouter: options.configured ?? !!process.env.OPENROUTER_API_KEY,
    langsmith: options.traceConfigured ?? !!process.env.LANGSMITH_API_KEY,
    tracing: options.tracing ?? process.env.LANGSMITH_TRACING !== "false",
  });
  const ready = () => {
    const c = config();
    if (!c.openrouter)
      fail(
        "Add OPENROUTER_API_KEY to the root .env file and restart the server.",
      );
    if (c.tracing && !c.langsmith)
      fail(
        "Add LANGSMITH_API_KEY to .env or explicitly set LANGSMITH_TRACING=false, then restart.",
      );
  };
  const safeModel = (model: string) => {
    if (!eligibleModel({ id: model, name: model, supported_parameters: [] }))
      fail(
        "Choose an explicit model without built-in search or online routing.",
      );
  };
  const catalog = () =>
    JSON.parse(
      row("SELECT value FROM catalog WHERE id=1")?.value || "[]",
    ) as Model[];
  const checkModel = (id: string) => {
    safeModel(id);
    const model = requireRow(catalog().find((m) => m.id === id));
    if (!eligibleModel(model))
      fail("Choose a model with text-only output for this bench");
    return model;
  };
  const version = (id: number, kind: string) =>
    requireRow(
      row(
        "SELECT v.*,p.name,p.kind FROM versions v JOIN prompts p ON p.id=v.prompt_id WHERE v.id=? AND p.kind=?",
        id,
        kind,
      ),
    );
  const run = (id: number) =>
    requireRow(row("SELECT * FROM runs WHERE id=?", id));
  const hasActive = (id: number) =>
    !!row(`SELECT 1 FROM jobs WHERE run_id=? AND status IN ${active}`, id);
  const hasActiveGeneration = (id: number) =>
    !!row(
      `SELECT 1 FROM jobs WHERE run_id=? AND kind='generation' AND status IN ${active}`,
      id,
    );
  const summary = (r: any) => {
    const counts = Object.entries(
      currentJobs(r.id).reduce<Record<string, number>>((result, job) => {
        result[job.status] = (result[job.status] || 0) + 1;
        return result;
      }, {}),
    ).map(([status, count]) => ({ status, count }));
    return {
      ...r,
      settings: JSON.parse(r.settings),
      messages: JSON.parse(r.messages),
      counts,
      status: counts.some(
        (c) => c.status === "running" || c.status === "queued",
      )
        ? "running"
        : counts.some((c) => c.status === "retrying")
          ? "running"
          : counts.some(
                (c) => c.status === "error" || c.status === "interrupted",
              )
            ? "needs attention"
            : "complete",
    };
  };
  const decodeJob = (j: any) => ({
    ...j,
    payload: JSON.parse(j.payload),
    response: j.response ? JSON.parse(j.response) : null,
    result: j.result ? JSON.parse(j.result) : null,
  });
  const revealView = (r: any) =>
    r
      ? {
          id: r.id,
          description: r.description,
          created_at: r.created_at,
          image: r.image
            ? `data:${r.mime};base64,${r.image.toString("base64")}`
            : null,
        }
      : null;
  const saveJob = (
    runId: number,
    kind: string,
    model: string,
    repetition: number,
    payload: any,
    batchId: number | null = null,
    sourceId: number | null = null,
    attempt = 1,
  ) =>
    Number(
      db
        .prepare(
          "INSERT INTO jobs(run_id,kind,model,repetition,payload,batch_id,source_id,attempt) VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          runId,
          kind,
          model,
          repetition,
          JSON.stringify(payload),
          batchId,
          sourceId,
          attempt,
        ).lastInsertRowid,
    );
  const retryableProviderError = (error: unknown, message: string) => {
    const status = Number(
      (error as any)?.statusCode ?? (error as any)?.status ?? 0,
    );
    return (
      status === 408 ||
      status === 409 ||
      status === 429 ||
      (status >= 500 && status <= 599) ||
      /\b(?:408|409|429|5\d\d)\b|rate.?limit|temporar(?:y|ily)/i.test(message)
    );
  };
  const beginRetry = (id: number, expectedStatus: string) => {
    const result = db
      .prepare(
        `UPDATE jobs
         SET attempt=attempt+1,status='queued',response=NULL,result=NULL,error=NULL,
             trace_id=NULL,trace_url=NULL,trace_error=NULL,
             created_at=CURRENT_TIMESTAMP,finished_at=NULL
         WHERE id=? AND status=?`,
      )
      .run(id, expectedStatus);
    if (result.changes) pump();
    return !!result.changes;
  };
  const scheduleAutoRetry = (j: any, error: unknown, message: string) => {
    if (closing || !retryableProviderError(error, message)) return false;
    const settings = Settings.parse(JSON.parse(run(j.run_id).settings));
    const retriesUsed = j.attempt - 1;
    if (!settings.autoRetry || retriesUsed >= settings.autoRetryMaxRetries)
      return false;
    const delay = settings.autoRetryDelaySeconds;
    const result = db
      .prepare(
        "UPDATE jobs SET status='retrying',error=? WHERE id=? AND status='error'",
      )
      .run(
        `${message}\nAutomatically retrying in ${delay} second${delay === 1 ? "" : "s"}.`,
        j.id,
      );
    if (!result.changes) return false;
    const timer = setTimeout(() => {
      retryTimers.delete(j.id);
      if (!closing) beginRetry(j.id, "retrying");
    }, delay * 1000);
    retryTimers.set(j.id, timer);
    return true;
  };
  async function execute(j: any) {
    const controller = new AbortController();
    controllers.set(j.id, controller);
    db.prepare("UPDATE jobs SET status='running' WHERE id=?").run(j.id);
    try {
      const r = run(j.run_id);
      const batch = j.batch_id
        ? row("SELECT * FROM batches WHERE id=?", j.batch_id)
        : null;
      const out = await infer(JSON.parse(j.payload), controller.signal, {
        run_id: j.run_id,
        job_id: j.id,
        target_id: r.code,
        target_scope: r.scope_name,
        kind: j.kind,
        model: j.model,
        repetition: j.repetition,
        attempt: j.attempt,
        batch_id: j.batch_id ?? undefined,
        source_job_id: j.source_id ?? undefined,
        prompt_version_id: batch?.prompt_version_id ?? r.prompt_version_id,
      });
      db.prepare(
        "UPDATE jobs SET response=?,trace_id=?,trace_url=?,trace_error=? WHERE id=?",
      ).run(
        JSON.stringify(out.response),
        out.traceId ?? null,
        out.traceUrl ?? null,
        out.traceError ?? null,
        j.id,
      );
      if (row("SELECT status FROM jobs WHERE id=?", j.id).status !== "running")
        return;
      const message = out.response.choices?.[0]?.message;
      if (message?.tool_calls?.length)
        throw new Error(
          "Unexpected tool request received; no tools were executed.",
        );
      if (!message?.content)
        throw new Error("Model returned no text response.");
      if (out.response.choices?.[0]?.finish_reason === "length")
        throw new Error(
          "Output token limit reached; response retained. Retry with a new run or larger evaluation limit.",
        );
      const result =
        j.kind === "evaluation"
          ? Score.parse(JSON.parse(message.content))
          : null;
      db.prepare(
        "UPDATE jobs SET status='complete',result=?,finished_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(result ? JSON.stringify(result) : null, j.id);
    } catch (e) {
      const tracingError = e as any;
      if (tracingError?.traceId)
        db.prepare("UPDATE jobs SET trace_id=?,trace_error=? WHERE id=?").run(
          tracingError.traceId,
          tracingError.traceError ?? null,
          j.id,
        );
      let error = e instanceof Error ? e.message : String(e);
      for (const key of [
        process.env.OPENROUTER_API_KEY,
        process.env.LANGSMITH_API_KEY,
      ])
        if (key) error = error.replaceAll(key, "[redacted]");
      const saved = db
        .prepare(
          "UPDATE jobs SET status='error',error=?,finished_at=CURRENT_TIMESTAMP WHERE id=? AND status='running'",
        )
        .run(error, j.id);
      if (saved.changes) scheduleAutoRetry(j, e, error);
    } finally {
      controllers.delete(j.id);
      pump();
    }
  }
  function pump() {
    if (closing) return;
    while (controllers.size < 3) {
      const j = row(
        "SELECT * FROM jobs WHERE status='queued' ORDER BY id LIMIT 1",
      );
      if (!j) break;
      void execute(j);
    }
  }
  app.addHook("onClose", async () => {
    closing = true;
    for (const timer of retryTimers.values()) clearTimeout(timer);
    retryTimers.clear();
    for (const c of controllers.values()) c.abort();
  });
  app.setErrorHandler((error, _req, reply) => {
    const e = error as any;
    reply.code(e instanceof z.ZodError ? 400 : e.statusCode || 500).send({
      error:
        e instanceof z.ZodError
          ? e.issues
              .map((i: any) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : e.statusCode
            ? e.message
            : "Internal server error",
    });
  });
  app.addHook("onRequest", async (req, reply) => {
    // Local-only app: reject foreign origins and hostnames, including DNS rebinding.
    const host = (req.headers.host || "").split(":")[0];
    if (!["127.0.0.1", "localhost"].includes(host))
      return reply.code(403).send({ error: "Local requests only" });
    const origin = req.headers.origin;
    if (
      origin &&
      ![
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:3001",
        "http://localhost:3001",
      ].includes(origin)
    )
      return reply.code(403).send({ error: "Origin not allowed" });
  });
  app.get("/api/config", async () => config());
  app.get("/api/settings", async () =>
    Settings.parse(
      JSON.parse(row("SELECT value FROM settings WHERE id=1")?.value || "{}"),
    ),
  );
  app.put("/api/settings", async (req) => {
    const s = Settings.parse(req.body);
    db.prepare("INSERT OR REPLACE INTO settings VALUES(1,?)").run(
      JSON.stringify(s),
    );
    return s;
  });
  app.get("/api/models", async () => ({
    models: catalog(),
    updatedAt:
      row("SELECT updated_at FROM catalog WHERE id=1")?.updated_at ?? null,
  }));
  app.post("/api/models/refresh", async () => {
    const models = options.fetchModels
      ? await options.fetchModels()
      : await fetch("https://openrouter.ai/api/v1/models", {
          signal: AbortSignal.timeout(20000),
        }).then(async (r) => {
          if (!r.ok)
            throw Object.assign(new Error("Model catalog refresh failed"), {
              statusCode: 502,
            });
          return ((await r.json()) as any).data;
        });
    const clean = models.map((m: Model) => ({
      id: m.id,
      name: m.name,
      supported_parameters: m.supported_parameters || [],
      architecture: m.architecture,
    }));
    db.prepare(
      "INSERT OR REPLACE INTO catalog(id,value,updated_at) VALUES(1,?,CURRENT_TIMESTAMP)",
    ).run(JSON.stringify(clean));
    return { models: clean };
  });
  app.get("/api/prompts", async () =>
    all(
      "SELECT p.*,v.id versionId,v.version,v.system_content systemContent,v.user_content userContent,v.created_at FROM prompts p JOIN versions v ON p.id=v.prompt_id ORDER BY p.id,v.version DESC",
    ),
  );
  app.post("/api/prompts/reseed", async () =>
    db.transaction(() => {
      // Runs retain their immutable message/job snapshots, but no longer point
      // at prompt versions that are deliberately being removed.
      db.prepare("UPDATE runs SET prompt_version_id=NULL").run();
      db.prepare("UPDATE batches SET prompt_version_id=NULL").run();
      db.prepare("DELETE FROM versions").run();
      db.prepare("DELETE FROM prompts").run();
      seedPrompts(db);
      return { ok: true };
    })(),
  );
  app.get("/api/scopes", async () =>
    all("SELECT * FROM scopes ORDER BY name COLLATE NOCASE"),
  );
  app.post("/api/scopes", async (req) => {
    const scope = ScopeInput.parse(req.body);
    if (row("SELECT 1 FROM scopes WHERE name=? COLLATE NOCASE", scope.name))
      fail("A scope with this name already exists");
    const id = Number(
      db
        .prepare("INSERT INTO scopes(name,description) VALUES(?,?)")
        .run(scope.name, scope.description).lastInsertRowid,
    );
    return { id, ...scope };
  });
  app.patch<{ Params: { id: string } }>("/api/scopes/:id", async (req) => {
    const original = requireRow(
      row("SELECT * FROM scopes WHERE id=?", req.params.id),
    );
    const scope = ScopeInput.parse(req.body);
    if (
      row(
        "SELECT 1 FROM scopes WHERE name=? COLLATE NOCASE AND id<>?",
        scope.name,
        original.id,
      )
    )
      fail("A scope with this name already exists");
    db.prepare("UPDATE scopes SET name=?,description=? WHERE id=?").run(
      scope.name,
      scope.description,
      original.id,
    );
    return { id: original.id, ...scope };
  });
  app.delete<{ Params: { id: string } }>("/api/scopes/:id", async (req) => {
    const scope = requireRow(
      row("SELECT * FROM scopes WHERE id=?", req.params.id),
    );
    db.prepare("DELETE FROM scopes WHERE id=?").run(scope.id);
    return { ok: true };
  });
  app.post("/api/prompts", async (req) => {
    const p = PromptInput.parse(req.body);
    return db.transaction(() => {
      const id = Number(
        db
          .prepare("INSERT INTO prompts(name,kind) VALUES(?,?)")
          .run(p.name, p.kind).lastInsertRowid,
      );
      const versionId = Number(
        db
          .prepare(
            "INSERT INTO versions(prompt_id,version,system_content,user_content) VALUES(?,1,?,?)",
          )
          .run(id, p.systemContent, p.userContent).lastInsertRowid,
      );
      return { id, versionId };
    })();
  });
  app.patch<{ Params: { id: string } }>("/api/prompts/:id", async (req) => {
    const { name } = PromptInput.pick({ name: true }).parse(req.body);
    const original = requireRow(
      row("SELECT * FROM prompts WHERE id=?", req.params.id),
    );
    db.prepare("UPDATE prompts SET name=? WHERE id=?").run(name, original.id);
    return { id: original.id, name };
  });
  app.post<{ Params: { id: string } }>(
    "/api/prompts/:id/versions",
    async (req) => {
      const p = PromptInput.parse(req.body);
      const original = requireRow(
        row("SELECT * FROM prompts WHERE id=?", req.params.id),
      );
      if (original.kind !== p.kind) fail("Prompt kind cannot change");
      return db.transaction(() => {
        db.prepare("UPDATE prompts SET name=? WHERE id=?").run(
          p.name,
          original.id,
        );
        const n =
          row(
            "SELECT MAX(version) n FROM versions WHERE prompt_id=?",
            original.id,
          ).n + 1;
        return {
          versionId: Number(
            db
              .prepare(
                "INSERT INTO versions(prompt_id,version,system_content,user_content) VALUES(?,?,?,?)",
              )
              .run(original.id, n, p.systemContent, p.userContent)
              .lastInsertRowid,
          ),
        };
      })();
    },
  );
  app.get("/api/runs", async () =>
    all("SELECT * FROM runs ORDER BY id DESC").map(summary),
  );
  app.post("/api/runs", async (req) => {
    ready();
    const input = RunInput.parse(req.body);
    if (!input.models.length) fail("Select at least one model");
    const models = [...new Set(input.models)];
    models.forEach(checkModel);
    const scope = requireRow(
      row("SELECT * FROM scopes WHERE id=?", input.scopeId),
    );
    const p = version(input.promptVersionId, "experiment");
    const messages = experimentMessages(
      p.system_content,
      p.user_content,
      input.code,
      scope.description,
    );
    const id = db.transaction(() => {
      const id = Number(
        db
          .prepare(
            "INSERT INTO runs(code,scope_id,scope_name,scope_description,prompt_version_id,messages,settings) VALUES(?,?,?,?,?,?,?)",
          )
          .run(
            input.code,
            scope.id,
            scope.name,
            scope.description,
            p.id,
            JSON.stringify(messages),
            JSON.stringify({ ...input, models }),
          ).lastInsertRowid,
      );
      for (const model of models)
        for (let n = 1; n <= input.repetitions; n++)
          saveJob(id, "generation", model, n, {
            model,
            messages,
            max_tokens: input.maxTokens,
            ...(input.temperature === null
              ? {}
              : { temperature: input.temperature }),
            tool_choice: "none",
            plugins: [],
            provider: { require_parameters: true },
          });
      db.prepare("INSERT OR REPLACE INTO settings VALUES(1,?)").run(
        JSON.stringify(Settings.parse({ ...input, models })),
      );
      return id;
    })();
    pump();
    return { id };
  });
  app.get<{ Params: { id: string } }>("/api/runs/:id", async (req) => {
    const id = Number(req.params.id);
    return {
      ...summary(run(id)),
      jobs: currentJobs(id).map(decodeJob),
      reveal: revealView(
        row(
          "SELECT * FROM reveals WHERE run_id=? ORDER BY id DESC LIMIT 1",
          id,
        ),
      ),
      batches: all(
        "SELECT * FROM batches WHERE run_id=? ORDER BY id DESC",
        id,
      ).map((b) => ({
        ...b,
        reveal: revealView(
          row("SELECT * FROM reveals WHERE id=?", b.reveal_id),
        ),
      })),
    };
  });
  app.delete<{ Params: { id: string } }>("/api/runs/:id", async (req) => {
    const id = Number(req.params.id);
    run(id);
    const jobs = all("SELECT id FROM jobs WHERE run_id=?", id);
    for (const job of jobs) {
      controllers.get(job.id)?.abort();
      const timer = retryTimers.get(job.id);
      if (timer) clearTimeout(timer);
      retryTimers.delete(job.id);
    }
    return db.transaction(() => {
      // Break self-references before removing a run's job attempts.
      db.prepare("UPDATE jobs SET source_id=NULL WHERE run_id=?").run(id);
      db.prepare("DELETE FROM jobs WHERE run_id=?").run(id);
      db.prepare("DELETE FROM batches WHERE run_id=?").run(id);
      db.prepare("DELETE FROM reveals WHERE run_id=?").run(id);
      db.prepare("DELETE FROM runs WHERE id=?").run(id);
      return { ok: true };
    })();
  });
  app.post<{ Params: { id: string } }>("/api/runs/:id/cancel", async (req) => {
    const id = Number(req.params.id);
    run(id);
    const jobs = all(
      `SELECT id FROM jobs WHERE run_id=? AND status IN ${active}`,
      id,
    );
    db.prepare(
      `UPDATE jobs SET status='cancelled',finished_at=CURRENT_TIMESTAMP WHERE run_id=? AND status IN ${active}`,
    ).run(id);
    for (const j of jobs) {
      controllers.get(j.id)?.abort();
      const timer = retryTimers.get(j.id);
      if (timer) clearTimeout(timer);
      retryTimers.delete(j.id);
    }
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>("/api/jobs/:id/retry", async (req) => {
    ready();
    const j = requireRow(row("SELECT * FROM jobs WHERE id=?", req.params.id));
    if (!["error", "interrupted", "cancelled"].includes(j.status))
      fail("Only failed, interrupted, or cancelled attempts can be retried");
    if (
      j.kind === "generation" &&
      row("SELECT 1 FROM reveals WHERE run_id=?", j.run_id)
    )
      fail(
        "Target already revealed. Create a new run to generate more responses.",
      );
    const family = all(
      "SELECT * FROM jobs WHERE run_id=? AND kind=? AND model=? AND repetition=? AND batch_id IS ?",
      j.run_id,
      j.kind,
      j.model,
      j.repetition,
      j.batch_id,
    );
    if (
      family.some((x) => ["queued", "running", "complete"].includes(x.status))
    )
      fail("This request already has an active or successful attempt");
    if (!beginRetry(j.id, j.status)) fail("This request could not be retried");
    return { id: j.id };
  });
  app.post<{ Params: { id: string } }>("/api/runs/:id/reveal", async (req) => {
    const id = Number(req.params.id);
    run(id);
    if (hasActiveGeneration(id))
      fail("Wait for generation to finish before revealing the target");
    const r = RevealInput.parse(req.body);
    let image: Buffer | null = null;
    let mime: string | null = null;
    if (r.image) {
      const m = r.image.match(
        /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/,
      );
      if (!m) fail("Use a JPEG, PNG, or WebP image");
      mime = m![1];
      image = Buffer.from(m![2], "base64");
      if (image.length > 10 * 1024 * 1024) fail("Maximum image size is 10 MB");
      const valid =
        mime === "image/png"
          ? image
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : mime === "image/jpeg"
            ? image[0] === 255 && image[1] === 216 && image[2] === 255
            : image.toString("ascii", 0, 4) === "RIFF" &&
              image.toString("ascii", 8, 12) === "WEBP";
      if (!valid) fail("Image contents do not match the file type");
    }
    const revealId = Number(
      db
        .prepare(
          "INSERT INTO reveals(run_id,description,image,mime) VALUES(?,?,?,?)",
        )
        .run(id, r.description, image, mime).lastInsertRowid,
    );
    return { id: revealId };
  });
  app.post<{ Params: { id: string } }>(
    "/api/runs/:id/evaluate",
    async (req) => {
      ready();
      const id = Number(req.params.id);
      const r = run(id);
      if (hasActive(id)) fail("Wait for current work to finish");
      const input = EvaluationInput.parse(req.body);
      const model = checkModel(input.model);
      if (!model.supported_parameters.includes("structured_outputs"))
        fail("Evaluator must support structured outputs");
      const reveal = requireRow(
        row(
          "SELECT * FROM reveals WHERE run_id=? ORDER BY id DESC LIMIT 1",
          id,
        ),
      );
      if (
        reveal.image &&
        !model.architecture?.input_modalities?.includes("image")
      )
        fail("Choose a vision-capable evaluator for this image");
      const p = version(input.promptVersionId, "evaluator");
      const sources = all(
        "SELECT * FROM jobs WHERE run_id=? AND kind='generation' AND status='complete'",
        id,
      );
      if (!sources.length) fail("No successful responses to evaluate");
      const batchId = db.transaction(() => {
        const batchId = Number(
          db
            .prepare(
              "INSERT INTO batches(run_id,reveal_id,prompt_version_id,model) VALUES(?,?,?,?)",
            )
            .run(id, reveal.id, p.id, input.model).lastInsertRowid,
        );
        for (const source of sources) {
          const values = {
            targetScope: r.scope_description,
            targetDescription: reveal.description,
            response: JSON.parse(source.response).choices[0].message.content,
          };
          const content: any[] = [
            {
              type: "text",
              text: renderEvaluatorPrompt(p.user_content, values),
            },
          ];
          if (reveal.image)
            content.push({
              type: "image_url",
              image_url: {
                url: `data:${reveal.mime};base64,${reveal.image.toString("base64")}`,
              },
            });
          saveJob(
            id,
            "evaluation",
            input.model,
            source.id,
            {
              model: input.model,
              messages: [
                {
                  role: "system",
                  content: p.system_content,
                },
                { role: "user", content },
              ],
              max_tokens: 4096,
              tool_choice: "none",
              plugins: [],
              provider: { require_parameters: true },
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "correspondence",
                  strict: true,
                  schema: z.toJSONSchema(Score),
                },
              },
            },
            batchId,
            source.id,
          );
        }
        return batchId;
      })();
      pump();
      return { id: batchId };
    },
  );
  return app;
}
