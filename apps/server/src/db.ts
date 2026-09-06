import Database from "better-sqlite3";
import {
  experimentSeed,
  experimentUserSeed,
  evaluatorSeed,
  evaluatorUserSeed,
  defaultScopes,
} from "@rv/shared";
export function openDb(path: string) {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(
    `CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);`,
  );
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=1").get())
    db.transaction(() => {
      db.exec(`
 CREATE TABLE prompts(id INTEGER PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL);
 CREATE TABLE versions(id INTEGER PRIMARY KEY,prompt_id INTEGER REFERENCES prompts(id),version INTEGER NOT NULL,system_content TEXT NOT NULL,user_content TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE scopes(id INTEGER PRIMARY KEY,name TEXT NOT NULL COLLATE NOCASE UNIQUE,description TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE settings(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
 CREATE TABLE catalog(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE runs(id INTEGER PRIMARY KEY,code TEXT NOT NULL,scope_id INTEGER REFERENCES scopes(id) ON DELETE SET NULL,scope_name TEXT NOT NULL,scope_description TEXT NOT NULL,prompt_version_id INTEGER REFERENCES versions(id),messages TEXT NOT NULL,settings TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE reveals(id INTEGER PRIMARY KEY,run_id INTEGER REFERENCES runs(id),description TEXT NOT NULL,image BLOB,mime TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE batches(id INTEGER PRIMARY KEY,run_id INTEGER REFERENCES runs(id),reveal_id INTEGER REFERENCES reveals(id),prompt_version_id INTEGER REFERENCES versions(id),model TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE jobs(id INTEGER PRIMARY KEY,run_id INTEGER REFERENCES runs(id),batch_id INTEGER REFERENCES batches(id),source_id INTEGER REFERENCES jobs(id),kind TEXT NOT NULL,model TEXT NOT NULL,repetition INTEGER NOT NULL,attempt INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'queued',payload TEXT NOT NULL,response TEXT,result TEXT,error TEXT,trace_id TEXT,trace_url TEXT,trace_error TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,finished_at TEXT);
 INSERT INTO migrations VALUES(1);
 `);
      const insertScope = db.prepare(
        "INSERT INTO scopes(name,description) VALUES(?,?)",
      );
      for (const scope of defaultScopes)
        insertScope.run(scope.name, scope.description);
      for (const [name, kind, systemContent, userContent] of [
        ["First impressions", "experiment", experimentSeed, experimentUserSeed],
        [
          "Correspondence rubric",
          "evaluator",
          evaluatorSeed,
          evaluatorUserSeed,
        ],
      ]) {
        const id = db
          .prepare("INSERT INTO prompts(name,kind) VALUES(?,?)")
          .run(name, kind).lastInsertRowid;
        db.prepare(
          "INSERT INTO versions(prompt_id,version,system_content,user_content) VALUES(?,1,?,?)",
        ).run(id, systemContent, userContent);
      }
    })();
  db.prepare(
    "UPDATE jobs SET status='interrupted',error='Server stopped before completion' WHERE status IN ('queued','running')",
  ).run();
  return db;
}
export type DB = ReturnType<typeof openDb>;
