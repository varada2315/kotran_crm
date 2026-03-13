import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

if (!hasDatabaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL must be set in production.");
}

export const pool = hasDatabaseUrl
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export const db = hasDatabaseUrl
  ? drizzle(pool!, { schema })
  : (null as unknown as ReturnType<typeof drizzle<typeof schema>>);

export const isDatabaseEnabled = hasDatabaseUrl;

export * from "./schema";
