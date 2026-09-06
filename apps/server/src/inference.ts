import OpenAI from "openai";
import { Client } from "langsmith";
import { randomUUID } from "node:crypto";
export type Inference = (
  payload: any,
  signal: AbortSignal,
  meta: Record<string, unknown>,
) => Promise<{
  response: any;
  traceId?: string;
  traceUrl?: string;
  traceError?: string;
}>;
export function createInference(
  fetchImplementation: typeof fetch = fetch,
): Inference {
  const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || "unconfigured",
    baseURL: "https://openrouter.ai/api/v1",
    maxRetries: 0,
    fetch: fetchImplementation,
    timeout: 180000,
  });
  const tracing = process.env.LANGSMITH_TRACING !== "false";
  const client =
    tracing && process.env.LANGSMITH_API_KEY
      ? new Client({
          apiKey: process.env.LANGSMITH_API_KEY,
          apiUrl: process.env.LANGSMITH_ENDPOINT,
          autoBatchTracing: false,
          timeout_ms: 10000,
          callerOptions: { maxRetries: 0 },
          fetchImplementation,
          omitTracedRuntimeInfo: true,
        })
      : null;
  const projectName = process.env.LANGSMITH_PROJECT || "remote-view-bench";
  let projectIdPromise: Promise<string> | undefined;
  const getProjectId = () => {
    if (!client) throw new Error("LangSmith client is not configured");
    projectIdPromise ??= client
      .readProject({ projectName })
      .then((project) => project.id)
      .catch((error) => {
        projectIdPromise = undefined;
        throw error;
      });
    return projectIdPromise;
  };
  return async (payload, signal, meta) => {
    const traceId = randomUUID();
    let traceError: string | undefined;
    let traceUrl: string | undefined;
    const safeError = (e: unknown) =>
      String(e)
        .replaceAll(
          process.env.OPENROUTER_API_KEY || "__NO_OR_KEY__",
          "[redacted]",
        )
        .replaceAll(
          process.env.LANGSMITH_API_KEY || "__NO_LS_KEY__",
          "[redacted]",
        );
    const started = Date.now();
    const kindName =
      meta.kind === "evaluation" ? "Evaluate response" : "Remote viewing";
    const targetId =
      typeof meta.target_id === "string" && meta.target_id.trim()
        ? meta.target_id.trim()
        : undefined;
    if (client)
      try {
        await client.createRun({
          id: traceId,
          name: targetId ? `${targetId} · ${kindName}` : kindName,
          run_type: "llm",
          inputs: payload,
          start_time: started,
          project_name: projectName,
          extra: {
            metadata: {
              ...meta,
              ls_provider: "openrouter",
              ls_model_name: payload.model,
            },
          },
        });
      } catch (e) {
        traceError = safeError(e);
      }
    else if (tracing) traceError = "LangSmith API key is missing";
    let response: any;
    try {
      response = await openai.chat.completions.create(payload, { signal });
    } catch (e) {
      if (client)
        try {
          await client.updateRun(traceId, {
            error: safeError(e),
            end_time: Date.now(),
          });
        } catch (te) {
          traceError = safeError(te);
        }
      throw Object.assign(new Error(safeError(e)), {
        traceId: tracing ? traceId : undefined,
        traceError,
      });
    }
    if (client)
      try {
        await client.updateRun(traceId, {
          outputs: response,
          end_time: Date.now(),
        });
        const url = await client.runs.getURL(traceId, {
          project_id: await getProjectId(),
          trace_id: traceId,
          start_time: new Date(started).toISOString(),
        });
        traceUrl = url.url;
        if (!traceUrl) throw new Error("LangSmith returned no trace URL");
      } catch (e) {
        traceError = safeError(e);
      }
    return {
      response,
      traceId: tracing ? traceId : undefined,
      traceUrl,
      traceError,
    };
  };
}
