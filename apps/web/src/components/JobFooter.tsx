import {
  date,
  formatCost,
  formatDuration,
  formatTokens,
  jobMetrics,
} from "../lib/format";
export function JobFooter({
  job: j,
  showSnapshot = true,
  showTelemetry = true,
  canRetry,
  busy,
  onRetry,
}: {
  job: any;
  showSnapshot?: boolean;
  showTelemetry?: boolean;
  canRetry: boolean;
  busy: boolean;
  onRetry: (id: number) => void;
}) {
  const metrics = jobMetrics(j);
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
      {showTelemetry && (
        <div className="job-telemetry" aria-label="Response usage">
          <span>
            <b>
              {metrics.elapsed == null ? "—" : formatDuration(metrics.elapsed)}
            </b>
            elapsed
          </span>
          <span>
            <b>
              {metrics.totalTokens == null
                ? "—"
                : formatTokens(metrics.totalTokens)}
            </b>
            tokens
          </span>
          <span>
            <b>{metrics.cost == null ? "—" : formatCost(metrics.cost)}</b>
            cost
          </span>
        </div>
      )}
      {j.trace_error && <p className="warning">Trace: {j.trace_error}</p>}
      {j.error && <p className="error-text">{j.error}</p>}
      {["error", "interrupted", "cancelled"].includes(j.status) && canRetry && (
        <button disabled={busy} onClick={() => onRetry(j.id)}>
          Retry
        </button>
      )}
      {showSnapshot && (
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
      )}
    </>
  );
}
