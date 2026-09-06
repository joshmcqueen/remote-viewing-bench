import type { ReactNode } from "react";
import { eligibleModel } from "@rv/shared";
import { StatusBadge } from "../components/StatusBadge";
import type { ScopeEditor } from "../hooks/useScopeEditor";
import type { Workspace } from "../hooks/useWorkspace";
export function SettingsPage({
  workspace,
  editor,
  modelPicker,
  busy,
}: {
  workspace: Pick<
    Workspace,
    | "config"
    | "prefs"
    | "models"
    | "scopes"
    | "savePrefs"
    | "setPrefs"
    | "selectPreferredEvaluator"
  >;
  editor: ScopeEditor;
  modelPicker: ReactNode;
  busy: boolean;
}) {
  const {
    config,
    prefs,
    setPrefs,
    models,
    scopes,
    savePrefs,
    selectPreferredEvaluator,
  } = workspace;
  const { editingScope, setEditingScope, deleteScope, saveScope } = editor;
  return (
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
      <div className="settings-sections">
        <section className="panel settings-section">
          <div className="settings-section-heading">
            <div>
              <h2>Connections</h2>
              <p>Services used for inference and experiment tracing.</p>
            </div>
          </div>
          <div className="settings-section-body">
            <div className="connection-grid">
              <div className="connection">
                <div>
                  <b>OpenRouter</b>
                  <small>All model inference</small>
                </div>
                {
                  <StatusBadge
                    status={config.openrouter ? "configured" : "missing"}
                  />
                }
              </div>
              <div className="connection">
                <div>
                  <b>LangSmith</b>
                  <small>Request and response tracing</small>
                </div>
                {
                  <StatusBadge
                    status={
                      config.tracing
                        ? config.langsmith
                          ? "configured"
                          : "missing"
                        : "disabled"
                    }
                  />
                }
              </div>
            </div>
            <div className="connection-setup">
              <div>
                <h3>Environment setup</h3>
                <p>
                  Set your keys in the project’s root <code>.env</code> file,
                  then restart the server.
                </p>
                <p className="muted">
                  Keys stay on the server. LangSmith receives experiment
                  prompts, target evidence, and responses when tracing is
                  enabled.
                </p>
                <p className="muted">
                  Traces document app requests and responses; provider internals
                  are outside their visibility.
                </p>
              </div>
              <pre className="preview">
                OPENROUTER_API_KEY=…{"\n"}LANGSMITH_API_KEY=…{"\n"}
                LANGSMITH_TRACING=true{"\n"}
                LANGSMITH_PROJECT=remote-view-bench
              </pre>
            </div>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="settings-section-heading">
            <div>
              <h2>Default model selection</h2>
              <p>Choose the models used for new experiment runs.</p>
            </div>
          </div>
          <div className="settings-section-body model-settings-grid">
            <div className="model-picker-area">{modelPicker}</div>
            <div className="preference-aside">
              <div className="eyebrow">EVALUATION</div>
              <h3>Preferred evaluator</h3>
              <p className="muted">
                Select the structured-output model used to score responses.
              </p>
              <label className="settings-field">
                <span>Evaluator model</span>
                <select
                  value={prefs.evaluatorModel}
                  onChange={(e) => selectPreferredEvaluator(e.target.value)}
                >
                  <option value="">Choose an evaluator</option>
                  {models
                    .filter(
                      (m) =>
                        m.supported_parameters.includes("structured_outputs") &&
                        eligibleModel(m),
                    )
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="settings-section-heading">
            <div>
              <h2>Inference defaults</h2>
              <p>Set limits and control how provider errors are handled.</p>
            </div>
          </div>
          <div className="settings-section-body">
            <label className="settings-field compact-settings-field">
              <span>Global output token limit</span>
              <input
                type="number"
                min="128"
                max="32000"
                value={prefs.outputTokenLimit}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    outputTokenLimit: Number(e.target.value),
                  })
                }
              />
              <small>
                Applied to every new generation and evaluation request.
              </small>
            </label>
            <div className="divider" />
            <label className="retry-toggle">
              <input
                type="checkbox"
                checked={prefs.autoRetry}
                onChange={(e) =>
                  setPrefs({ ...prefs, autoRetry: e.target.checked })
                }
              />
              <span>
                Retry transient provider errors
                <small>
                  Includes rate limits (429) and temporary 5xx errors.
                </small>
              </span>
            </label>
            <div className="retry-options">
              <label className="settings-field">
                <span>Delay (seconds)</span>
                <input
                  type="number"
                  min="1"
                  max="300"
                  disabled={!prefs.autoRetry}
                  value={prefs.autoRetryDelaySeconds}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      autoRetryDelaySeconds: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="settings-field">
                <span>Maximum retries</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  disabled={!prefs.autoRetry}
                  value={prefs.autoRetryMaxRetries}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      autoRetryMaxRetries: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="settings-actions">
              <p className="muted">
                Saves model choices, evaluator, output limit, and retry
                defaults. Runs keep their own historical generation snapshot.
              </p>
              <button className="primary" disabled={busy} onClick={savePrefs}>
                Save preferences
              </button>
            </div>
          </div>
        </section>
        <section className="panel settings-section scope-manager">
          <div className="settings-section-heading">
            <div>
              <h2>Project scopes</h2>
              <p>Define what a remote-viewing target may contain.</p>
            </div>
            <button
              onClick={() => setEditingScope({ name: "", description: "" })}
            >
              ＋ Add scope
            </button>
          </div>
          <div className="settings-section-body">
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
                      onClick={() => deleteScope(scope)}
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
                    onClick={saveScope}
                  >
                    {editingScope.id ? "Save changes" : "Add scope"}
                  </button>
                  <button onClick={() => setEditingScope(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
