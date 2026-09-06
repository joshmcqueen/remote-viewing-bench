import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { loadEnv } from "./config.js";
import fastifyStatic from "@fastify/static";
import { openDb } from "./db.js";
import { buildApp } from "./app.js";
import { createInference } from "./inference.js";
const root = fileURLToPath(new URL("../../../", import.meta.url));
loadEnv(root);
mkdirSync(resolve(root, "data"), { recursive: true });
const db = openDb(resolve(root, "data/bench.sqlite"));
const app = buildApp(db, createInference());
const web = resolve(root, "apps/web/dist");
if (existsSync(web)) {
  await app.register(fastifyStatic, { root: web });
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith("/api/")
      ? reply.code(404).send({ error: "Not found" })
      : reply.sendFile("index.html"),
  );
}
await app.listen({ port: 3001, host: "127.0.0.1" });
console.log("Remote Viewing Bench: http://127.0.0.1:3001");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
