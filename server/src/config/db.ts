import { Pool, PoolClient } from "pg";
import { env } from "./env";

export const pool = new Pool({ connectionString: env.databaseUrl });

/** Anything a repository can run a query against — the pool itself, or a
 * transaction's client when the caller needs several statements to commit
 * or roll back together. Repositories accept this instead of hard-coding
 * `pool`, so a service can wrap them in a transaction without the
 * repository knowing or caring. */
export type Queryable = Pool | PoolClient;

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
