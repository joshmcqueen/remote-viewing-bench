export async function api(path: string, body?: unknown, method?: string) {
  const r = await fetch(`/api${path}`, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
