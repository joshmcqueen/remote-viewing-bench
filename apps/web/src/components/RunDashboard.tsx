import {
  aggregateJobMetrics,
  formatCost,
  formatDuration,
  formatTokens,
  timestamp,
} from "../lib/format";

export function RunDashboard({ detail, jobs }: { detail: any; jobs: any[] }) {
  const metrics = aggregateJobMetrics(jobs);
  const generations = jobs.filter((job) => job.kind === "generation");
  const evaluations = jobs.filter((job) => job.kind === "evaluation");
  const generationModels = new Set(generations.map((job) => job.model)).size;
  const evaluatorModels = new Set(evaluations.map((job) => job.model)).size;
  const completedTimes = jobs
    .map((job) => job.finished_at)
    .filter(Boolean)
    .map((value) => timestamp(value).getTime());
  const isActive = jobs.some((job) =>
    ["queued", "running", "retrying"].includes(job.status),
  );
  const started = timestamp(detail.created_at).getTime();
  const ended = isActive
    ? Date.now()
    : completedTimes.length
      ? Math.max(...completedTimes)
      : started;
  const usageCoverage =
    metrics.usageCount === metrics.calls
      ? "Provider reported"
      : `${metrics.usageCount} of ${metrics.calls} calls reported`;
  const costCoverage =
    metrics.costCount === metrics.calls
      ? "Provider reported"
      : `${metrics.costCount} of ${metrics.calls} calls reported`;

  return (
    <section className="run-dashboard" aria-label="Run totals">
      <div className="run-kpi run-kpi-cost">
        <span>Total spend</span>
        <strong>{metrics.costCount ? formatCost(metrics.cost) : "—"}</strong>
        <small>{costCoverage}</small>
      </div>
      <div className="run-kpi">
        <span>Tokens</span>
        <strong>
          {metrics.usageCount ? formatTokens(metrics.totalTokens, true) : "—"}
        </strong>
        <small>
          {metrics.usageCount
            ? `${formatTokens(metrics.inputTokens, true)} in · ${formatTokens(metrics.outputTokens, true)} out`
            : usageCoverage}
        </small>
      </div>
      <div className="run-kpi">
        <span>Calls</span>
        <strong>{metrics.calls}</strong>
        <small>
          {generations.length} generation · {evaluations.length} evaluation
        </small>
      </div>
      <div className="run-kpi">
        <span>Models</span>
        <strong>{metrics.models}</strong>
        <small>
          {generationModels} generation · {evaluatorModels} evaluator
        </small>
      </div>
      <div className="run-kpi">
        <span>Run span</span>
        <strong>{formatDuration(ended - started)}</strong>
        <small>
          {evaluations.length
            ? "Includes reveal & evaluation"
            : "Since run started"}
        </small>
      </div>
    </section>
  );
}
