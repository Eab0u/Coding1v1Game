CREATE UNIQUE INDEX users_username_case_insensitive ON users (lower(username));
CREATE TABLE auth_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX auth_sessions_expiry ON auth_sessions (expires_at);
CREATE TABLE auth_attempts (
  username text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1
);
