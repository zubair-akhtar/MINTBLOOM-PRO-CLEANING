CREATE TABLE service_intake_requests (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  digest TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  answers JSONB NOT NULL,
  contact TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_progress','processed','declined')),
  note TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (scope, attempt_id)
);
CREATE INDEX service_intake_requests_scope_created_idx ON service_intake_requests (scope, created_at DESC, id);
CREATE INDEX service_intake_requests_scope_status_idx ON service_intake_requests (scope, status, created_at DESC);
CREATE TABLE service_intake_history (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES service_intake_requests(id) ON DELETE CASCADE,
  from_status TEXT CHECK (from_status IN ('received','in_progress','processed','declined')),
  to_status TEXT NOT NULL CHECK (to_status IN ('received','in_progress','processed','declined')),
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX service_intake_history_request_idx ON service_intake_history (request_id, created_at);
CREATE TABLE service_intake_notifications (
  request_id TEXT PRIMARY KEY REFERENCES service_intake_requests(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  lease_until TIMESTAMPTZ,
  token TEXT
);
CREATE TABLE service_intake_rate_buckets (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK (count > 0),
  window_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
