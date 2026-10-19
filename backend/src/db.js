import pg from 'pg';

const { Pool, types } = pg;

// Return COUNT()/bigint and numeric values as JavaScript numbers (all counts here are small).
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => Number(v));

let pool;

export const hasDatabase = () => Boolean(process.env.DATABASE_URL);

function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
  // A "sslmode=require" in the URL would make the driver verify the certificate chain, which fails
  // against Supabase's pooler. Connections are still encrypted; see the ssl option below.
  const connectionString = url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
  pool = new Pool({
    connectionString,
    max: 3, // serverless functions: keep connections per instance low
    // Hosted Postgres (Supabase, Neon) requires TLS; their certificates are not in Node's default trust store.
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  pool.on('error', (err) => console.error('Postgres pool error:', err.message));
  return pool;
}

export async function query(text, params = []) {
  const result = await getPool().query(text, params);
  return result.rows;
}

export async function one(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

// Runs `fn` inside one transaction. `fn` receives { query, one } bound to that transaction.
export async function transaction(fn) {
  const client = await getPool().connect();
  const run = async (text, params = []) => (await client.query(text, params)).rows;
  try {
    await client.query('begin');
    const result = await fn({ query: run, one: async (text, params) => (await run(text, params))[0] || null });
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) await pool.end();
  pool = undefined;
}
