import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const connectionString = process.env.DATABASE_URL;

declare global {
  var __faKnowledgeSqlClient:
    | ReturnType<typeof postgres>
    | undefined;
  var __faKnowledgeDb:
    | ReturnType<typeof drizzle>
    | undefined;
}

function createDatabase() {
  if (!connectionString) {
    return null;
  }

  const sql =
    globalThis.__faKnowledgeSqlClient ??
    postgres(connectionString, {
      prepare: false,
      max: 1,
    });

  globalThis.__faKnowledgeSqlClient = sql;

  const database = globalThis.__faKnowledgeDb ?? drizzle(sql);
  globalThis.__faKnowledgeDb = database;

  return database;
}

export const db = createDatabase();
