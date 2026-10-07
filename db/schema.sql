CREATE TABLE IF NOT EXISTS app_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  financial_allowed boolean NOT NULL DEFAULT true,
  promotional_allowed boolean NOT NULL DEFAULT true,
  automation_blocked boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS payers (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL,
  contact_id text NOT NULL REFERENCES contacts(id),
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id text PRIMARY KEY,
  name text NOT NULL,
  unit text,
  plan text NOT NULL,
  status text NOT NULL,
  kind text NOT NULL,
  payer_id text NOT NULL REFERENCES payers(id),
  contact_id text NOT NULL REFERENCES contacts(id),
  plan_since date,
  last_attendance date,
  presence_source_updated_at date,
  is_minor boolean NOT NULL DEFAULT false,
  corporate_base_payer_id text REFERENCES payers(id),
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS obligations (
  id text PRIMARY KEY,
  payer_id text NOT NULL REFERENCES payers(id),
  period text NOT NULL,
  due_date date NOT NULL,
  nominal_due date,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  paid_cents integer NOT NULL CHECK (paid_cents >= 0),
  balance_cents integer NOT NULL CHECK (balance_cents >= 0),
  status text NOT NULL,
  paid_at date,
  data jsonb NOT NULL,
  UNIQUE (payer_id, period)
);

CREATE TABLE IF NOT EXISTS obligation_items (
  obligation_id text NOT NULL REFERENCES obligations(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES students(id),
  component text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  data jsonb NOT NULL,
  PRIMARY KEY (obligation_id, student_id, component)
);

CREATE TABLE IF NOT EXISTS presences (
  student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  occurred_on date NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (student_id, occurred_on)
);

CREATE TABLE IF NOT EXISTS creatives (
  id text PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  version integer NOT NULL,
  priority integer,
  approved boolean NOT NULL DEFAULT false,
  creative_id text REFERENCES creatives(id),
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS communications (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES campaigns(id),
  contact_id text NOT NULL REFERENCES contacts(id),
  scheduled_at timestamptz,
  sent_at timestamptz,
  responded_at timestamptz,
  converted_at timestamptz,
  status text NOT NULL,
  type text,
  signature text NOT NULL UNIQUE,
  amount_cents integer NOT NULL DEFAULT 0,
  recipient_name text,
  phone text,
  message_text text,
  creative_id text REFERENCES creatives(id),
  creative_url text,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  obligation_id text NOT NULL REFERENCES obligations(id) ON DELETE CASCADE,
  campaign_id text REFERENCES campaigns(id),
  communication_id text REFERENCES communications(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  paid_at timestamptz,
  attribution_kind text NOT NULL,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS offers (
  id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES students(id),
  payer_id text NOT NULL REFERENCES payers(id),
  communication_id text REFERENCES communications(id),
  status text NOT NULL,
  invited_at date,
  expires_at date NOT NULL,
  accepted_at timestamptz,
  start_date date,
  end_date date,
  continuation_amount_cents integer,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  type text NOT NULL,
  status text NOT NULL,
  communication_id text REFERENCES communications(id),
  contact_id text REFERENCES contacts(id),
  created_at timestamptz,
  description text,
  data jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS obligations_due_status_idx ON obligations (due_date, status);
CREATE INDEX IF NOT EXISTS communications_campaign_status_idx ON communications (campaign_id, status);
CREATE INDEX IF NOT EXISTS communications_scheduled_at_idx ON communications (scheduled_at);
CREATE INDEX IF NOT EXISTS payments_obligation_idx ON payments (obligation_id);
CREATE INDEX IF NOT EXISTS presences_occurred_on_idx ON presences (occurred_on);
