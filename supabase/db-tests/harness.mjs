// PGlite (real Postgres compiled to WASM) + Supabase shim + all migrations + optional seed.
// Lets migrations, constraints and RLS be tested without Docker or a hosted project.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../', import.meta.url).pathname;

export async function createDatabase({ seed = true } = {}) {
  const db = new PGlite();
  await db.exec(readFileSync(join(root, 'db-tests/supabase_shim.sql'), 'utf8'));
  for (const file of readdirSync(join(root, 'migrations')).filter(name => name.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(join(root, 'migrations', file), 'utf8'));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${error.message}`);
    }
  }
  if (seed) await db.exec(readFileSync(join(root, 'seed.sql'), 'utf8'));
  return db;
}

/** Creates an auth.users row. kind: 'anonymous' (guest) or 'registered'. */
export async function createUser(db, kind = 'anonymous', { name = null, email = null } = {}) {
  const id = randomUUID();
  await db.query('insert into auth.users (id, is_anonymous, email, raw_user_meta_data) values ($1, $2, $3, $4)',
    [id, kind === 'anonymous', email, JSON.stringify(name ? { display_name: name } : {})]);
  return { id, kind };
}

export async function grantRole(db, user, role) {
  await db.query('insert into public.admin_role_assignments (user_id, role) values ($1, $2)', [user.id, role]);
}

/**
 * Runs fn inside a transaction as the given principal, exactly like PostgREST does:
 * SET LOCAL ROLE + request.jwt.claims. user === null means the public anon key without a session.
 * Errors roll the transaction back and are re-thrown.
 */
export async function as(db, user, fn) {
  return db.transaction(async tx => {
    if (user) {
      const claims = JSON.stringify({ sub: user.id, role: 'authenticated', is_anonymous: user.kind === 'anonymous' });
      await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
      await tx.exec('set local role authenticated');
    } else {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: 'anon' })]);
      await tx.exec('set local role anon');
    }
    return fn(tx);
  });
}

export async function rows(tx, sql, params = []) {
  return (await tx.query(sql, params)).rows;
}

export { randomUUID };
