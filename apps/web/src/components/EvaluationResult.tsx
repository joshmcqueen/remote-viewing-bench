import { useState } from "react";
import {
  formatCost,
  formatDuration,
  formatTokens,
  jobMetrics,
} from "../lib/format";
import { JobFooter } from "./JobFooter";
import { StatusBadge } from "./StatusBadge";

const verdictLabels = {
  match: "matches",
  contradiction: "contradictions",
  unverifiable: "unverifiable",
} as const;

export function EvaluationResult({
  job,
  sourceModel,
  busy,
  onRetry,
  canRetry,
}: {
  job: any;
  sourceModel?: string;
  busy: boolean;
  onRetry: (id: number) => void;
  canRetry: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `evaluation-result-${job.id}`;
  const metrics = jobMetrics(job);
  const counts = (job.result?.observations || []).reduce(
    (result: Record<string, number>, observation: any) => {
      result[observation.verdict] = (result[observation.verdict] || 0) + 1;
      return result;
    },
    {},
  );
  const scoreBand =
    job.result?.score >= 5 ? "high" : job.result?.score >= 3 ? "mid" : "low";

  return (
    <article className={`evaluation-result${open ? " open" : ""}`}>
      <button
        type="button"
        className="evaluation-summary"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="evaluation-summary-main">
          <span className="evaluation-model">
            {sourceModel || "Unknown model"}
          </span>
          <span className="evaluation-byline">
            Response #{job.source_id} · judged by {job.model}
          </span>
          {job.result ? (
            <span className="evaluation-rationale-preview">
              {job.result.rationale}
            </span>
          ) : (
            <span className="evaluation-rationale-preview">
              {job.status === "running"
                ? "Evaluation in progress…"
                : job.status === "queued" || job.status === "retrying"
                  ? "Waiting to evaluate…"
                  : job.error || "No evaluation result recorded."}
            </span>
          )}
        </span>
        <span className="evaluation-score-area">
          {job.result ? (
            <span className={`score score-${scoreBand}`}>
              {job.result.score}
              <small>/ 7</small>
            </span>
          ) : (
            <StatusBadge status={job.status} />
          )}
        </span>
        <span className="evaluation-verdicts">
          {job.result
            ? (Object.keys(verdictLabels) as Array<keyof typeof verdictLabels>)
                .filter((verdict) => counts[verdict])
                .map((verdict) => (
                  <span className={`verdict-count ${verdict}`} key={verdict}>
                    {counts[verdict]} {verdictLabels[verdict]}
                  </span>
                ))
            : null}
        </span>
        <span className="evaluation-telemetry">
          <span>
            {metrics.elapsed == null ? "—" : formatDuration(metrics.elapsed)}
          </span>
          <span>
            {metrics.totalTokens == null
              ? "—"
              : `${formatTokens(metrics.totalTokens)} tokens`}
          </span>
          <span>{metrics.cost == null ? "—" : formatCost(metrics.cost)}</span>
        </span>
        <span className="evaluation-toggle" aria-hidden="true">
          {open ? "Hide details ↑" : "View details ↓"}
        </span>
      </button>
      {open && (
        <div className="evaluation-detail" id={panelId}>
          {job.result && (
            <>
              <div className="evaluation-rationale">
                <span>Evaluator summary</span>
                <p>{job.result.rationale}</p>
              </div>
              <div className="observation-list">
                {job.result.observations.map(
                  (observation: any, index: number) => (
                    <div className="observation" key={index}>
                      <div className="row spread">
                        <b>{observation.attribute}</b>
                        <span className={`verdict ${observation.verdict}`}>
                          {observation.verdict}
                        </span>
                      </div>
                      <blockquote>{observation.responseEvidence}</blockquote>
                      <p>
                        <b>Target:</b> {observation.targetEvidence}
                      </p>
                      <p>{observation.explanation}</p>
                    </div>
                  ),
                )}
              </div>
            </>
          )}
          <JobFooter
            job={job}
            showTelemetry={false}
            canRetry={canRetry}
            busy={busy}
            onRetry={onRetry}
          />
        </div>
      )}
    </article>
  );
}
