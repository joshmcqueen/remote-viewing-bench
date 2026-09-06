import { useState } from "react";
import { api } from "../lib/api";
import type { Feedback } from "./useFeedback";
import type { Workspace } from "./useWorkspace";
import { experimentMessages } from "@rv/shared";
import { generateTargetCode } from "../lib/target-code";
export function useNewRun(
  workspace: Workspace,
  { action }: Feedback,
  open: (id: number) => Promise<void>,
) {
  const {
    prefs,
    setPrefs,
    scopes,
    prompts,
    scopeId,
    setScopeId,
    promptId,
    setPromptId,
    experiments,
    config,
    setRuns,
  } = workspace;
  const [code, setCode] = useState(generateTargetCode);
  const selectedPrompt = prompts.find((p) => p.versionId === promptId);
  const selectedScope = scopes.find((scope) => scope.id === scopeId);
  const promptPreview = selectedPrompt
    ? experimentMessages(
        selectedPrompt.systemContent,
        selectedPrompt.userContent,
        code || "[target code]",
        selectedScope?.description || "[project scope]",
      )
    : [];
  const startRun = () =>
    action(async () => {
      const r = await api("/runs", {
        ...prefs,
        code,
        scopeId,
        promptVersionId: promptId,
      });
      setCode(generateTargetCode());
      await open(r.id);
      setRuns(await api("/runs"));
    });

  return {
    code,
    setCode,
    scopeId,
    setScopeId,
    promptId,
    setPromptId,
    scopes,
    selectedScope,
    experiments,
    selectedPrompt,
    promptPreview,
    prefs,
    setPrefs,
    config,
    startRun,
  };
}
export type NewRun = ReturnType<typeof useNewRun>;
