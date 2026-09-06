import { useState } from "react";
import { MarkdownResponse } from "./MarkdownResponse";
export function CallDetails({
  jobId,
  response,
  snapshot,
}: {
  jobId: number;
  response?: string;
  snapshot: unknown;
}) {
  const [activeTab, setActiveTab] = useState<"response" | "raw" | null>(null);
  const panelId = `call-details-${jobId}`;

  return (
    <div className={`call-details${activeTab ? " open" : ""}`}>
      <div
        className="call-detail-tabs"
        role="tablist"
        aria-label="Call details"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "response"}
          aria-controls={panelId}
          className={activeTab === "response" ? "active" : ""}
          disabled={!response}
          onClick={() => setActiveTab("response")}
        >
          Response
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "raw"}
          aria-controls={panelId}
          className={activeTab === "raw" ? "active" : ""}
          onClick={() => setActiveTab("raw")}
        >
          Raw JSON
        </button>
        {activeTab && (
          <button
            type="button"
            className="call-detail-collapse"
            onClick={() => setActiveTab(null)}
          >
            Hide details ↑
          </button>
        )}
      </div>
      {activeTab && (
        <div
          className="call-detail-panel"
          id={panelId}
          role="tabpanel"
          tabIndex={0}
        >
          {activeTab === "response" && response ? (
            <MarkdownResponse>{response}</MarkdownResponse>
          ) : (
            <pre className="raw-json">{JSON.stringify(snapshot, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}
