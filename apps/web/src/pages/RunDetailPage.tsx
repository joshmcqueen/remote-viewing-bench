import type { Runs } from "../hooks/useRuns";
import { date } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";
import { CallDetails } from "../components/CallDetails";
import { JobFooter } from "../components/JobFooter";
import { promptOptions } from "../lib/prompt-options";
export function RunDetailPage({ run, busy }: { run: Runs; busy: boolean }) {
  const {
    detail,
    close,
    generationJobs,
    retry,
    selectedBatch,
    setBatch,
    evaluationJobs,
    description,
    setDescription,
    image,
    setImage,
    activeGeneration,
    evalModel,
    setEvalModel,
    compatible,
    evalPrompt,
    setEvalPrompt,
    evaluators,
    cancelRun,
    saveReveal,
    evaluate,
    selectImage,
  } = run;
  return (
    <>
      <button className="back" onClick={close}>
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
          {<StatusBadge status={detail.status} />}
          {detail.status === "running" && (
            <button disabled={busy} onClick={cancelRun}>
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
                Shared messages · prompt version #{detail.prompt_version_id}
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
                  {<StatusBadge status={j.status} />}
                </div>
                {
                  <JobFooter
                    job={j}
                    showSnapshot={false}
                    canRetry={j.kind === "evaluation" || !detail.reveal}
                    busy={busy}
                    onRetry={retry}
                  />
                }
                {!j.response?.choices?.[0]?.message?.content && (
                  <p className="muted">
                    {j.status === "running"
                      ? "Awaiting model response…"
                      : j.status === "queued"
                        ? "Waiting in queue…"
                        : "No text response recorded."}
                  </p>
                )}
                <CallDetails
                  jobId={j.id}
                  response={j.response?.choices?.[0]?.message?.content}
                  snapshot={{ request: j.payload, response: j.response }}
                />
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
                    detail.batches.find((b: any) => b.id === selectedBatch)
                      .reveal.description
                  }
                </p>
                {detail.batches.find((b: any) => b.id === selectedBatch).reveal
                  .image && (
                  <img
                    className="target-image"
                    alt="Evaluation target snapshot"
                    src={
                      detail.batches.find((b: any) => b.id === selectedBatch)
                        .reveal.image
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
                      generationJobs.find((g: any) => g.id === j.source_id)
                        ?.model
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
                    <StatusBadge status={j.status} />
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
                {
                  <JobFooter
                    job={j}
                    canRetry={j.kind === "evaluation" || !detail.reveal}
                    busy={busy}
                    onRetry={retry}
                  />
                }
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
                  selectImage(e.target.files?.[0]);
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
              onClick={saveReveal}
            >
              {detail.reveal ? "Save target correction" : "Save target reveal"}
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
              onClick={evaluate}
            >
              Start evaluation →
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
