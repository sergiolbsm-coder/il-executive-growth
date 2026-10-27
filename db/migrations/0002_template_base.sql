-- IL Executive Growth — 0002: template-base IDL (9 Fontes de Receita + Escala do Negócio)
-- Conteúdo metodológico (sem dados de pessoas). Ordem de exibição = sort; identificação por slug.
INSERT INTO program_templates (name, segment, model, notes)
VALUES ('Base IDL — 9 Fontes de Receita', 'geral', 'base',
        'Template-base: catálogo canônico das 9 fontes de receita e os 5 níveis da Escala do Negócio. Segmentos e modelos derivam dele.');

INSERT INTO template_revenue_sources (template_id, slug, name, level, sort, role)
SELECT t.id, v.slug, v.name, v.level, v.sort, v.role
FROM program_templates t,
     (VALUES
       ('autoridade',   'Autoridade e marca pessoal',        1, 1, 'Visibilidade e reputação'),
       ('workshops',    'Workshops, palestras e eventos',    1, 2, 'Porta de entrada'),
       ('digitais',     'Produtos digitais',                 1, 3, 'Captação e nutrição'),
       ('cursos',       'Cursos e treinamentos online',      2, 4, 'Escala'),
       ('recorrencia',  'Recorrência e comunidade',          2, 5, 'Relacionamento contínuo'),
       ('instituicoes', 'Soluções para instituições',        3, 6, 'Receita principal'),
       ('alto-valor',   'Produtos de alto valor',            4, 7, 'Ticket premium'),
       ('parcerias',    'Parcerias e licenciamento',         4, 8, 'Distribuição e escala'),
       ('conselhos',    'Conselhos e advisory',              5, 9, 'Recorrência premium')
     ) AS v(slug, name, level, sort, role)
WHERE t.name = 'Base IDL — 9 Fontes de Receita' AND t.version = 1;

INSERT INTO template_pyramid_levels (template_id, level, name, volume, ticket, effort, role)
SELECT t.id, v.level, v.name, v.volume, v.ticket, v.effort, v.role
FROM program_templates t,
     (VALUES
       (1, 'Autoridade e alcance',            'Muito alto',   'Baixo',      'Baixo / médio', 'Gerar autoridade e oportunidades'),
       (2, 'Desenvolvimento de pessoas',      'Alto',         'Médio',      'Médio',         'Desenvolver pessoas e converter clientes'),
       (3, 'Transformação organizacional',    'Médio',        'Alto',       'Alto',          'Transformar instituições'),
       (4, 'Escala e crescimento',            'Baixo a médio','Alto',       'Alto',          'Apoiar crescimento e expansão'),
       (5, 'Influência e legado',             'Baixo',        'Muito alto', 'Muito alto',    'Influenciar decisões e gerar legado')
     ) AS v(level, name, volume, ticket, effort, role)
WHERE t.name = 'Base IDL — 9 Fontes de Receita' AND t.version = 1;
