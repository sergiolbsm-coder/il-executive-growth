-- IL Executive Growth — 0001: identidade, templates (catálogo + pirâmide), mentorados, programas, auditoria
CREATE TYPE user_role AS ENUM ('admin', 'direcao', 'mentor', 'mentorado');
CREATE TYPE mentor_scope AS ENUM ('all', 'assigned');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  mentor_scope mentor_scope NOT NULL DEFAULT 'assigned',   -- só vale para mentor
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE activity_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_entity_idx ON activity_log (entity_type, entity_id);

-- Templates: hierarquia base → segmento → modelo. Editáveis por admin/direção; programas usam SNAPSHOT.
CREATE TABLE program_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  segment text NOT NULL DEFAULT 'geral',   -- geral · educacao · financas · saude …
  model text NOT NULL DEFAULT 'base',      -- base · smart · executive · master · advisory · impulso …
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

-- Catálogo de receitas (fontes de receita). slug estável; a numeração é só de exibição.
CREATE TABLE template_revenue_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 5),   -- nível sugerido na Escala do Negócio
  sort integer NOT NULL DEFAULT 0,
  role text,                                               -- papel principal (ex.: "Porta de entrada")
  is_motor boolean NOT NULL DEFAULT false,
  UNIQUE (template_id, slug)
);

-- Escala do Negócio: 5 níveis (1 = base). Parâmetros econômicos editáveis.
CREATE TABLE template_pyramid_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 5),
  name text NOT NULL,
  volume text NOT NULL,
  ticket text NOT NULL,
  effort text NOT NULL,
  role text NOT NULL,
  UNIQUE (template_id, level)
);

-- Mentorados (pré-cadastro sem login permitido: user_id nulo)
CREATE TABLE mentees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES users(id),
  full_name text NOT NULL,
  email text,
  segment text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mentor_assignments (
  mentee_id uuid NOT NULL REFERENCES mentees(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mentee_id, mentor_id)
);
CREATE INDEX mentor_assignments_mentor_idx ON mentor_assignments (mentor_id);

-- Programa = mentoria de um mentorado, com SNAPSHOT do template (mudar o template não altera programas em andamento)
CREATE TABLE programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id uuid NOT NULL REFERENCES mentees(id) ON DELETE CASCADE,
  template_id uuid REFERENCES program_templates(id),
  template_version integer,
  name text NOT NULL,
  model text,
  purpose text,                      -- propósito: topo da Escala do Negócio
  weekly_hours integer CHECK (weekly_hours IS NULL OR weekly_hours BETWEEN 0 AND 168),
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'ativo',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX programs_mentee_idx ON programs (mentee_id);

CREATE TABLE program_revenue_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 5),
  sort integer NOT NULL DEFAULT 0,
  role text,
  is_motor boolean NOT NULL DEFAULT false,
  UNIQUE (program_id, slug)
);

CREATE TABLE program_pyramid_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 5),
  name text NOT NULL,
  volume text NOT NULL,
  ticket text NOT NULL,
  effort text NOT NULL,
  role text NOT NULL,
  UNIQUE (program_id, level)
);
