import OpenAI from "openai";
import { Client } from "langsmith";
import { randomUUID } from "node:crypto";

const finiteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const numberDetails = (
  source: unknown,
  fields: Record<string, string>,
): Record<string, number> | undefined => {
  if (!source || typeof source !== "object") return undefined;
  const details: Record<string, number> = {};
  for (const [sourceField, langSmithField] of Object.entries(fields)) {
    const value = finiteNumber(
      (source as Record<string, unknown>)[sourceField],
    );
    if (value !== undefined) details[langSmithField] = value;
  }
  return Object.keys(details).length ? details : undefined;
};

const langSmithUsageMetadata = (response: unknown) => {
  if (!response || typeof response !== "object") return undefined;
  const usage = (response as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const source = usage as Record<string, any>;
  const metadata: Record<string, unknown> = {};

  const inputTokens = finiteNumber(source.prompt_tokens);
  const outputTokens = finiteNumber(source.completion_tokens);
  const totalTokens = finiteNumber(source.total_tokens);
  if (inputTokens !== undefined) metadata.input_tokens = inputTokens;
  if (outputTokens !== undefined) metadata.output_tokens = outputTokens;
  if (totalTokens !== undefined) metadata.total_tokens = totalTokens;

  const inputTokenDetails = numberDetails(source.prompt_tokens_details, {
    cached_tokens: "cache_read",
    cache_write_tokens: "cache_creation",
    audio_tokens: "audio",
    video_tokens: "video",
  });
  const outputTokenDetails = numberDetails(source.completion_tokens_details, {
    reasoning_tokens: "reasoning",
    image_tokens: "image",
    audio_tokens: "audio",
  });
  if (inputTokenDetails) metadata.input_token_details = inputTokenDetails;
  if (outputTokenDetails) metadata.output_token_details = outputTokenDetails;

  const inputCost = finiteNumber(
    source.cost_details?.upstream_inference_prompt_cost,
  );
  const outputCost = finiteNumber(
    source.cost_details?.upstream_inference_completions_cost,
  );
  const totalCost =
    finiteNumber(source.cost) ??
    finiteNumber(source.cost_details?.upstream_inference_cost) ??
    (inputCost !== undefined && outputCost !== undefined
      ? inputCost + outputCost
      : undefined);
  if (inputCost !== undefined) metadata.input_cost = inputCost;
  if (outputCost !== undefined) metadata.output_cost = outputCost;
  if (totalCost !== undefined) metadata.total_cost = totalCost;

  return Object.keys(metadata).length ? metadata : undefined;
};

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
    const traceMetadata = {
      ...meta,
      ls_provider: "openrouter",
      ls_model_name: payload.model,
    };
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
            metadata: traceMetadata,
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
        statusCode: (e as any)?.status ?? (e as any)?.statusCode,
      });
    }
    if (client)
      try {
        const usageMetadata = langSmithUsageMetadata(response);
        await client.updateRun(traceId, {
          outputs: response,
          end_time: Date.now(),
          extra: {
            metadata: {
              ...traceMetadata,
              ...(usageMetadata ? { usage_metadata: usageMetadata } : {}),
            },
          },
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
