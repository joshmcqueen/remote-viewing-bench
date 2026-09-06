import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  experimentMessages,
  eligibleModel,
  type Model,
  type Preferences,
} from "@rv/shared";
import "./style.css";
async function api(path: string, body?: unknown, method?: string) {
  const r = await fetch(`/api${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
const date = (s: string) =>
  new Date(s.includes("T") ? s : s + "Z").toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const status = (s: string) => (
  <span className={`status ${s.replaceAll(" ", "-")}`}>
    <i />
    {s}
  </span>
);
function generateTargetCode() {
  const digits = Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, "0");
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}
function App() {
  const [view, setView] = useState("Runs"),
    [runs, setRuns] = useState<any[]>([]),
    [prompts, setPrompts] = useState<any[]>([]),
    [scopes, setScopes] = useState<any[]>([]),
    [models, setModels] = useState<Model[]>([]),
    [config, setConfig] = useState<any>({}),
    [prefs, setPrefs] = useState<Preferences>({
      models: [],
      repetitions: 1,
      temperature: null,
      maxTokens: 2048,
      evaluatorModel: "",
    });
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<any>(null),
    [search, setSearch] = useState("");
  const [code, setCode] = useState(generateTargetCode),
    [scopeId, setScopeId] = useState(0),
    [promptId, setPromptId] = useState(0);
  const [editing, setEditing] = useState<any>(null),
    [editingScope, setEditingScope] = useState<any>(null),
    [description, setDescription] = useState(""),
    [image, setImage] = useState<string | null>(null),
    [evalPrompt, setEvalPrompt] = useState(0),
    [evalModel, setEvalModel] = useState("");
  const [batch, setBatch] = useState<number | null>(null),
    [promptNameStatus, setPromptNameStatus] = useState<{
      id: number;
      name: string;
      state: "saving" | "saved";
    } | null>(null);
  async function refresh() {
    const [r, p, q, m, c, s] = await Promise.all([
      api("/runs"),
      api("/prompts"),
      api("/scopes"),
      api("/models"),
      api("/config"),
      api("/settings"),
    ]);
    setRuns(r);
    setPrompts(p);
    setScopes(q);
    setModels(m.models);
    setConfig(c);
    setPrefs(s);
    setEvalModel(s.evaluatorModel);
    setPromptId(
      (x) => x || p.find((x: any) => x.kind === "experiment")?.versionId || 0,
    );
    setEvalPrompt(
      (x) => x || p.find((x: any) => x.kind === "evaluator")?.versionId || 0,
    );
    setScopeId((x) =>
      q.some((scope: any) => scope.id === x) ? x : q[0]?.id || 0,
    );
  }
  async function reloadScopes(preferredId?: number) {
    const next = await api("/scopes");
    setScopes(next);
    setScopeId((current) => {
      const wanted = preferredId ?? current;
      return next.some((scope: any) => scope.id === wanted)
        ? wanted
        : next[0]?.id || 0;
    });
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      api("/runs")
        .then(setRuns)
        .catch(() => {});
      if (detail)
        api(`/runs/${detail.id}`)
          .then(setDetail)
          .catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [detail?.id]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id: number) {
    const d = await api(`/runs/${id}`);
    setDetail(d);
    setDescription(d.reveal?.description || "");
    setImage(d.reveal?.image || null);
    setBatch(null);
    setView("Runs");
  }
  function navigate(v: string) {
    setView(v);
    setDetail(null);
    setError("");
    setNotice("");
  }
  async function savePrefs() {
    await api("/settings", prefs, "PUT");
    setNotice("Preferences saved.");
  }
  async function savePromptName(id: number, rawName: string) {
    const original = prompts.find((prompt) => prompt.id === id)?.name || "";
    const name = rawName.trim();
    if (!name) {
      setEditing((current: any) =>
        current?.id === id ? { ...current, name: original } : current,
      );
      setPromptNameStatus(null);
      setError("Prompt name cannot be empty.");
      return;
    }
    if (name === original) {
      setEditing((current: any) =>
        current?.id === id ? { ...current, name } : current,
      );
      return;
    }
    setPromptNameStatus({ id, name, state: "saving" });
    setError("");
    try {
      const renamed = await api(`/prompts/${id}`, { name }, "PATCH");
      setPrompts((current) =>
        current.map((prompt) =>
          prompt.id === id ? { ...prompt, name: renamed.name } : prompt,
        ),
      );
      setEditing((current: any) =>
        current?.id === id && current.name.trim() === name
          ? { ...current, name: renamed.name }
          : current,
      );
      setPromptNameStatus((current) =>
        current?.id === id && current.name === name
          ? { ...current, state: "saved" }
          : current,
      );
    } catch (e) {
      setEditing((current: any) =>
        current?.id === id && current.name.trim() === name
          ? { ...current, name: original }
          : current,
      );
      setPromptNameStatus((current) =>
        current?.id === id && current.name === name ? null : current,
      );
      setError((e as Error).message);
    }
  }
  const experiments = prompts.filter((p) => p.kind === "experiment"),
    evaluators = prompts.filter((p) => p.kind === "evaluator");
  const selectedPrompt = prompts.find((p) => p.versionId === promptId);
  const selectedScope = scopes.find((scope) => scope.id === scopeId);
  const promptPreview = selectedPrompt
    ? experimentMessages(
        selectedPrompt.systemContent,
        selectedPrompt.userContent,
        code || "[target code]",
        selectedScope?.description || "[project scope]",
      )
    : [];
  const generationJobs =
    detail?.jobs.filter((j: any) => j.kind === "generation") || [];
  const activeGeneration = generationJobs.some((j: any) =>
    ["running", "queued"].includes(j.status),
  );
  const selectedBatch = batch ?? detail?.batches[0]?.id;
  const evaluationJobs =
    detail?.jobs.filter((j: any) => j.batch_id === selectedBatch) || [];
  const compatible = models.filter(
    (m) =>
      m.supported_parameters.includes("structured_outputs") &&
      (!detail?.reveal?.image ||
        m.architecture?.input_modalities?.includes("image")) &&
      eligibleModel(m),
  );
  const modelPicker = (
    <>
      <div className="row">
        <input
          aria-label="Search models"
          placeholder="Search models or providers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          disabled={busy}
          onClick={() =>
            action(async () => {
              const m = await api("/models/refresh", {});
              setModels(m.models);
              setNotice("Model catalog refreshed.");
            })
          }
        >
          ↻ Refresh
        </button>
      </div>
      <div className="model-list">
        {models
          .filter(
            (m) =>
              eligibleModel(m) &&
              (m.name + " " + m.id)
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .map((m) => (
            <label className="model" key={m.id}>
              <input
                type="checkbox"
                checked={prefs.models.includes(m.id)}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    models: e.target.checked
                      ? [...prefs.models, m.id]
                      : prefs.models.filter((x) => x !== m.id),
                  })
                }
              />
              <span>
                {m.name}
                <small>{m.id}</small>
              </span>
            </label>
          ))}
        {!models.length && (
          <p className="muted">
            Refresh the OpenRouter catalog to choose models.
          </p>
        )}
      </div>
      <small>
        {prefs.models.length} selected · selection saved when you start a run
      </small>
    </>
  );
  const promptOptions = (ps: any[]) =>
    ps.map((p) => (
      <option key={p.versionId} value={p.versionId}>
        {p.name} · v{p.version}
      </option>
    ));
  const retry = (j: any) => (
    <button
      disabled={busy}
      onClick={() =>
        action(async () => {
          await api(`/jobs/${j.id}/retry`, {});
          setDetail(await api(`/runs/${detail.id}`));
        })
      }
    >
      Retry as new attempt
    </button>
  );
  function jobFooter(j: any) {
    return (
      <>
        <div className="row meta">
          <span>
            Attempt {j.attempt} · {date(j.created_at)}
          </span>
          {j.trace_url && (
            <a href={j.trace_url} target="_blank" rel="noreferrer">
              View LangSmith trace ↗
            </a>
          )}
        </div>
        {j.trace_error && <p className="warning">Trace: {j.trace_error}</p>}
        {j.error && <p className="error-text">{j.error}</p>}
        {["error", "interrupted", "cancelled"].includes(j.status) &&
          (j.kind === "evaluation" || !detail.reveal) &&
          retry(j)}
        <details>
          <summary>Request & response snapshot</summary>
          <pre>
            {JSON.stringify(
              { request: j.payload, response: j.response },
              null,
              2,
            )}
          </pre>
        </details>
      </>
    );
  }
  return (
    <div className="shell">
      <aside>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Runs");
          }}
        >
          <span className="brand-icon">◉</span> fieldnotes
          <span className="brand-dot">.</span>
        </a>
        <div className="eyebrow side-label">REMOTE VIEWING BENCH</div>
        <nav>
          {["Runs", "New Run", "Prompts", "Settings"].map((v, i) => (
            <button
              className={view === v ? "nav active" : "nav"}
              key={v}
              onClick={() => navigate(v)}
            >
              <span>{["▦", "＋", "≡", "⚙"][i]}</span>
              {v}
              {v === "Runs" && <small>{runs.length}</small>}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <span className="local-dot" /> Local workspace
          <small>
            OpenRouter inference
            <br />
            LangSmith tracing
          </small>
          <div className="version">EXPERIMENTAL · V1.0</div>
        </div>
      </aside>
      <main>
        <div className="topline">
          <span>PERSONAL RESEARCH / FIELDNOTES</span>
          <span>
            <i className="local-dot" /> localhost
          </span>
        </div>
        {error && (
          <div role="alert" className="banner error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {notice && (
          <div role="status" className="banner">
            {notice}
          </div>
        )}
        {view === "Runs" && !detail && (
          <>
            <header>
              <div>
                <div className="eyebrow">YOUR EXPERIMENT LOG</div>
                <h1>
                  Run history<span className="accent">.</span>
                </h1>
                <p>A record of impressions, targets, and correspondence.</p>
              </div>
              <button className="primary" onClick={() => navigate("New Run")}>
                ＋ New run
              </button>
            </header>
            <div className="stats">
              <div>
                <span>Total runs</span>
                <strong>{runs.length.toString().padStart(2, "0")}</strong>
              </div>
              <div>
                <span>In progress</span>
                <strong>
                  {runs
                    .filter((r) => r.status === "running")
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
              </div>
              <div>
                <span>Models selected</span>
                <strong>
                  {prefs.models.length.toString().padStart(2, "0")}
                </strong>
              </div>
            </div>
            <section className="panel">
              <div className="panel-heading">
                <h2>Experiments</h2>
                <span className="muted">Most recent first</span>
              </div>
              {!runs.length ? (
                <div className="empty">
                  <div className="envelope">◇</div>
                  <h2>Every experiment starts with a code.</h2>
                  <p>
                    Prepare your target, choose your models,
                    <br />
                    and capture their first impressions.
                  </p>
                  <button
                    className="primary"
                    onClick={() => navigate("New Run")}
                  >
                    Create your first run →
                  </button>
                </div>
              ) : (
                <div className="run-table">
                  <div className="table-head">
                    <span>ENVELOPE / TARGET</span>
                    <span>MODELS</span>
                    <span>CREATED</span>
                    <span>STATUS</span>
                  </div>
                  {runs.map((r) => (
                    <button
                      className="run-row"
                      key={r.id}
                      onClick={() => action(() => open(r.id))}
                    >
                      <span>
                        <b>{r.code}</b>
                        <small>
                          #{String(r.id).padStart(3, "0")} · {r.scope_name}
                        </small>
                      </span>
                      <span>
                        {r.settings.models.length} models{" "}
                        <small>{r.settings.repetitions} repetition(s)</small>
                      </span>
                      <span>{date(r.created_at)}</span>
                      {status(r.status)}
                    </button>
                  ))}
                </div>
              )}
            </section>
            <p className="footnote">
              Observe carefully. Keep the record. Let the experiments evolve.
            </p>
          </>
        )}
        {view === "New Run" && (
          <>
            <header>
              <div>
                <div className="eyebrow">SET UP AN EXPERIMENT</div>
                <h1>
                  New run<span className="accent">.</span>
                </h1>
                <p>One target. One prompt. Independent impressions.</p>
              </div>
            </header>
            <div className="columns">
              <div>
                <section className="panel form">
                  <h2>
                    <em>01</em> Target & prompt
                  </h2>
                  <label htmlFor="target-code">Target code</label>
                  <div className="row">
                    <input
                      id="target-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. 4827-1936"
                    />
                    <button
                      type="button"
                      onClick={() => setCode(generateTargetCode())}
                    >
                      {code ? "↻ Regenerate" : "Generate"}
                    </button>
                  </div>
                  <p className="muted">
                    A random code is pre-filled. Edit it or generate another.
                  </p>
                  <label>
                    Project scope
                    <select
                      value={scopeId}
                      onChange={(e) => setScopeId(Number(e.target.value))}
                    >
                      {!scopes.length && (
                        <option value="">No scopes available</option>
                      )}
                      {scopes.map((scope) => (
                        <option key={scope.id} value={scope.id}>
                          {scope.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedScope && (
                    <p className="muted">{selectedScope.description}</p>
                  )}
                  <label>
                    Experiment prompt
                    <select
                      value={promptId}
                      onChange={(e) => setPromptId(Number(e.target.value))}
                    >
                      {promptOptions(experiments)}
                    </select>
                  </label>
                  <p className="muted">
                    Add the target description and photo after the responses are
                    recorded.
                  </p>
                </section>
                <section className="panel form">
                  <h2>
                    <em>02</em> Models
                  </h2>
                  {modelPicker}
                </section>
              </div>
              <div>
                <section className="panel form">
                  <h2>Prompt preview</h2>
                  <pre className="preview">
                    {selectedPrompt
                      ? promptPreview
                          .map(
                            (message) =>
                              `${message.role.toUpperCase()}\n${message.content}`,
                          )
                          .join("\n\n")
                      : "Create an experiment prompt first."}
                  </pre>
                  <div className="divider" />
                  <div className="row">
                    <label>
                      Repetitions
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={prefs.repetitions}
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            repetitions: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Output limit
                      <input
                        type="number"
                        min="128"
                        max="32000"
                        value={prefs.maxTokens}
                        onChange={(e) =>
                          setPrefs({
                            ...prefs,
                            maxTokens: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Temperature
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      placeholder="Provider default"
                      value={prefs.temperature ?? ""}
                      onChange={(e) =>
                        setPrefs({
                          ...prefs,
                          temperature:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <div className="call-summary">
                    <strong>
                      {prefs.models.length * prefs.repetitions} inference calls
                    </strong>
                    <span>3 concurrent · tools & browsing disabled</span>
                  </div>
                  {(!config.openrouter ||
                    (config.tracing && !config.langsmith)) && (
                    <p className="warning">
                      Add API keys to the root .env file and restart before
                      running.
                    </p>
                  )}
                  <button
                    className="primary full"
                    disabled={
                      busy ||
                      !code ||
                      !scopeId ||
                      !promptId ||
                      !prefs.models.length
                    }
                    onClick={() =>
                      action(async () => {
                        const r = await api("/runs", {
                          ...prefs,
                          code,
                          scopeId,
                          promptVersionId: promptId,
                        });
                        setCode(generateTargetCode());
                        await open(r.id);
                        setRuns(await api("/runs"));
                      })
                    }
                  >
                    {busy ? "Please wait…" : "Start experiment →"}
                  </button>
                </section>
              </div>
            </div>
          </>
        )}
        {view === "Prompts" && (
          <>
            <header>
              <div>
                <div className="eyebrow">EVOLVE YOUR METHOD</div>
                <h1>
                  Prompt library<span className="accent">.</span>
                </h1>
                <p>Versioned prompt pairs. Reproducible experiments.</p>
              </div>
              <button
                className="primary"
                onClick={() => {
                  setPromptNameStatus(null);
                  setEditing({
                    name: "",
                    kind: "experiment",
                    systemContent: "",
                    userContent: "",
                  });
                }}
              >
                ＋ New prompt
              </button>
            </header>
            <div className="columns">
              <section className="panel form">
                <h2>Saved versions</h2>
                {prompts.map((p) => (
                  <button
                    key={p.versionId}
                    className={
                      "prompt-item " +
                      (editing?.versionId === p.versionId ? "chosen" : "")
                    }
                    onClick={() => {
                      setPromptNameStatus(null);
                      setEditing({ ...p });
                    }}
                  >
                    <div>
                      <b>{p.name}</b>
                      <small>
                        {p.kind} · {date(p.created_at)}
                      </small>
                    </div>
                    <span className="pill">v{p.version}</span>
                  </button>
                ))}
              </section>
              <section className="panel form">
                <h2>{editing?.id ? "Create next version" : "Prompt editor"}</h2>
                {editing ? (
                  <>
                    <label>
                      <span className="prompt-name-label">
                        <span>Name</span>
                        {editing.id && promptNameStatus?.id === editing.id && (
                          <small role="status">
                            {promptNameStatus?.state === "saving"
                              ? "Saving…"
                              : "Saved"}
                          </small>
                        )}
                      </span>
                      <input
                        value={editing.name}
                        maxLength={120}
                        onChange={(e) => {
                          setPromptNameStatus(null);
                          setEditing({ ...editing, name: e.target.value });
                        }}
                        onBlur={(e) => {
                          if (editing.id)
                            void savePromptName(
                              editing.id,
                              e.currentTarget.value,
                            );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                          if (e.key === "Escape" && editing.id) {
                            e.preventDefault();
                            const original =
                              prompts.find((p) => p.id === editing.id)?.name ||
                              "";
                            e.currentTarget.value = original;
                            setEditing({ ...editing, name: original });
                            setPromptNameStatus(null);
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </label>
                    <label>
                      Purpose
                      <select
                        disabled={!!editing.id}
                        value={editing.kind}
                        onChange={(e) =>
                          setEditing({ ...editing, kind: e.target.value })
                        }
                      >
                        <option value="experiment">Experiment</option>
                        <option value="evaluator">Evaluator</option>
                      </select>
                    </label>
                    <label>
                      System instructions
                      <textarea
                        rows={12}
                        value={editing.systemContent}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            systemContent: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      User prompt
                      <textarea
                        rows={7}
                        value={editing.userContent}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            userContent: e.target.value,
                          })
                        }
                      />
                    </label>
                    <p className="muted">
                      {editing.kind === "experiment"
                        ? `Available in both messages: {{target_code}} and {{target_scope}}.`
                        : `Available in the user prompt: {{target_scope}}, {{target_description}}, and {{response}}.`}{" "}
                      Saving preserves every existing version.
                    </p>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          await api(
                            editing.id
                              ? `/prompts/${editing.id}/versions`
                              : "/prompts",
                            editing,
                          );
                          setPrompts(await api("/prompts"));
                          setNotice("New prompt version saved.");
                          setPromptNameStatus(null);
                          setEditing(null);
                        })
                      }
                    >
                      Save {editing.id ? "new version" : "prompt"}
                    </button>
                  </>
                ) : (
                  <p className="muted">
                    Select a version to inspect or evolve it.
                  </p>
                )}
              </section>
            </div>
          </>
        )}
        {view === "Settings" && (
          <>
            <header>
              <div>
                <div className="eyebrow">LOCAL WORKSPACE</div>
                <h1>
                  Settings<span className="accent">.</span>
                </h1>
                <p>Your connections and experiment defaults.</p>
              </div>
            </header>
            <div className="columns">
              <section className="panel form">
                <h2>Connections</h2>
                <div className="connection">
                  <div>
                    <b>OpenRouter</b>
                    <small>All model inference</small>
                  </div>
                  {status(config.openrouter ? "configured" : "missing")}
                </div>
                <div className="connection">
                  <div>
                    <b>LangSmith</b>
                    <small>Request and response tracing</small>
                  </div>
                  {status(
                    config.tracing
                      ? config.langsmith
                        ? "configured"
                        : "missing"
                      : "disabled",
                  )}
                </div>
                <p>
                  Set your keys in the project’s root <code>.env</code> file,
                  then restart the server.
                </p>
                <pre className="preview">
                  OPENROUTER_API_KEY=…{"\n"}LANGSMITH_API_KEY=…{"\n"}
                  LANGSMITH_TRACING=true{"\n"}
                  LANGSMITH_PROJECT=remote-view-bench
                </pre>
                <p className="muted">
                  Keys stay on the server. LangSmith receives experiment
                  prompts, target evidence, and responses when tracing is
                  enabled.
                </p>
                <p className="muted">
                  Traces document app requests and responses; provider internals
                  are outside their visibility.
                </p>
              </section>
              <section className="panel form">
                <h2>Default model selection</h2>
                {modelPicker}
                <label>
                  Preferred evaluator
                  <select
                    value={prefs.evaluatorModel}
                    onChange={(e) => {
                      setPrefs({ ...prefs, evaluatorModel: e.target.value });
                      setEvalModel(e.target.value);
                    }}
                  >
                    <option value="">Choose an evaluator</option>
                    {models
                      .filter(
                        (m) =>
                          m.supported_parameters.includes(
                            "structured_outputs",
                          ) && eligibleModel(m),
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => action(savePrefs)}
                >
                  Save preferences
                </button>
              </section>
            </div>
            <section className="panel form scope-manager">
              <div className="row spread">
                <div>
                  <h2>Project scopes</h2>
                  <p className="muted">
                    One scope is selected for each remote-viewing envelope.
                  </p>
                </div>
                <button
                  onClick={() => setEditingScope({ name: "", description: "" })}
                >
                  ＋ Add scope
                </button>
              </div>
              <div className="scope-list">
                {scopes.map((scope) => (
                  <div className="scope-item" key={scope.id}>
                    <div>
                      <b>{scope.name}</b>
                      <small>{scope.description}</small>
                    </div>
                    <div className="row">
                      <button onClick={() => setEditingScope({ ...scope })}>
                        Edit
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Delete the “${scope.name}” scope? Historical runs will keep their saved scope.`,
                            )
                          )
                            return;
                          action(async () => {
                            await api(
                              `/scopes/${scope.id}`,
                              undefined,
                              "DELETE",
                            );
                            await reloadScopes();
                            if (editingScope?.id === scope.id)
                              setEditingScope(null);
                            setNotice("Project scope deleted.");
                          });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {!scopes.length && (
                  <p className="muted">Add a scope before creating a run.</p>
                )}
              </div>
              {editingScope && (
                <div className="scope-editor">
                  <h3>{editingScope.id ? "Edit scope" : "New scope"}</h3>
                  <label>
                    Name
                    <input
                      maxLength={120}
                      value={editingScope.name}
                      onChange={(e) =>
                        setEditingScope({
                          ...editingScope,
                          name: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Prompt description
                    <textarea
                      rows={4}
                      maxLength={1000}
                      value={editingScope.description}
                      onChange={(e) =>
                        setEditingScope({
                          ...editingScope,
                          description: e.target.value,
                        })
                      }
                    />
                  </label>
                  <p className="muted">
                    This description replaces {"{{target_scope}}"} in experiment
                    prompts.
                  </p>
                  <div className="row">
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        !editingScope.name.trim() ||
                        !editingScope.description.trim()
                      }
                      onClick={() =>
                        action(async () => {
                          const saved = await api(
                            editingScope.id
                              ? `/scopes/${editingScope.id}`
                              : "/scopes",
                            {
                              name: editingScope.name,
                              description: editingScope.description,
                            },
                            editingScope.id ? "PATCH" : "POST",
                          );
                          await reloadScopes(saved.id);
                          setEditingScope(null);
                          setNotice(
                            editingScope.id
                              ? "Project scope updated."
                              : "Project scope added.",
                          );
                        })
                      }
                    >
                      {editingScope.id ? "Save changes" : "Add scope"}
                    </button>
                    <button onClick={() => setEditingScope(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
        {view === "Runs" && detail && (
          <>
            <button className="back" onClick={() => setDetail(null)}>
              ← All experiments
            </button>
            <header>
              <div>
                <div className="eyebrow">
                  EXPERIMENT #{String(detail.id).padStart(3, "0")}
                </div>
                <h1>
                  {detail.code}
                  <span className="accent">.</span>
                </h1>
                <p>
                  {detail.scope_name} · {date(detail.created_at)}
                </p>
              </div>
              <div className="row">
                {status(detail.status)}
                {detail.status === "running" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        await api(`/runs/${detail.id}/cancel`, {});
                        setDetail(await api(`/runs/${detail.id}`));
                      })
                    }
                  >
                    Cancel work
                  </button>
                )}
              </div>
            </header>
            <div className="columns detail-columns">
              <div>
                <section className="panel form">
                  <h2>
                    Recorded impressions{" "}
                    <span className="pill">{generationJobs.length}</span>
                  </h2>
                  <details>
                    <summary>
                      Shared messages · prompt version #
                      {detail.prompt_version_id}
                    </summary>
                    <pre>
                      {detail.messages
                        .map(
                          (message: any) =>
                            `${message.role.toUpperCase()}\n${message.content}`,
                        )
                        .join("\n\n")}
                    </pre>
                  </details>
                  {generationJobs.map((j: any) => (
                    <article className="job" key={j.id}>
                      <div className="row spread">
                        <h3>
                          {j.model}
                          <small>Repetition {j.repetition}</small>
                        </h3>
                        {status(j.status)}
                      </div>
                      {j.response?.choices?.[0]?.message?.content ? (
                        <pre className="response">
                          {j.response.choices[0].message.content}
                        </pre>
                      ) : (
                        <p className="muted">
                          {j.status === "running"
                            ? "Awaiting model response…"
                            : j.status === "queued"
                              ? "Waiting in queue…"
                              : "No text response recorded."}
                        </p>
                      )}
                      {jobFooter(j)}
                    </article>
                  ))}
                </section>
                <section className="panel form">
                  <div className="row spread">
                    <h2>Evaluations</h2>
                    {detail.batches.length > 0 && (
                      <select
                        aria-label="Evaluation batch"
                        value={selectedBatch}
                        onChange={(e) => setBatch(Number(e.target.value))}
                      >
                        {detail.batches.map((b: any) => (
                          <option key={b.id} value={b.id}>
                            Batch {b.id} · {b.model}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {detail.batches.find((b: any) => b.id === selectedBatch) && (
                    <details>
                      <summary>Target evidence used for this batch</summary>
                      <p>
                        {
                          detail.batches.find(
                            (b: any) => b.id === selectedBatch,
                          ).reveal.description
                        }
                      </p>
                      {detail.batches.find((b: any) => b.id === selectedBatch)
                        .reveal.image && (
                        <img
                          className="target-image"
                          alt="Evaluation target snapshot"
                          src={
                            detail.batches.find(
                              (b: any) => b.id === selectedBatch,
                            ).reveal.image
                          }
                        />
                      )}
                    </details>
                  )}
                  {!evaluationJobs.length && (
                    <p className="muted">
                      Reveal the target and choose an evaluator to compare the
                      impressions.
                    </p>
                  )}
                  {evaluationJobs.map((j: any) => (
                    <article className="job" key={j.id}>
                      <div className="row spread">
                        <h3>
                          {
                            generationJobs.find(
                              (g: any) => g.id === j.source_id,
                            )?.model
                          }
                          <small>
                            Response #{j.source_id} · judged by {j.model}
                          </small>
                        </h3>
                        {j.result ? (
                          <span className="score">
                            {j.result.score}
                            <small>/ 7</small>
                          </span>
                        ) : (
                          status(j.status)
                        )}
                      </div>
                      {j.result && (
                        <>
                          <p>{j.result.rationale}</p>
                          {j.result.observations.map((o: any, i: number) => (
                            <div className="observation" key={i}>
                              <div className="row spread">
                                <b>{o.attribute}</b>
                                <span className={`verdict ${o.verdict}`}>
                                  {o.verdict}
                                </span>
                              </div>
                              <blockquote>{o.responseEvidence}</blockquote>
                              <p>
                                <b>Target:</b> {o.targetEvidence}
                              </p>
                              <p>{o.explanation}</p>
                            </div>
                          ))}
                        </>
                      )}
                      {jobFooter(j)}
                    </article>
                  ))}
                </section>
              </div>
              <div>
                <section className="panel form">
                  <h2>Target reveal</h2>
                  <label>
                    Description
                    <textarea
                      rows={5}
                      disabled={activeGeneration}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the actual target…"
                    />
                  </label>
                  <label>
                    Optional target photo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={activeGeneration}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 10 * 1024 * 1024) {
                          setError("Maximum image size is 10 MB");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => setImage(reader.result as string);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {image && (
                    <>
                      <img
                        className="target-image"
                        src={image}
                        alt="Target evidence"
                      />
                      <button
                        disabled={activeGeneration}
                        onClick={() => setImage(null)}
                      >
                        Remove image
                      </button>
                    </>
                  )}
                  <p className="muted">
                    {activeGeneration
                      ? "Available when all generation requests have ended."
                      : "Corrections are saved separately. Earlier evaluation evidence remains intact."}
                  </p>
                  <button
                    disabled={busy || activeGeneration || !description.trim()}
                    onClick={() =>
                      action(async () => {
                        await api(`/runs/${detail.id}/reveal`, {
                          description,
                          image,
                        });
                        setDetail(await api(`/runs/${detail.id}`));
                        setNotice("Target reveal saved.");
                      })
                    }
                  >
                    {detail.reveal
                      ? "Save target correction"
                      : "Save target reveal"}
                  </button>
                </section>
                <section className="panel form">
                  <h2>Evaluate responses</h2>
                  <label>
                    Evaluator
                    <select
                      value={evalModel}
                      onChange={(e) => setEvalModel(e.target.value)}
                    >
                      <option value="">Select a compatible model</option>
                      {compatible.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Rubric version
                    <select
                      value={evalPrompt}
                      onChange={(e) => setEvalPrompt(Number(e.target.value))}
                    >
                      {promptOptions(evaluators)}
                    </select>
                  </label>
                  <p className="muted">
                    0–7 correspondence · model identity withheld from judge
                    {detail.reveal?.image ? " · vision required" : ""}
                  </p>
                  <button
                    className="primary full"
                    disabled={
                      busy ||
                      detail.status === "running" ||
                      !detail.reveal ||
                      !compatible.some((m) => m.id === evalModel)
                    }
                    onClick={() =>
                      action(async () => {
                        await api(`/runs/${detail.id}/evaluate`, {
                          model: evalModel,
                          promptVersionId: evalPrompt,
                        });
                        await api(
                          "/settings",
                          { ...prefs, evaluatorModel: evalModel },
                          "PUT",
                        );
                        setDetail(await api(`/runs/${detail.id}`));
                        setBatch(null);
                      })
                    }
                  >
                    Start evaluation →
                  </button>
                </section>
              </div>
            </div>
          </>
        )}
        <footer>
          FIELDNOTES <span>REMOTE VIEWING BENCH · LOCAL FIRST</span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
