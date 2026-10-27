-- IL Executive Growth — 0007: Caixa de ferramentas (declarativas/externas), entradas e Score de Alavancagem
CREATE TABLE tools (
  slug text PRIMARY KEY,
  name text NOT NULL,
  phase text NOT NULL CHECK (phase IN ('levantamento', 'prototipacao', 'lancamento', 'transversal')),
  kind text NOT NULL CHECK (kind IN ('declarativa', 'externa')),
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,        -- declarativa: [{key,label,type,required,options?,help?}]
  external_url text,                                 -- externa
  strategic boolean NOT NULL DEFAULT false,
  weight integer NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 10),
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Concluir a ferramenta (numa oferta) COMPROVA estes itens de portão
CREATE TABLE tool_gate_links (
  tool_slug text NOT NULL REFERENCES tools(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  gate_key text NOT NULL,
  PRIMARY KEY (tool_slug, gate_key)
);

CREATE TABLE template_tools (
  template_id uuid NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  tool_slug text NOT NULL REFERENCES tools(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY (template_id, tool_slug)
);

CREATE TABLE program_tools (
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  tool_slug text NOT NULL REFERENCES tools(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY (program_id, tool_slug)
);

CREATE TABLE tool_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  tool_slug text NOT NULL REFERENCES tools(slug) ON UPDATE CASCADE,
  offer_id uuid REFERENCES offers(id) ON DELETE CASCADE,
  title text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'concluida')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tool_entries_program_idx ON tool_entries (program_id, tool_slug);

-- Pesos do Score de Alavancagem (por template e por programa; nulo = padrão do sistema)
ALTER TABLE program_templates ADD COLUMN score_weights jsonb;
ALTER TABLE programs ADD COLUMN score_weights jsonb;

CREATE TABLE score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  total numeric(5, 1) NOT NULL,
  components jsonb NOT NULL,
  weights jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, week_start)
);
