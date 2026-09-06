# Remote Viewing Bench

A local, single-user workbench for versioned remote-viewing experiments. Node/TypeScript + Fastify, React/Vite, SQLite, OpenRouter inference, and LangSmith tracing.

## Start

Requires Node 22.12+ and pnpm 11. On macOS, a native SQLite build may require Xcode command-line tools if a prebuilt binary is unavailable.

```sh
pnpm install
pnpm dev
```

Open http://127.0.0.1:5173. The root `.env` has empty placeholders; enter your keys and restart the server. On a fresh clone, copy `.env.example` to `.env` first.

```dotenv
OPENROUTER_API_KEY=
LANGSMITH_API_KEY=
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=remote-view-bench
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
```

Both keys are required for traced runs. Set `LANGSMITH_TRACING=false` explicitly to run without tracing. Saved history and prompt editing work without keys. Credentials are only read on the backend and never returned to the browser.

For a built application:

```sh
pnpm build
pnpm start
```

Open http://127.0.0.1:3001. Both servers bind to loopback. No login or cloud deployment is included.

## Daily workflow

1. Publish your envelope code and target outside this app.
2. Refresh the model catalog under New Run or Settings. Select the models to use.
3. Create a run with only the envelope code, project scope, prompt version, and generation settings. The three starter scopes are a physical object, text written on paper, and the subject of a photograph; scopes can be managed in Settings. Review the exact system and user messages before starting.
4. Wait for responses. Failed requests remain visible; retry creates another attempt. Cancellation preserves completed responses.
5. Reveal the target with a description and optional JPEG, PNG, or WebP image (10 MB maximum).
6. Choose a structured-output evaluator; images also require vision support. Run evaluation and review correspondence scores, evidence, contradictions, and unverifiable claims.
7. Refine prompts by saving a new version. Re-evaluations and target corrections preserve previous evidence and results.

The starter score is a qualitative **0–7 correspondence rating**, adapted from historical SRI descriptions. It is not a percentage or a statistical test. Seed categories are inspired by CRV sensory and dimensional descriptions. Prompts are editable; the structured evaluation response shape remains fixed in v1.

Sources: [SRI correspondence scale archive](https://sentinel-files.com/files/cia-rdp96-00789r003200200001-4-sf-2026-001038), [CRV Stage II manual](https://rviewer.com/introduction-to-the-controlled-coordinate-remote-viewing-manual/crv-stage-2-coordinate-controlled-remote-viewing-manual/).

## Data and tracing

All application records and image BLOBs live in `data/bench.sqlite`. SQLite uses WAL; stop the server before backing up the entire `data` directory. Credentials and local data are Git-ignored. Prompt versions, run payloads, generation attempts, reveals, evaluation batches, and results are persistent. Unfinished requests become interrupted after restart; they are never automatically resubmitted.

Each inference uses a fresh OpenRouter conversation with separate, editable system and user prompt templates, and with no tools, search plugins, or browsing integration. Experiment templates support target-code and target-scope variables; evaluator user templates support target scope, description, and response variables. Online/search-oriented models, automatic routers, batch variants, and non-text output models are excluded. `provider.require_parameters` asks OpenRouter to route only to providers supporting the requested settings; unsupported settings fail visibly rather than silently disappearing. Target evidence enters only evaluator requests, and generation retries are disallowed after reveal.

LangSmith receives full inference inputs and outputs, including target images for evaluation, with run/model/prompt metadata. The UI links to traces when available and shows tracing delivery errors without discarding model output. Traces expose app-level requests and responses, not provider-internal execution. No API credentials are intentionally included in payloads or trace metadata.

There is no durable trace-export queue or automatic inference retry. Cancellation can abort the local request, but a provider may still finish or bill it. Each failed/cancelled attempt stays in history even when a retry succeeds.

## Commands and layout

```sh
pnpm build
pnpm typecheck
pnpm test
```

- `apps/server`: local API, migrations, persistent queue, OpenRouter/LangSmith integration.
- `apps/web`: React interface and plain CSS.
- `packages/shared`: validation contracts, scoring schema, prompt renderer, and starter prompts.

The automated suite uses mocked inference and model discovery; it does not incur API charges. It covers the complete experiment workflow, version/evidence immutability, request separation, partial failure/retry, cancellation, restart recovery, structured scoring validation, and configuration boundaries.
