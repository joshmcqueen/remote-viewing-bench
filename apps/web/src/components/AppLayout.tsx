import { useLayoutEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "remote-view-bench-theme";

function getSavedTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

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
  const [theme, setTheme] = useState<Theme>(getSavedTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The selected theme still applies when browser storage is unavailable.
    }
  }, [theme]);

  const darkMode = theme === "dark";

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
        <button
          type="button"
          className="theme-toggle"
          role="switch"
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          aria-checked={darkMode}
          onClick={() => setTheme(darkMode ? "light" : "dark")}
        >
          <span className="theme-toggle-icon" aria-hidden="true">
            {darkMode ? "☀" : "☾"}
          </span>
          <span>Dark mode</span>
          <span className="theme-toggle-switch" aria-hidden="true">
            <span />
          </span>
        </button>
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
