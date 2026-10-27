-- IL Executive Growth — 0009: Conteúdo (eixos editáveis, calendário editorial) e biblioteca de links
CREATE TABLE content_axes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, name)
);

CREATE TABLE content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  axis_id uuid REFERENCES content_axes(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,   -- oferta que a publicação alimenta
  week_start date NOT NULL,                                  -- segunda-feira da semana planejada
  channel text NOT NULL,
  title text NOT NULL,
  thesis text,
  status text NOT NULL DEFAULT 'ideia' CHECK (status IN ('ideia', 'rascunho', 'agendada', 'publicada', 'descartada')),
  publish_url text,
  published_on date,
  engagement integer CHECK (engagement IS NULL OR engagement >= 0),   -- interações totais
  leads integer CHECK (leads IS NULL OR leads >= 0),                  -- convites/reuniões gerados
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_items_program_week_idx ON content_items (program_id, week_start);

CREATE TABLE library_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('drive-arquivo', 'drive-pasta', 'link')),  -- detectado pelo endereço
  title text NOT NULL,
  url text NOT NULL,
  category text,
  description text,
  pinned boolean NOT NULL DEFAULT false,                    -- acesso rápido
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX library_links_program_idx ON library_links (program_id);
