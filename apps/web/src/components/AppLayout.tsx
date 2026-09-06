import type { ReactNode } from "react";
export function AppLayout({
  view,
  navigate,
  runCount,
  error,
  notice,
  onDismissError,
  children,
}: {
  view: string;
  navigate: (view: string) => void;
  runCount: number;
  error: string;
  notice: string;
  onDismissError: () => void;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <aside>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Runs");
          }}
        >
          <span className="brand-icon">◉</span>
          <span className="brand-wordmark">Remote Viewing Bench</span>
        </a>
        <div className="eyebrow side-label">EXPERIMENT WORKSPACE</div>
        <nav>
          {[
            ["Runs", "▦"],
            ["New Run", "＋"],
            ["Prompts", "≡"],
            ["Settings", "⚙"],
            ["About", "ⓘ"],
          ].map(([v, icon]) => (
            <button
              className={view === v ? "nav active" : "nav"}
              key={v}
              onClick={() => navigate(v)}
            >
              <span
                aria-hidden="true"
                className={`nav-icon nav-icon-${v.toLowerCase().replace(" ", "-")}`}
              >
                {icon}
              </span>
              {v}
              {v === "Runs" && <small>{runCount}</small>}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <span className="local-dot" /> Local workspace
          <small>
            OpenRouter inference
            <br />
            LangSmith tracing
          </small>
          <div className="version">EXPERIMENTAL · V1.0</div>
        </div>
      </aside>
      <main>
        <div className="topline">
          <span>PERSONAL RESEARCH / REMOTE VIEWING BENCH</span>
          <span>
            <i className="local-dot" /> localhost
          </span>
        </div>
        {error && (
          <div role="alert" className="banner error">
            {error}
            <button onClick={onDismissError}>×</button>
          </div>
        )}
        {notice && (
          <div role="status" className="banner">
            {notice}
          </div>
        )}
        {children}
        <footer>
          REMOTE VIEWING BENCH <span>PERSONAL RESEARCH · LOCAL FIRST</span>
        </footer>
      </main>
    </div>
  );
}
