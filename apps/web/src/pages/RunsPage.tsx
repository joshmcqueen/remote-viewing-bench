import { date } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";
export function RunsPage({
  runs,
  selectedModelCount,
  onNewRun,
  onOpen,
  onDelete,
  busy,
}: {
  runs: any[];
  selectedModelCount: number;
  onNewRun: () => void;
  onOpen: (id: number) => void;
  onDelete: (id: number, code: string) => void;
  busy: boolean;
}) {
  return (
    <>
      <header>
        <div>
          <div className="eyebrow">YOUR EXPERIMENT LOG</div>
          <h1>
            Run history<span className="accent">.</span>
          </h1>
          <p>A record of impressions, targets, and correspondence.</p>
        </div>
        <button className="primary" onClick={onNewRun}>
          ＋ New run
        </button>
      </header>
      <div className="stats">
        <div>
          <span>Total runs</span>
          <strong>{runs.length.toString().padStart(2, "0")}</strong>
        </div>
        <div>
          <span>In progress</span>
          <strong>
            {runs
              .filter((r) => r.status === "running")
              .length.toString()
              .padStart(2, "0")}
          </strong>
        </div>
        <div>
          <span>Models selected</span>
          <strong>{selectedModelCount.toString().padStart(2, "0")}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Experiments</h2>
          <span className="muted">Most recent first</span>
        </div>
        {!runs.length ? (
          <div className="empty">
            <div className="envelope">◇</div>
            <h2>Every experiment starts with a code.</h2>
            <p>
              Prepare your target, choose your models,
              <br />
              and capture their first impressions.
            </p>
            <button className="primary" onClick={onNewRun}>
              Create your first run →
            </button>
          </div>
        ) : (
          <div className="run-table">
            <div className="table-head">
              <span>ENVELOPE / TARGET</span>
              <span>MODELS</span>
              <span>CREATED</span>
              <span>STATUS</span>
            </div>
            {runs.map((r) => (
              <div className="run-entry" key={r.id}>
                <button className="run-row" onClick={() => onOpen(r.id)}>
                  <span>
                    <b>{r.code}</b>
                    <small>
                      #{String(r.id).padStart(3, "0")} · {r.scope_name}
                    </small>
                  </span>
                  <span>
                    {r.settings.models.length} models{" "}
                    <small>{r.settings.repetitions} repetition(s)</small>
                  </span>
                  <span>{date(r.created_at)}</span>
                  {<StatusBadge status={r.status} />}
                </button>
                <button
                  className="run-delete danger"
                  aria-label={`Delete run ${r.code}`}
                  title="Delete run"
                  disabled={busy}
                  onClick={() => onDelete(r.id, r.code)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="footnote">
        Observe carefully. Keep the record. Let the experiments evolve.
      </p>
    </>
  );
}
