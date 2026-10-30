-- IL Executive Growth — 0013: quadro (kanban) de estratégia de vendas, um por oferta.
-- Cartões = tipos de cliente ou tipos de demanda (perfis, nunca pessoas ou empresas específicas); colunas = etapas do funil.
CREATE TABLE offer_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cliente', 'demanda')),
  title text NOT NULL,
  description text,                       -- quem é / o que pede / objeção comum
  approach text,                          -- o que fazer/dizer nesta etapa (roteiro, argumento, pergunta-chave)
  objection text,                         -- objeção provável e a resposta
  material_url text,                      -- material de apoio (link)
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baixa')),
  stage text NOT NULL DEFAULT 'primeiro_contato'
    CHECK (stage IN ('primeiro_contato', 'apresentacao', 'fechamento', 'aquecimento', 'perdido', 'concluido')),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX offer_cards_offer_idx ON offer_cards (offer_id, stage);

-- Lições aprendidas: perguntas e respostas registradas nos cartões das colunas Perdido e Concluído (quantas forem necessárias).
CREATE TABLE offer_card_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES offer_cards(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX offer_card_lessons_card_idx ON offer_card_lessons (card_id, created_at);
