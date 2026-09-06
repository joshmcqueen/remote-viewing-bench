import { useEffect, useState } from "react";
import type { Model, Preferences } from "@rv/shared";
import { api } from "../lib/api";
import type { Feedback } from "./useFeedback";
export function useWorkspace({ setError, setNotice, action }: Feedback) {
  const [runs, setRuns] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [scopes, setScopes] = useState<any[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [config, setConfig] = useState<any>({});
  const [prefs, setPrefs] = useState<Preferences>({
    models: [],
    repetitions: 1,
    temperature: null,
    maxTokens: 2048,
    evaluatorModel: "",
  });
  const [search, setSearch] = useState("");
  const [scopeId, setScopeId] = useState(0);
  const [promptId, setPromptId] = useState(0);
  const [evalPrompt, setEvalPrompt] = useState(0);
  const [evalModel, setEvalModel] = useState("");
  async function refresh() {
    const [r, p, q, m, c, s] = await Promise.all([
      api("/runs"),
      api("/prompts"),
      api("/scopes"),
      api("/models"),
      api("/config"),
      api("/settings"),
    ]);
    setRuns(r);
    setPrompts(p);
    setScopes(q);
    setModels(m.models);
    setConfig(c);
    setPrefs(s);
    setEvalModel(s.evaluatorModel);
    setPromptId(
      (x) => x || p.find((x: any) => x.kind === "experiment")?.versionId || 0,
    );
    setEvalPrompt(
      (x) => x || p.find((x: any) => x.kind === "evaluator")?.versionId || 0,
    );
    setScopeId((x) =>
      q.some((scope: any) => scope.id === x) ? x : q[0]?.id || 0,
    );
  }
  async function reloadScopes(preferredId?: number) {
    const next = await api("/scopes");
    setScopes(next);
    setScopeId((current) => {
      const wanted = preferredId ?? current;
      return next.some((scope: any) => scope.id === wanted)
        ? wanted
        : next[0]?.id || 0;
    });
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  const latestPrompts = prompts.filter(
    (prompt, index) =>
      prompts.findIndex((item) => item.id === prompt.id) === index,
  );
  const experiments = latestPrompts.filter((p) => p.kind === "experiment"),
    evaluators = latestPrompts.filter((p) => p.kind === "evaluator");

  const refreshModels = () =>
    action(async () => {
      const m = await api("/models/refresh", {});
      setModels(m.models);
      setNotice("Model catalog refreshed.");
    });
  const savePrefs = () =>
    action(async () => {
      await api("/settings", prefs, "PUT");
      setNotice("Preferences saved.");
    });
  function selectPromptVersion(kind: string, versionId: number) {
    if (kind === "experiment") setPromptId(versionId);
    else setEvalPrompt(versionId);
  }
  function selectPreferredEvaluator(model: string) {
    setPrefs({ ...prefs, evaluatorModel: model });
    setEvalModel(model);
  }
  return {
    runs,
    setRuns,
    prompts,
    setPrompts,
    scopes,
    models,
    config,
    prefs,
    setPrefs,
    search,
    setSearch,
    scopeId,
    setScopeId,
    promptId,
    setPromptId,
    evalPrompt,
    setEvalPrompt,
    evalModel,
    setEvalModel,
    latestPrompts,
    experiments,
    evaluators,
    reloadScopes,
    refreshModels,
    savePrefs,
    selectPromptVersion,
    selectPreferredEvaluator,
  };
}
export type Workspace = ReturnType<typeof useWorkspace>;
