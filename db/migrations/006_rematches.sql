CREATE TABLE rematch_invitations (
  match_id uuid PRIMARY KEY REFERENCES matches(id),
  sender_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 seconds'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  rematch_id uuid UNIQUE REFERENCES matches(id),
  CHECK ((status='accepted') = (rematch_id IS NOT NULL))
);
