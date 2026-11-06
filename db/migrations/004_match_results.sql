CREATE TABLE match_results (
  match_id uuid NOT NULL REFERENCES matches(id),
  user_id uuid NOT NULL REFERENCES users(id),
  tests_passed integer NOT NULL CHECK (tests_passed >= 0),
  tests_total integer NOT NULL CHECK (tests_total > 0 AND tests_passed <= tests_total),
  median_cpu_ms double precision NOT NULL CHECK (median_cpu_ms >= 0 AND median_cpu_ms < 'Infinity'::float8),
  submitted_after_ms double precision CHECK (submitted_after_ms >= 0 AND submitted_after_ms < 'Infinity'::float8),
  PRIMARY KEY (match_id, user_id)
);
COMMENT ON TABLE match_results IS 'Final scorer inputs; lifecycle must insert both participants atomically with completion and ratings. NULL submission time means no submission.';
