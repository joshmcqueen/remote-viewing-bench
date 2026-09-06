export const date = (s: string) =>
  new Date(s.includes("T") ? s : s + "Z").toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
