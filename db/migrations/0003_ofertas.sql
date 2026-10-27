-- IL Executive Growth — 0003: ofertas, ciclo de 7 estágios (portões editáveis), vendas
-- Estágios (fixos no código): 1 Ideia · 2 Prototipada · 3 Oferta pronta · 4 Em prospecção · 5 Primeira venda · 6 Validada · 7 Escala.
-- Portões (gates) definem o que é exigido para ALCANÇAR cada estágio 2–7; são editáveis por template e por programa.

CREATE TABLE template_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  stage integer NOT NULL CHECK (stage BETWEEN 2 AND 7),
  key text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'vendas')),  -- vendas: avaliado pelo nº de vendas
  threshold integer CHECK (threshold IS NULL OR threshold >= 1),
  required boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  UNIQUE (template_id, key),
  CHECK (kind <> 'vendas' OR threshold IS NOT NULL)
);

CREATE TABLE program_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  stage integer NOT NULL CHECK (stage BETWEEN 2 AND 7),
  key text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'vendas')),
  threshold integer CHECK (threshold IS NULL OR threshold >= 1),
  required boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  UNIQUE (program_id, key),
  CHECK (kind <> 'vendas' OR threshold IS NOT NULL)
);

CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  revenue_slug text NOT NULL,
  name text NOT NULL,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 5),
  problem text NOT NULL,                 -- problema que resolve (portão da Ideia)
  audience text NOT NULL,                -- público (portão da Ideia)
  price_note text,
  wave integer CHECK (wave IS NULL OR wave BETWEEN 1 AND 3),
  due_date date,                         -- prazo da meta de implementação
  target_stage integer NOT NULL DEFAULT 3 CHECK (target_stage BETWEEN 1 AND 7),
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'descartada')),
  status_reason text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (program_id, revenue_slug) REFERENCES program_revenue_sources (program_id, slug)
);
CREATE INDEX offers_program_idx ON offers (program_id);

-- Itens de portão marcados, com evidência. Mentorado marca como 'pendente'; equipe confirma.
CREATE TABLE offer_gate_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  gate_key text NOT NULL,
  evidence text NOT NULL,
  state text NOT NULL CHECK (state IN ('pendente', 'confirmado')),
  checked_by uuid REFERENCES users(id),
  checked_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  UNIQUE (offer_id, gate_key)
);

CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  value_cents bigint NOT NULL CHECK (value_cents > 0),
  sold_at date NOT NULL,
  channel text,
  origin_offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,   -- oferta que originou o lead (grafo "puxa →")
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_offer_idx ON sales (offer_id);
