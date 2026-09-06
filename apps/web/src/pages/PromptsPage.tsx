import type { PromptEditor } from "../hooks/usePromptEditor";
import { date } from "../lib/format";
export function PromptsPage({
  editor,
  busy,
}: {
  editor: PromptEditor;
  busy: boolean;
}) {
  const {
    prompts,
    latestPrompts,
    historyPromptId,
    setHistoryPromptId,
    editing,
    setEditing,
    promptNameStatus,
    setPromptNameStatus,
    savePromptName,
    savePrompt,
    resetPrompts,
  } = editor;
  return (
    <>
      <header>
        <div>
          <div className="eyebrow">EVOLVE YOUR METHOD</div>
          <h1>
            Prompt library<span className="accent">.</span>
          </h1>
          <p>Versioned prompt pairs. Reproducible experiments.</p>
        </div>
        <div className="row">
          <button className="danger" disabled={busy} onClick={resetPrompts}>
            ↻ Reset from seed file
          </button>
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
        </div>
      </header>
      <div className="columns">
        <section className="panel form">
          <h2>Latest prompts</h2>
          <p className="muted seed-file-note">
            Starter content lives in{" "}
            <code>apps/server/src/prompt-seeds.ts</code>.
          </p>
          {latestPrompts.map((p) => {
            const older = prompts.filter(
              (version) =>
                version.id === p.id && version.versionId !== p.versionId,
            );
            const expanded = historyPromptId === p.id;
            return (
              <div className="prompt-group" key={p.id}>
                <button
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
                {older.length > 0 && (
                  <button
                    className="history-toggle"
                    aria-expanded={expanded}
                    onClick={() => setHistoryPromptId(expanded ? null : p.id)}
                  >
                    <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>{" "}
                    {expanded
                      ? "Hide history"
                      : `Show ${older.length} older ${older.length === 1 ? "version" : "versions"}`}
                  </button>
                )}
                {expanded && (
                  <div className="prompt-history">
                    {older.map((version) => (
                      <button
                        key={version.versionId}
                        className={
                          "prompt-item historical " +
                          (editing?.versionId === version.versionId
                            ? "chosen"
                            : "")
                        }
                        onClick={() => {
                          setPromptNameStatus(null);
                          setEditing({ ...version });
                        }}
                      >
                        <div>
                          <b>{version.name}</b>
                          <small>
                            {version.kind} · {date(version.created_at)}
                          </small>
                        </div>
                        <span className="pill">v{version.version}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
        <section className="panel form">
          <h2>{editing?.id ? "Create next version" : "Prompt editor"}</h2>
          {editing ? (
            <>
              {editing.id &&
                editing.version <
                  (latestPrompts.find((p) => p.id === editing.id)?.version ||
                    0) && (
                  <p className="history-notice">
                    Viewing historical version v{editing.version}. Saving it
                    creates a new latest version.
                  </p>
                )}
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
                      void savePromptName(editing.id, e.currentTarget.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                    if (e.key === "Escape" && editing.id) {
                      e.preventDefault();
                      const original =
                        prompts.find((p) => p.id === editing.id)?.name || "";
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
              <button className="primary" disabled={busy} onClick={savePrompt}>
                Save {editing.id ? "new version" : "prompt"}
              </button>
            </>
          ) : (
            <p className="muted">Select a version to inspect or evolve it.</p>
          )}
        </section>
      </div>
    </>
  );
}
