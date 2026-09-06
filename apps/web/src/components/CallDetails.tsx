import { useEffect, useRef, useState } from "react";
import { MarkdownResponse } from "./MarkdownResponse";

type DetailView = "response" | "raw";

export function CallDetails({
  jobId,
  response,
  snapshot,
}: {
  jobId: number;
  response?: string;
  snapshot: unknown;
}) {
  const [activeTab, setActiveTab] = useState<DetailView | null>(null);
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const copyResetTimer = useRef<number | null>(null);
  const panelId = `call-details-${jobId}`;
  const rawJson = JSON.stringify(snapshot, null, 2);

  useEffect(
    () => () => {
      if (copyResetTimer.current != null) {
        window.clearTimeout(copyResetTimer.current);
      }
    },
    [],
  );

  function toggleDetail(view: DetailView) {
    setActiveTab((current) => (current === view ? null : view));
    setCopyStatus("idle");
  }

  async function copyActiveDetail() {
    const text = activeTab === "response" ? response : rawJson;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }

    if (copyResetTimer.current != null) {
      window.clearTimeout(copyResetTimer.current);
    }
    copyResetTimer.current = window.setTimeout(
      () => setCopyStatus("idle"),
      1800,
    );
  }

  return (
    <div className={`call-details${activeTab ? " open" : ""}`}>
      <div
        className="call-detail-controls"
        role="group"
        aria-label="Call details"
      >
        <button
          type="button"
          aria-expanded={activeTab === "response"}
          aria-controls={panelId}
          className={activeTab === "response" ? "active" : ""}
          disabled={!response}
          onClick={() => toggleDetail("response")}
        >
          <span className="call-detail-chevron" aria-hidden="true">
            ›
          </span>
          Response
        </button>
        <button
          type="button"
          aria-expanded={activeTab === "raw"}
          aria-controls={panelId}
          className={activeTab === "raw" ? "active" : ""}
          onClick={() => toggleDetail("raw")}
        >
          <span className="call-detail-chevron" aria-hidden="true">
            ›
          </span>
          Request &amp; response JSON
        </button>
      </div>
      {activeTab && (
        <div
          className="call-detail-panel"
          id={panelId}
          tabIndex={0}
        >
          <div className="call-detail-panel-actions">
            <button
              type="button"
              className="call-detail-copy"
              onClick={copyActiveDetail}
            >
              {copyStatus === "copied"
                ? "✓ Copied"
                : copyStatus === "failed"
                  ? "Copy failed"
                  : activeTab === "response"
                    ? "Copy response"
                    : "Copy JSON"}
            </button>
          </div>
          {activeTab === "response" && response ? (
            <MarkdownResponse>{response}</MarkdownResponse>
          ) : (
            <pre className="raw-json">{rawJson}</pre>
          )}
        </div>
      )}
    </div>
  );
}
