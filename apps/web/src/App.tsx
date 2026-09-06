import { useState } from "react";
import { AppLayout } from "./components/AppLayout";
import { ModelPicker } from "./components/ModelPicker";
import { RunsPage } from "./pages/RunsPage";
import { NewRunPage } from "./pages/NewRunPage";
import { PromptsPage } from "./pages/PromptsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AboutPage } from "./pages/AboutPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { useFeedback } from "./hooks/useFeedback";
import { useWorkspace } from "./hooks/useWorkspace";
import { useRuns } from "./hooks/useRuns";
import { useNewRun } from "./hooks/useNewRun";
import { usePromptEditor } from "./hooks/usePromptEditor";
import { useScopeEditor } from "./hooks/useScopeEditor";

export function App() {
  const [view, setView] = useState("Runs");
  const feedback = useFeedback();
  const workspace = useWorkspace(feedback);
  // Keep feature hooks mounted so navigation preserves their drafts.
  const run = useRuns(workspace, feedback, () => setView("Runs"));
  const newRun = useNewRun(workspace, feedback, run.open);
  const promptEditor = usePromptEditor(workspace, feedback);
  const scopeEditor = useScopeEditor(workspace, feedback);

  function navigate(nextView: string) {
    setView(nextView);
    run.close();
    feedback.setError("");
    feedback.setNotice("");
  }
  const modelPicker = (
    <ModelPicker
      models={workspace.models}
      prefs={workspace.prefs}
      search={workspace.search}
      setPrefs={workspace.setPrefs}
      setSearch={workspace.setSearch}
      busy={feedback.busy}
      onRefresh={workspace.refreshModels}
    />
  );

  return (
    <AppLayout
      view={view}
      navigate={navigate}
      runCount={workspace.runs.length}
      error={feedback.error}
      notice={feedback.notice}
      onDismissError={() => feedback.setError("")}
    >
      {view === "Runs" && !run.detail && (
        <RunsPage
          runs={workspace.runs}
          selectedModelCount={workspace.prefs.models.length}
          onNewRun={() => navigate("New Run")}
          onOpen={run.openRun}
          onDelete={run.deleteRun}
          busy={feedback.busy}
        />
      )}
      {view === "New Run" && (
        <NewRunPage
          newRun={newRun}
          modelPicker={modelPicker}
          busy={feedback.busy}
        />
      )}
      {view === "Prompts" && (
        <PromptsPage editor={promptEditor} busy={feedback.busy} />
      )}
      {view === "About" && <AboutPage />}
      {view === "Settings" && (
        <SettingsPage
          workspace={workspace}
          editor={scopeEditor}
          modelPicker={modelPicker}
          busy={feedback.busy}
        />
      )}
      {view === "Runs" && run.detail && (
        <RunDetailPage run={run} busy={feedback.busy} />
      )}
    </AppLayout>
  );
}
