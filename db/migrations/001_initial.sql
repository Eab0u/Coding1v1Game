CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(24) NOT NULL UNIQUE CHECK (username ~ '^[A-Za-z0-9_]{3,24}$'),
  password_hash text,
  rating double precision NOT NULL DEFAULT 800 CHECK (rating >= 0),
  rating_deviation double precision NOT NULL DEFAULT 350 CHECK (rating_deviation > 0),
  volatility double precision NOT NULL DEFAULT 0.06 CHECK (volatility > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Hidden tests and solutions stay in server-side storage, never in public responses.
CREATE TABLE problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  statement text NOT NULL,
  function_signature text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  topics text[] NOT NULL DEFAULT '{}',
  examples jsonb NOT NULL DEFAULT '[]',
  constraints text NOT NULL,
  reference_solution text NOT NULL,
  brute_force_solution text NOT NULL,
  test_generator text NOT NULL,
  hidden_tests jsonb NOT NULL,
  cpu_limit_ms integer NOT NULL CHECK (cpu_limit_ms > 0),
  memory_limit_kb integer NOT NULL CHECK (memory_limit_kb > 0),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES problems(id),
  player_one_id uuid NOT NULL REFERENCES users(id),
  player_two_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  winner_id uuid REFERENCES users(id),
  started_at timestamptz,
  deadline_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (player_one_id <> player_two_id),
  CHECK (winner_id IS NULL OR winner_id IN (player_one_id, player_two_id)),
  CHECK (deadline_at IS NULL OR (started_at IS NOT NULL AND deadline_at > started_at)),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id),
  user_id uuid NOT NULL REFERENCES users(id),
  source_code text NOT NULL,
  language text NOT NULL DEFAULT 'python' CHECK (language = 'python'),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'judged', 'error')),
  tests_passed integer CHECK (tests_passed >= 0),
  tests_total integer CHECK (tests_total > 0),
  largest_test_cpu_ms double precision CHECK (largest_test_cpu_ms >= 0),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tests_passed <= tests_total)
);

CREATE TABLE rating_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  match_id uuid NOT NULL REFERENCES matches(id),
  rating_before double precision NOT NULL CHECK (rating_before >= 0),
  rating_after double precision NOT NULL CHECK (rating_after >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);

CREATE INDEX matches_player_one_history ON matches (player_one_id, created_at DESC);
CREATE INDEX matches_player_two_history ON matches (player_two_id, created_at DESC);
CREATE INDEX submissions_match_player ON submissions (match_id, user_id, submitted_at DESC);
CREATE INDEX rating_history_user ON rating_history (user_id, created_at DESC);
CREATE INDEX users_leaderboard ON users (rating DESC, id);
