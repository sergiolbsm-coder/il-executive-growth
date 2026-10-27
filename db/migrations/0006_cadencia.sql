-- IL Executive Growth — 0006: cadência semanal (KPIs meta × realizado e check-in PDCA)
-- Semana = segunda-feira (week_start). KPIs editáveis por template e por programa (snapshot).
CREATE TABLE template_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  grp text NOT NULL DEFAULT 'Prospecção',
  weekly_target numeric(10, 2) CHECK (weekly_target IS NULL OR weekly_target >= 0),
  sort integer NOT NULL DEFAULT 0,
  UNIQUE (template_id, key)
);

CREATE TABLE program_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  grp text NOT NULL DEFAULT 'Prospecção',
  weekly_target numeric(10, 2) CHECK (weekly_target IS NULL OR weekly_target >= 0),
  sort integer NOT NULL DEFAULT 0,
  UNIQUE (program_id, key)
);

CREATE TABLE kpi_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  kpi_key text NOT NULL,
  actual numeric(12, 2) NOT NULL CHECK (actual >= 0),
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, week_start, kpi_key)
);
CREATE INDEX kpi_entries_program_week_idx ON kpi_entries (program_id, week_start);

CREATE TABLE weekly_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  plan text,            -- P: o que planejei
  done text,            -- D: o que fiz
  result text,          -- C: resultado real
  adjust text,          -- A: ajuste para a próxima semana
  objection text,       -- objeção mais frequente
  best_content text,    -- conteúdo que mais engajou
  blocker text,         -- o que travou
  traffic text CHECK (traffic IS NULL OR traffic IN ('verde', 'amarelo', 'vermelho')),
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, week_start)
);

-- KPIs padrão do template-base (pontos de partida; metas semanais editáveis)
INSERT INTO template_kpis (template_id, key, label, grp, weekly_target, sort)
SELECT t.id, v.key, v.label, v.grp, v.target, v.sort
FROM program_templates t,
     (VALUES
       ('posts-linkedin',      'Publicações no LinkedIn',            'Prospecção', 3,  1),
       ('artigos',             'Artigos / newsletter',               'Prospecção', 1,  2),
       ('comentarios',         'Comentários estratégicos',           'Prospecção', 10, 3),
       ('conexoes',            'Novas conexões qualificadas',        'Prospecção', 20, 4),
       ('contatos-diretos',    'Contatos diretos (e-mail/WhatsApp)', 'Prospecção', 10, 5),
       ('reunioes-agendadas',  'Reuniões agendadas',                 'Prospecção', 5,  6),
       ('reunioes-realizadas', 'Reuniões realizadas',                'Prospecção', 3,  7),
       ('eventos',             'Eventos / palestras',                'Expansão',   1,  8),
       ('diagnosticos',        'Diagnósticos realizados',            'Expansão',   1,  9),
       ('propostas',           'Propostas enviadas',                 'Fechamento', 2,  10),
       ('contratos',           'Contratos fechados',                 'Fechamento', 1,  11)
     ) AS v(key, label, grp, target, sort)
WHERE t.name = 'Base IDL — 9 Fontes de Receita' AND t.version = 1;
