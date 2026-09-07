import assert from "node:assert/strict";
import { test } from "node:test";
import { jobMetrics } from "./format.js";

test("queued jobs do not count time spent waiting as elapsed time", () => {
  const metrics = jobMetrics(
    {
      status: "queued",
      created_at: "2026-09-07 10:00:00",
      started_at: null,
      finished_at: null,
    },
    Date.parse("2026-09-07T10:00:09Z"),
  );

  assert.equal(metrics.elapsed, 0);
});

test("elapsed time begins at started_at and ends at finished_at", () => {
  const running = jobMetrics(
    {
      status: "running",
      created_at: "2026-09-07 10:00:00",
      started_at: "2026-09-07 10:00:06",
      finished_at: null,
    },
    Date.parse("2026-09-07T10:00:09Z"),
  );
  const complete = jobMetrics({
    status: "complete",
    created_at: "2026-09-07 10:00:00",
    started_at: "2026-09-07 10:00:06",
    finished_at: "2026-09-07 10:00:11",
  });

  assert.equal(running.elapsed, 3_000);
  assert.equal(complete.elapsed, 5_000);
});
