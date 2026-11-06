ALTER TABLE matches ADD COLUMN player_one_ready boolean NOT NULL DEFAULT false;
ALTER TABLE matches ADD COLUMN player_two_ready boolean NOT NULL DEFAULT false;
ALTER TABLE submissions ADD COLUMN cpu_samples jsonb;
ALTER TABLE submissions ADD COLUMN attempt integer NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN retry_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX submissions_work ON submissions (retry_at) WHERE status IN ('queued','running','error');
