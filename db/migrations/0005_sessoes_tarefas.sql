-- IL Executive Growth — 0005: sessões de mentoria (ata, decisões) e tarefas
CREATE TABLE mentoring_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  held_on date NOT NULL,
  title text NOT NULL,
  summary text,            -- ata compartilhada com o mentorado
  decisions text,          -- decisões tomadas (compartilhadas)
  internal_notes text,     -- notas internas: NUNCA vão ao mentorado
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mentoring_sessions_program_idx ON mentoring_sessions (program_id, held_on DESC);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  session_id uuid REFERENCES mentoring_sessions(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,
  title text NOT NULL,
  due_date date,
  assignee text NOT NULL DEFAULT 'mentorado' CHECK (assignee IN ('mentor', 'mentorado')),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'concluida', 'cancelada')),
  completed_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_program_idx ON tasks (program_id, status);
