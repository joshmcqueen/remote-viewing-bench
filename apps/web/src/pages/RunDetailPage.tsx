import { useEffect, useState } from "react";
import type { Runs } from "../hooks/useRuns";
import {
  aggregateJobMetrics,
  date,
  formatCost,
  formatTokens,
} from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";
import { CallDetails } from "../components/CallDetails";
import { JobFooter } from "../components/JobFooter";
import { RunDashboard } from "../components/RunDashboard";
import { EvaluationResult } from "../components/EvaluationResult";
import { promptOptions } from "../lib/prompt-options";

function SectionTelemetry({ jobs }: { jobs: any[] }) {
  const metrics = aggregateJobMetrics(jobs);
  if (!jobs.length) return null;
  return (
    <div className="section-telemetry">
      <span>{jobs.length} calls</span>
      <span>
        {metrics.usageCount
          ? `${formatTokens(metrics.totalTokens)} tokens`
          : "Tokens —"}
      </span>
      <span>{metrics.costCount ? formatCost(metrics.cost) : "Cost —"}</span>
    </div>
  );
}

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
    deleteRun,
    saveReveal,
    evaluate,
    selectImage,
  } = run;
  const [editingReveal, setEditingReveal] = useState(!detail.reveal);
  useEffect(
    () => setEditingReveal(!detail.reveal),
    [detail.id, detail.reveal?.id],
  );
  const selectedBatchData = detail.batches.find(
    (batch: any) => batch.id === selectedBatch,
  );
  const historicalReveal =
    selectedBatchData?.reveal?.id !== detail.reveal?.id
      ? selectedBatchData?.reveal
      : null;
  const evaluatedScores = evaluationJobs
    .map((job: any) => job.result?.score)
    .filter((score: unknown): score is number => typeof score === "number");
  const averageScore = evaluatedScores.length
    ? evaluatedScores.reduce(
        (total: number, score: number) => total + score,
        0,
      ) / evaluatedScores.length
    : null;
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
          <button
            className="danger"
            disabled={busy}
            onClick={() => deleteRun(detail.id, detail.code)}
          >
            Delete run
          </button>
        </div>
      </header>
      <RunDashboard detail={detail} jobs={detail.jobs} />
      <div className="columns detail-columns">
        <div>
          <section className="panel form">
            <div className="results-section-heading">
              <h2>
                Recorded impressions{" "}
                <span className="pill">{generationJobs.length}</span>
              </h2>
              <SectionTelemetry jobs={generationJobs} />
            </div>
            <dl className="run-settings-summary">
              <div>
                <dt>Temperature</dt>
                <dd>
                  {detail.settings?.temperature == null
                    ? "Provider default"
                    : detail.settings.temperature}
                </dd>
              </div>
              <div>
                <dt>Repetitions</dt>
                <dd>{detail.settings?.repetitions ?? "—"}</dd>
              </div>
              <div>
                <dt>Output limit</dt>
                <dd>
                  {detail.settings?.outputTokenLimit
                    ? `${Number(detail.settings.outputTokenLimit).toLocaleString()} tokens`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Models</dt>
                <dd>{detail.settings?.models?.length ?? "—"}</dd>
              </div>
            </dl>
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
            <div className="results-section-heading evaluation-heading">
              <div>
                <h2>Evaluations</h2>
                {averageScore != null && (
                  <p className="score-summary">
                    <b>{averageScore.toFixed(1)}</b> average · range{" "}
                    {Math.min(...evaluatedScores)}–
                    {Math.max(...evaluatedScores)}
                  </p>
                )}
              </div>
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
            <div className="evaluation-batch-meta">
              <SectionTelemetry jobs={evaluationJobs} />
              {selectedBatchData && (
                <span className="reveal-provenance">
                  Evaluated against reveal #{selectedBatchData.reveal.id}
                </span>
              )}
            </div>
            {historicalReveal && (
              <details className="historical-reveal">
                <summary>
                  This batch used an earlier target reveal · View it
                </summary>
                <p>{historicalReveal.description}</p>
                {historicalReveal.image && (
                  <img
                    className="target-image"
                    alt="Historical evaluation target"
                    src={historicalReveal.image}
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
            <div className="evaluation-list">
              {evaluationJobs.map((j: any) => (
                <EvaluationResult
                  key={j.id}
                  job={j}
                  sourceModel={
                    generationJobs.find((g: any) => g.id === j.source_id)?.model
                  }
                  canRetry={j.kind === "evaluation" || !detail.reveal}
                  busy={busy}
                  onRetry={retry}
                />
              ))}
            </div>
          </section>
        </div>
        <div className="detail-rail">
          <section className="panel form">
            <div className="row spread target-heading">
              <h2>Target reveal</h2>
              {detail.reveal && !editingReveal && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setEditingReveal(true)}
                >
                  Edit correction
                </button>
              )}
            </div>
            {detail.reveal && !editingReveal ? (
              <div className="target-summary">
                <div className="target-summary-label">
                  Reveal #{detail.reveal.id}
                </div>
                <p>{detail.reveal.description}</p>
                {detail.reveal.image && (
                  <img
                    className="target-image"
                    src={detail.reveal.image}
                    alt="Target evidence"
                  />
                )}
              </div>
            ) : (
              <>
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
                <div className="row reveal-actions">
                  <button
                    disabled={busy || activeGeneration || !description.trim()}
                    onClick={saveReveal}
                  >
                    {detail.reveal
                      ? "Save target correction"
                      : "Save target reveal"}
                  </button>
                  {detail.reveal && (
                    <button
                      type="button"
                      onClick={() => {
                        setDescription(detail.reveal.description);
                        setImage(detail.reveal.image);
                        setEditingReveal(false);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </>
            )}
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
