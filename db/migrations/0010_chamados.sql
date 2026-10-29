-- IL Executive Growth — 0010: chamados (pedidos de ajuda / dúvidas sobre funcionalidades) do mentorado à equipe
CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer GENERATED ALWAYS AS IDENTITY,
  mentee_id uuid NOT NULL REFERENCES mentees(id) ON DELETE CASCADE,
  opened_by uuid REFERENCES users(id),
  kind text NOT NULL CHECK (kind IN ('ajuda', 'duvida', 'problema', 'sugestao')),
  area text NOT NULL,                    -- funcionalidade (chave de lib/support.ts)
  title text NOT NULL,
  description text,
  page_path text,                        -- tela de onde o pedido partiu
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'resolvido')),
  assigned_to uuid REFERENCES users(id),
  solution text,                         -- resposta/solução final (alimenta o painel de dúvidas)
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_mentee_idx ON support_tickets (mentee_id);
CREATE INDEX support_tickets_status_idx ON support_tickets (status, area);

CREATE TABLE support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id),
  body text NOT NULL,
  internal boolean NOT NULL DEFAULT false,   -- nota interna da equipe: NUNCA vai ao mentorado
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_ticket_idx ON support_messages (ticket_id, created_at);
