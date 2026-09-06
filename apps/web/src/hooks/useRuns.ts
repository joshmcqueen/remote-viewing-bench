import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Feedback } from "./useFeedback";
import type { Workspace } from "./useWorkspace";
import { eligibleModel } from "@rv/shared";
export function useRuns(
  workspace: Workspace,
  { action, setNotice, setError }: Feedback,
  onOpened: () => void,
) {
  const {
    setRuns,
    models,
    prefs,
    evalModel,
    setEvalModel,
    evalPrompt,
    setEvalPrompt,
    evaluators,
  } = workspace;
  const [detail, setDetail] = useState<any>(null);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [batch, setBatch] = useState<number | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      api("/runs")
        .then(setRuns)
        .catch(() => {});
      if (detail)
        api(`/runs/${detail.id}`)
          .then(setDetail)
          .catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [detail?.id]);
  async function open(id: number) {
    const d = await api(`/runs/${id}`);
    setDetail(d);
    setDescription(d.reveal?.description || "");
    setImage(d.reveal?.image || null);
    setBatch(null);
    onOpened();
  }
  const generationJobs =
    detail?.jobs.filter((j: any) => j.kind === "generation") || [];
  const activeGeneration = generationJobs.some((j: any) =>
    ["running", "queued"].includes(j.status),
  );
  const selectedBatch = batch ?? detail?.batches[0]?.id;
  const evaluationJobs =
    detail?.jobs.filter((j: any) => j.batch_id === selectedBatch) || [];
  const compatible = models.filter(
    (m) =>
      m.supported_parameters.includes("structured_outputs") &&
      (!detail?.reveal?.image ||
        m.architecture?.input_modalities?.includes("image")) &&
      eligibleModel(m),
  );
  const retry = (id: number) =>
    action(async () => {
      await api(`/jobs/${id}/retry`, {});
      setDetail(await api(`/runs/${detail.id}`));
    });
  const cancelRun = () =>
    action(async () => {
      await api(`/runs/${detail.id}/cancel`, {});
      setDetail(await api(`/runs/${detail.id}`));
    });
  const deleteRun = (id: number, code: string) => {
    if (!window.confirm(`Delete run ${code}? This cannot be undone.`)) return;
    action(async () => {
      await api(`/runs/${id}`, undefined, "DELETE");
      setRuns(await api("/runs"));
      if (detail?.id === id) {
        setDetail(null);
        onOpened();
      }
      setNotice(`Run ${code} deleted.`);
    });
  };
  const saveReveal = () =>
    action(async () => {
      await api(`/runs/${detail.id}/reveal`, {
        description,
        image,
      });
      setDetail(await api(`/runs/${detail.id}`));
      setNotice("Target reveal saved.");
    });
  const evaluate = () =>
    action(async () => {
      await api(`/runs/${detail.id}/evaluate`, {
        model: evalModel,
        promptVersionId: evalPrompt,
      });
      await api("/settings", { ...prefs, evaluatorModel: evalModel }, "PUT");
      setDetail(await api(`/runs/${detail.id}`));
      setBatch(null);
    });

  const openRun = (id: number) => action(() => open(id));
  const close = () => setDetail(null);
  function selectImage(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Maximum image size is 10 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }
  return {
    detail,
    description,
    setDescription,
    image,
    setImage,
    setBatch,
    open,
    openRun,
    close,
    generationJobs,
    activeGeneration,
    selectedBatch,
    evaluationJobs,
    compatible,
    retry,
    cancelRun,
    deleteRun,
    saveReveal,
    evaluate,
    selectImage,
    evalModel,
    setEvalModel,
    evalPrompt,
    setEvalPrompt,
    evaluators,
  };
}
export type Runs = ReturnType<typeof useRuns>;
