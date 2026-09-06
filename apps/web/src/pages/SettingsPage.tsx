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
    | "selectPreferredEvaluator"
  >;
  editor: ScopeEditor;
  modelPicker: ReactNode;
  busy: boolean;
}) {
  const { config, prefs, models, scopes, savePrefs, selectPreferredEvaluator } =
    workspace;
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
      <div className="columns">
        <section className="panel form">
          <h2>Connections</h2>
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
          <p>
            Set your keys in the project’s root <code>.env</code> file, then
            restart the server.
          </p>
          <pre className="preview">
            OPENROUTER_API_KEY=…{"\n"}LANGSMITH_API_KEY=…{"\n"}
            LANGSMITH_TRACING=true{"\n"}
            LANGSMITH_PROJECT=remote-view-bench
          </pre>
          <p className="muted">
            Keys stay on the server. LangSmith receives experiment prompts,
            target evidence, and responses when tracing is enabled.
          </p>
          <p className="muted">
            Traces document app requests and responses; provider internals are
            outside their visibility.
          </p>
        </section>
        <section className="panel form">
          <h2>Default model selection</h2>
          {modelPicker}
          <label>
            Preferred evaluator
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
          <button className="primary" disabled={busy} onClick={savePrefs}>
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
                <button className="danger" onClick={() => deleteScope(scope)}>
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
      </section>
    </>
  );
}
