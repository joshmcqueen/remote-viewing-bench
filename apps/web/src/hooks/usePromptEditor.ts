import { useState } from "react";
import { api } from "../lib/api";
import type { Feedback } from "./useFeedback";
import type { Workspace } from "./useWorkspace";

export function usePromptEditor(
  workspace: Workspace,
  { action, setNotice, setError }: Feedback,
) {
  const {
    prompts,
    setPrompts,
    latestPrompts,
    setPromptId,
    setEvalPrompt,
    selectPromptVersion,
  } = workspace;
  const [editing, setEditing] = useState<any>(null);
  const [historyPromptId, setHistoryPromptId] = useState<number | null>(null);
  const [promptNameStatus, setPromptNameStatus] = useState<{
    id: number;
    name: string;
    state: "saving" | "saved";
  } | null>(null);
  async function savePromptName(id: number, rawName: string) {
    const original = prompts.find((prompt) => prompt.id === id)?.name || "";
    const name = rawName.trim();
    if (!name) {
      setEditing((current: any) =>
        current?.id === id ? { ...current, name: original } : current,
      );
      setPromptNameStatus(null);
      setError("Prompt name cannot be empty.");
      return;
    }
    if (name === original) {
      setEditing((current: any) =>
        current?.id === id ? { ...current, name } : current,
      );
      return;
    }
    setPromptNameStatus({ id, name, state: "saving" });
    setError("");
    try {
      const renamed = await api(`/prompts/${id}`, { name }, "PATCH");
      setPrompts((current) =>
        current.map((prompt) =>
          prompt.id === id ? { ...prompt, name: renamed.name } : prompt,
        ),
      );
      setEditing((current: any) =>
        current?.id === id && current.name.trim() === name
          ? { ...current, name: renamed.name }
          : current,
      );
      setPromptNameStatus((current) =>
        current?.id === id && current.name === name
          ? { ...current, state: "saved" }
          : current,
      );
    } catch (e) {
      setEditing((current: any) =>
        current?.id === id && current.name.trim() === name
          ? { ...current, name: original }
          : current,
      );
      setPromptNameStatus((current) =>
        current?.id === id && current.name === name ? null : current,
      );
      setError((e as Error).message);
    }
  }
  const resetPrompts = () => {
    if (
      !window.confirm(
        "Replace every prompt and version with the contents of apps/server/src/prompt-seeds.ts? Existing runs will keep their saved request snapshots.",
      )
    )
      return;
    void action(async () => {
      await api("/prompts/reseed", {});
      const next = await api("/prompts");
      setPrompts(next);
      setPromptId(
        next.find((p: any) => p.kind === "experiment")?.versionId || 0,
      );
      setEvalPrompt(
        next.find((p: any) => p.kind === "evaluator")?.versionId || 0,
      );
      setHistoryPromptId(null);
      setEditing(null);
      setPromptNameStatus(null);
      setNotice("Prompts reset from the seed file.");
    });
  };
  const savePrompt = () =>
    action(async () => {
      const saved = await api(
        editing.id ? `/prompts/${editing.id}/versions` : "/prompts",
        editing,
      );
      setPrompts(await api("/prompts"));
      selectPromptVersion(editing.kind, saved.versionId);
      setNotice("New prompt version saved.");
      setPromptNameStatus(null);
      setEditing(null);
    });

  return {
    prompts,
    latestPrompts,
    editing,
    setEditing,
    historyPromptId,
    setHistoryPromptId,
    promptNameStatus,
    setPromptNameStatus,
    savePromptName,
    resetPrompts,
    savePrompt,
  };
}
export type PromptEditor = ReturnType<typeof usePromptEditor>;
