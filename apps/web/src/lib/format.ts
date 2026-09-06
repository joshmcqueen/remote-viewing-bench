export const timestamp = (s: string) => new Date(s.includes("T") ? s : s + "Z");

export const date = (s: string) =>
  timestamp(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const formatTokens = (value: number, compact = false) => {
  if (!compact || value < 10_000) return value.toLocaleString();
  return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
};

export const formatCost = (value: number) => {
  if (value === 0) return "$0";
  const digits = value < 0.01 ? 5 : value < 1 ? 4 : 2;
  return `$${value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "")}`;
};

export const formatDuration = (milliseconds: number) => {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
};

export const jobMetrics = (job: any, now = Date.now()) => {
  const usage = job.response?.usage;
  const started = job.started_at || job.created_at;
  const startTime = started ? timestamp(started).getTime() : Number.NaN;
  const endTime = job.finished_at ? timestamp(job.finished_at).getTime() : now;
  return {
    inputTokens: finite(usage?.prompt_tokens) ? usage.prompt_tokens : null,
    outputTokens: finite(usage?.completion_tokens)
      ? usage.completion_tokens
      : null,
    reasoningTokens: finite(usage?.completion_tokens_details?.reasoning_tokens)
      ? usage.completion_tokens_details.reasoning_tokens
      : null,
    totalTokens: finite(usage?.total_tokens) ? usage.total_tokens : null,
    cost: finite(usage?.cost) ? usage.cost : null,
    elapsed:
      Number.isFinite(startTime) && Number.isFinite(endTime)
        ? Math.max(0, endTime - startTime)
        : null,
  };
};

export const aggregateJobMetrics = (jobs: any[]) => {
  let inputTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let totalTokens = 0;
  let cost = 0;
  let usageCount = 0;
  let costCount = 0;
  for (const job of jobs) {
    const metrics = jobMetrics(job);
    if (metrics.totalTokens != null) {
      inputTokens += metrics.inputTokens ?? 0;
      outputTokens += metrics.outputTokens ?? 0;
      reasoningTokens += metrics.reasoningTokens ?? 0;
      totalTokens += metrics.totalTokens;
      usageCount++;
    }
    if (metrics.cost != null) {
      cost += metrics.cost;
      costCount++;
    }
  }
  return {
    calls: jobs.length,
    inputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
    cost,
    usageCount,
    costCount,
    models: new Set(jobs.map((job) => job.model)).size,
  };
};
