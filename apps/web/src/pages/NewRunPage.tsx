import type { ReactNode } from "react";
import type { NewRun } from "../hooks/useNewRun";
import { generateTargetCode } from "../lib/target-code";
import { promptOptions } from "../lib/prompt-options";
export function NewRunPage({
  newRun,
  modelPicker,
  busy,
}: {
  newRun: NewRun;
  modelPicker: ReactNode;
  busy: boolean;
}) {
  const {
    code,
    setCode,
    scopeId,
    setScopeId,
    promptId,
    setPromptId,
    scopes,
    selectedScope,
    experiments,
    selectedPrompt,
    promptPreview,
    prefs,
    setPrefs,
    config,
    startRun,
  } = newRun;
  return (
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
          <section className="panel form">
            <h2>
              <em>03</em> Run settings
            </h2>
            <div className="row run-setting-fields">
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
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="call-summary">
              <strong>
                {prefs.models.length * prefs.repetitions} inference calls
              </strong>
              <span>
                3 concurrent · {prefs.outputTokenLimit.toLocaleString()} token
                global output limit · tools & browsing disabled
              </span>
            </div>
            {(!config.openrouter || (config.tracing && !config.langsmith)) && (
              <p className="warning">
                Add API keys to the root .env file and restart before running.
              </p>
            )}
            <button
              className="primary full"
              disabled={
                busy || !code || !scopeId || !promptId || !prefs.models.length
              }
              onClick={startRun}
            >
              {busy ? "Please wait…" : "Start experiment →"}
            </button>
          </section>
        </div>
        <div>
          <section className="panel form prompt-preview-panel">
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
          </section>
        </div>
      </div>
    </>
  );
}
