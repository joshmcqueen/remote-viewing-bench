import { test } from "node:test";
import assert from "node:assert/strict";
import { createInference } from "./inference.js";
test("OpenRouter and SmithDB LangSmith integration records useful trace context securely", async () => {
  const saved = { ...process.env };
  const requests: { url: string; method: string; body: string }[] = [];
  process.env.OPENROUTER_API_KEY = "or-test-secret";
  process.env.LANGSMITH_API_KEY = "ls-test-secret";
  process.env.LANGSMITH_TRACING = "true";
  process.env.LANGSMITH_PROJECT = "fixture";
  process.env.LANGSMITH_ENDPOINT = "https://trace.invalid";
  try {
    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const body = init?.body ? await new Response(init.body).text() : "";
      requests.push({ url, method: init?.method || "GET", body });
      const headers = { "Content-Type": "application/json" };
      if (url.includes("openrouter.ai"))
        return new Response(
          JSON.stringify({
            id: "response-1",
            model: "test/one",
            choices: [
              {
                message: { role: "assistant", content: "red sphere" },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 753,
              completion_tokens: 1088,
              total_tokens: 1841,
              cost: 0.00464475,
              prompt_tokens_details: {
                cached_tokens: 10,
                cache_write_tokens: 4,
                audio_tokens: 2,
                video_tokens: 1,
              },
              completion_tokens_details: {
                reasoning_tokens: 435,
                image_tokens: 3,
                audio_tokens: 2,
              },
              cost_details: {
                upstream_inference_cost: 0.00464475,
                upstream_inference_prompt_cost: 0.00056475,
                upstream_inference_completions_cost: 0.00408,
              },
            },
          }),
          { headers },
        );
      if (url.includes("/sessions"))
        return new Response(
          JSON.stringify([
            {
              id: "11111111-1111-4111-8111-111111111111",
              tenant_id: "22222222-2222-4222-8222-222222222222",
              name: "fixture",
            },
          ]),
          { headers },
        );
      if (url.includes("/api/v2/runs/") && url.includes("/url?"))
        return new Response(
          JSON.stringify({ url: "https://smith.langchain.com/r/test" }),
          { headers },
        );
      return new Response(JSON.stringify({}), { headers });
    };
    const out = await createInference(fakeFetch)(
      {
        model: "test/one",
        messages: [{ role: "user", content: "Envelope 001" }],
        tool_choice: "none",
        plugins: [],
      },
      new AbortController().signal,
      {
        kind: "generation",
        run_id: 1,
        job_id: 2,
        target_id: "RV-001",
        target_scope: "Physical object",
      },
    );
    assert.equal(out.response.choices[0].message.content, "red sphere");
    assert.ok(out.traceId);
    assert.ok(out.traceUrl?.includes("/r/test"));
    assert.equal(out.traceError, undefined);
    const traces = requests.filter(
      (r) => r.url.includes("trace.invalid") && r.body,
    );
    assert.ok(traces.length >= 2);
    assert.ok(traces.some((r) => r.body.includes("Envelope 001")));
    assert.ok(traces.some((r) => r.body.includes("red sphere")));
    assert.ok(traces.some((r) => r.body.includes("RV-001 · Remote viewing")));
    assert.ok(traces.some((r) => r.body.includes('"target_id":"RV-001"')));
    const completedTrace = traces.find(
      (r) => r.method === "PATCH" && r.body.includes('"total_cost"'),
    );
    assert.ok(completedTrace);
    const completedBody = JSON.parse(completedTrace.body);
    assert.deepEqual(completedBody.extra.metadata.usage_metadata, {
      input_tokens: 753,
      output_tokens: 1088,
      total_tokens: 1841,
      input_token_details: {
        cache_read: 10,
        cache_creation: 4,
        audio: 2,
        video: 1,
      },
      output_token_details: { reasoning: 435, image: 3, audio: 2 },
      input_cost: 0.00056475,
      output_cost: 0.00408,
      total_cost: 0.00464475,
    });
    assert.equal(completedBody.extra.metadata.ls_provider, "openrouter");
    assert.equal(completedBody.extra.metadata.ls_model_name, "test/one");
    assert.deepEqual(completedBody.outputs.usage, {
      prompt_tokens: 753,
      completion_tokens: 1088,
      total_tokens: 1841,
      cost: 0.00464475,
      prompt_tokens_details: {
        cached_tokens: 10,
        cache_write_tokens: 4,
        audio_tokens: 2,
        video_tokens: 1,
      },
      completion_tokens_details: {
        reasoning_tokens: 435,
        image_tokens: 3,
        audio_tokens: 2,
      },
      cost_details: {
        upstream_inference_cost: 0.00464475,
        upstream_inference_prompt_cost: 0.00056475,
        upstream_inference_completions_cost: 0.00408,
      },
    });
    const urlRequest = requests.find((r) =>
      r.url.includes(`/api/v2/runs/${out.traceId}/url?`),
    );
    assert.ok(urlRequest);
    const url = new URL(urlRequest.url);
    assert.equal(
      url.searchParams.get("project_id"),
      "11111111-1111-4111-8111-111111111111",
    );
    assert.equal(url.searchParams.get("trace_id"), out.traceId);
    assert.ok(url.searchParams.get("start_time"));
    assert.ok(
      !requests.some(
        (r) =>
          r.method === "GET" && r.url.includes(`/api/v1/runs/${out.traceId}`),
      ),
    );
    for (const r of traces) {
      assert.ok(!r.body.includes("or-test-secret"));
      assert.ok(!r.body.includes("ls-test-secret"));
    }
  } finally {
    for (const key of [
      "OPENROUTER_API_KEY",
      "LANGSMITH_API_KEY",
      "LANGSMITH_TRACING",
      "LANGSMITH_PROJECT",
      "LANGSMITH_ENDPOINT",
    ]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
