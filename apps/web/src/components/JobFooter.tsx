import { date } from "../lib/format";
export function JobFooter({
  job: j,
  showSnapshot = true,
  canRetry,
  busy,
  onRetry,
}: {
  job: any;
  showSnapshot?: boolean;
  canRetry: boolean;
  busy: boolean;
  onRetry: (id: number) => void;
}) {
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
