-- IL Executive Growth — 0004: portões padrão do template-base (pontos de partida — editáveis por segmento/modelo)
INSERT INTO template_gates (template_id, stage, key, label, kind, threshold, required, sort)
SELECT t.id, v.stage, v.key, v.label, v.kind, v.threshold, true, v.sort
FROM program_templates t,
     (VALUES
       (2, 'ficha-1-pagina',     'Ficha de 1 página: público, problema, solução, proposta de valor, formato e hipótese de validação', 'manual', NULL::int, 1),
       (3, 'preco',              'Preço definido',                                    'manual', NULL, 2),
       (3, 'pitch',              'Pitch pronto',                                      'manual', NULL, 3),
       (3, 'proposta',           'Modelo de proposta pronto',                         'manual', NULL, 4),
       (3, 'material-entrega',   'Material de entrega pronto',                        'manual', NULL, 5),
       (4, 'canal-aquisicao',    'Canal de aquisição ativo',                          'manual', NULL, 6),
       (4, 'metas-semanais',     'Metas semanais definidas (contas, reuniões, propostas)', 'manual', NULL, 7),
       (5, 'primeira-venda',     'Primeira venda registrada',                         'vendas', 1,    8),
       (6, 'clientes-pagantes',  'Clientes pagantes (mínimo)',                        'vendas', 2,    9),
       (6, 'depoimento',         'Depoimento registrado',                             'manual', NULL, 10),
       (6, 'case',               'Case documentado',                                  'manual', NULL, 11),
       (7, 'entrega-replicavel', 'Entrega replicável',                                'manual', NULL, 12),
       (7, 'multiplos-canais',   'Vendas por mais de um canal',                       'manual', NULL, 13),
       (7, 'meta-receita',       'Meta de receita própria definida',                  'manual', NULL, 14)
     ) AS v(stage, key, label, kind, threshold, sort)
WHERE t.name = 'Base IDL — 9 Fontes de Receita' AND t.version = 1;
