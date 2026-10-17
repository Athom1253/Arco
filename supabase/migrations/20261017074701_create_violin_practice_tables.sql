/*
# Create violin practice tracker tables

1. New Tables
- `violin_repertoire` — pieces the user is learning (title, composer, status, difficulty, focus areas, notes, target performance date, progress, archived flag).
- `violin_practice_sessions` — one row per practice session (timer-based or manual), with status, started/finished timestamps, local practice date, elapsed seconds, active-since timestamp for running sessions, link to a repertoire piece, category, notes, goal, source (timer/manual) and focus areas.
- `violin_practice_goals` — practice goals (type, target value, optional linked piece, active flag).
- `violin_practice_plans` — planned practice per date (date, optional linked piece, category, planned minutes, goal, completed flag).

2. Security
- RLS enabled on all four tables. The app is single-tenant (no sign-in screen): the Express API server uses the service-role/db connection which bypasses RLS; policies allow anon+authenticated access as a safe default.

3. Notes
- Idempotent (IF NOT EXISTS). No destructive operations; additive only.
*/

CREATE TABLE IF NOT EXISTS violin_repertoire (
  id serial PRIMARY KEY,
  title text NOT NULL,
  composer text NOT NULL,
  status text NOT NULL,
  difficulty integer NOT NULL,
  focus_areas text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  target_performance_date date,
  progress integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS violin_practice_sessions (
  id serial PRIMARY KEY,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL,
  practice_date date,
  finished_at timestamptz,
  elapsed_seconds integer NOT NULL DEFAULT 0,
  active_since timestamptz,
  piece_id integer REFERENCES violin_repertoire(id) ON DELETE SET NULL,
  category text NOT NULL,
  notes text NOT NULL DEFAULT '',
  goal text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'timer',
  focus_areas text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS violin_practice_goals (
  id serial PRIMARY KEY,
  type text NOT NULL,
  target_value integer NOT NULL,
  piece_id integer REFERENCES violin_repertoire(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS violin_practice_plans (
  id serial PRIMARY KEY,
  date date NOT NULL,
  piece_id integer REFERENCES violin_repertoire(id) ON DELETE SET NULL,
  category text NOT NULL,
  planned_minutes integer NOT NULL,
  goal text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_practice_date ON violin_practice_sessions (practice_date);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_piece_id ON violin_practice_sessions (piece_id);

ALTER TABLE violin_repertoire ENABLE ROW LEVEL SECURITY;
ALTER TABLE violin_practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE violin_practice_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE violin_practice_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_repertoire" ON violin_repertoire;
CREATE POLICY "anon_read_repertoire" ON violin_repertoire FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_write_repertoire" ON violin_repertoire;
CREATE POLICY "anon_write_repertoire" ON violin_repertoire FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_repertoire" ON violin_repertoire;
CREATE POLICY "anon_update_repertoire" ON violin_repertoire FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_repertoire" ON violin_repertoire;
CREATE POLICY "anon_delete_repertoire" ON violin_repertoire FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_read_sessions" ON violin_practice_sessions;
CREATE POLICY "anon_read_sessions" ON violin_practice_sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_write_sessions" ON violin_practice_sessions;
CREATE POLICY "anon_write_sessions" ON violin_practice_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sessions" ON violin_practice_sessions;
CREATE POLICY "anon_update_sessions" ON violin_practice_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sessions" ON violin_practice_sessions;
CREATE POLICY "anon_delete_sessions" ON violin_practice_sessions FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_read_goals" ON violin_practice_goals;
CREATE POLICY "anon_read_goals" ON violin_practice_goals FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_write_goals" ON violin_practice_goals;
CREATE POLICY "anon_write_goals" ON violin_practice_goals FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_goals" ON violin_practice_goals;
CREATE POLICY "anon_update_goals" ON violin_practice_goals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_goals" ON violin_practice_goals;
CREATE POLICY "anon_delete_goals" ON violin_practice_goals FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_read_plans" ON violin_practice_plans;
CREATE POLICY "anon_read_plans" ON violin_practice_plans FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_write_plans" ON violin_practice_plans;
CREATE POLICY "anon_write_plans" ON violin_practice_plans FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_plans" ON violin_practice_plans;
CREATE POLICY "anon_update_plans" ON violin_practice_plans FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_plans" ON violin_practice_plans;
CREATE POLICY "anon_delete_plans" ON violin_practice_plans FOR DELETE TO anon, authenticated USING (true);