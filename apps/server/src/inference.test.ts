import { test } from "node:test";
import assert from "node:assert/strict";
import { createInference } from "./inference.js";
test("OpenRouter and LangSmith SDK integration keeps credentials out of trace bodies", async () => {
  const saved = { ...process.env };
  const requests: { url: string; body: string }[] = [];
  process.env.OPENROUTER_API_KEY = "or-test-secret";
  process.env.LANGSMITH_API_KEY = "ls-test-secret";
  process.env.LANGSMITH_TRACING = "true";
  process.env.LANGSMITH_PROJECT = "fixture";
  process.env.LANGSMITH_ENDPOINT = "https://trace.invalid";
  try {
    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const body = init?.body ? await new Response(init.body).text() : "";
      requests.push({ url, body });
      const headers = { "Content-Type": "application/json" };
      if (url.includes("openrouter.ai"))
        return new Response(
          JSON.stringify({
            id: "response-1",
            choices: [
              {
                message: { role: "assistant", content: "red sphere" },
                finish_reason: "stop",
              },
            ],
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
      return new Response(
        JSON.stringify({ app_path: "/o/fixture/projects/p/fixture/r/test" }),
        { headers },
      );
    };
    const out = await createInference(fakeFetch)(
      {
        model: "test/one",
        messages: [{ role: "user", content: "Envelope 001" }],
        tool_choice: "none",
        plugins: [],
      },
      new AbortController().signal,
      { kind: "generation", run_id: 1 },
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
