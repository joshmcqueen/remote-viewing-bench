# Remote Viewing Bench

A local research workspace for testing a strange but tractable question: can a language model describe a target it has not been shown?

Remote Viewing Bench runs, compares, and preserves versioned, blinded remote-viewing experiments with language models. It uses Node/TypeScript + Fastify, React/Vite, SQLite, OpenRouter inference, and LangSmith tracing.

## Why this exists

The project began with an anecdote from physicist Thomas Campbell. On [The Joe Rogan Experience](https://www.youtube.com/watch?v=v2oBLSDCZaY), Campbell described placing a wooden spoon inside a cardboard box and asking Alexa to identify it. According to his account, Alexa described the object, its material, and an unusual pattern of holes in its handle.

It is a remarkable claim, and an anecdote is not evidence. But it points toward an experiment that can be repeated.

Philosopher Jason Reza Jorjani discusses claims of machine remote viewing as part of a broader inquiry into consciousness, intelligence, anomalous experience, and the increasingly complex relationship between technology and the esoteric. The conversation that helped inspire this project is [Decoding the Occult Horizons](https://www.youtube.com/watch?v=Qr-upy40irs).

Remote Viewing Bench was built in the space between those provocations and a healthy skepticism. The aim is not to make the strange sound certain. It is to make it testable.

The app therefore keeps target evidence out of the initial prompt, records first impressions before the reveal, preserves misses and contradictions, and evaluates correspondence using a consistent rubric. Even an unusual match would not, by itself, demonstrate remote viewing, psi, or machine consciousness. It would identify a result worth reproducing under stronger controls.

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
3. Create a run with only the envelope code, project scope, prompt version, and generation settings. The three starter scopes are a physical object, text written on paper, and the subject of a photograph; scopes can be managed in Settings. Review the exact system and user messages before starting. The global output token limit is configured in Settings and applies to generation and evaluation requests.
4. Wait for responses. Transient provider failures are retried automatically according to Settings; a manual retry replaces the failed item and increments its attempt number. Cancellation preserves completed responses.
5. Reveal the target with a description and optional JPEG, PNG, or WebP image (10 MB maximum).
6. Choose a structured-output evaluator; images also require vision support. Run evaluation and review correspondence scores, evidence, contradictions, and unverifiable claims.
7. Refine prompts by saving a new version. Re-evaluations and target corrections preserve previous evidence and results.

The prompt library shows only each prompt's latest version by default. Expand a prompt's history to inspect or branch from an older version. The complete starter catalog is an IDE-friendly TypeScript file at `apps/server/src/prompt-seeds.ts`; after editing it (and allowing the development server to restart), choose **Reset from seed file** in the prompt library to replace the catalog with fresh version 1 prompts. Existing runs retain their immutable request snapshots, but their links to deleted prompt versions are cleared.

The starter score is a qualitative **0–7 correspondence rating**, adapted from historical SRI descriptions. It is not a percentage or a statistical test. Seed categories are inspired by CRV sensory and dimensional descriptions. Prompts are editable; the structured evaluation response shape remains fixed in v1.

Sources: [SRI correspondence scale archive](https://sentinel-files.com/files/cia-rdp96-00789r003200200001-4-sf-2026-001038), [CRV Stage II manual](https://rviewer.com/introduction-to-the-controlled-coordinate-remote-viewing-manual/crv-stage-2-coordinate-controlled-remote-viewing-manual/).

## Data and tracing

All application records and image BLOBs live in `data/bench.sqlite`. SQLite uses WAL; stop the server before backing up the entire `data` directory. Credentials and local data are Git-ignored. Prompt versions, run payloads, generation attempts, reveals, evaluation batches, and results are persistent. Unfinished or scheduled requests become interrupted after restart; they are never automatically resubmitted after a restart.

Each inference uses a fresh OpenRouter conversation with separate, editable system and user prompt templates, and with no tools, search plugins, or browsing integration. Experiment templates support target-code and target-scope variables; evaluator user templates support target scope, description, and response variables. A global output limit defaults to 5,000 tokens and applies to all generation and evaluation requests. Online/search-oriented models, automatic routers, batch variants, and non-text output models are excluded. `provider.require_parameters` asks OpenRouter to route only to providers supporting the requested settings; unsupported settings fail visibly rather than silently disappearing. Target evidence enters only evaluator requests, and generation retries are disallowed after reveal.

The persistent job queue shares a configurable concurrency cap across generation, evaluation, and retry work. It defaults to three simultaneous LLM calls and can be set from 1 to 20 in Settings. Raising the cap immediately starts additional queued jobs; lowering it leaves in-flight calls alone and limits subsequent dispatches.

LangSmith receives full inference inputs and outputs, including target images for evaluation, with run/model/prompt metadata. Trace names begin with the target ID, and metadata includes the target ID and scope plus local run, job, attempt, batch, source-job, model, repetition, and prompt-version identifiers when applicable. The UI links to traces when available and shows tracing delivery errors without discarding model output. Traces expose app-level requests and responses, not provider-internal execution. No API credentials are intentionally included in payloads or trace metadata.

There is no durable trace-export queue. Transient provider errors (including rate limits and temporary server errors) can be retried automatically after a configurable delay and up to a configurable limit. The defaults are one retry after 10 seconds. Manual and automatic retries reuse the same list item, clear the failed response snapshot when the next attempt begins, and increment its attempt number. Cancellation can abort the local request, but a provider may still finish or bill it.

## Commands and layout

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm nuke
```

`pnpm nuke` deletes the active local database and recreates a blank workspace
with the starter scopes and prompts. It preserves `.env`, installed dependencies,
and database backup folders. Stop the development or production server before
running it.

- `apps/server`: local API, migrations, persistent queue, OpenRouter/LangSmith integration.
- `apps/web`: React interface and plain CSS.
- `packages/shared`: validation contracts, scoring schema, prompt renderer, and starter prompts.

The automated suite uses mocked inference and model discovery; it does not incur API charges. It covers the complete experiment workflow, version/evidence immutability, request separation, partial failure/retry, cancellation, restart recovery, structured scoring validation, and configuration boundaries.
