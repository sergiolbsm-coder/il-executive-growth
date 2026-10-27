-- IL Executive Growth — 0008: ferramentas iniciais (editáveis pelo admin/direção) e vínculos com os portões do template-base
-- Tipos de campo: text · textarea · number · url · select (options) · checklist (options)
INSERT INTO tools (slug, name, phase, kind, description, fields, external_url, strategic, weight, sort) VALUES
('sintese-profissional', 'Síntese profissional', 'levantamento', 'declarativa',
 'Levanta problemas resolvidos, especialidades, resultados e projetos — a matéria-prima para as ofertas.',
 $j$[
  {"key":"problemas","label":"Quais problemas você ajudou organizações a resolver?","type":"textarea","required":true},
  {"key":"especialidades","label":"Quais são suas maiores especialidades?","type":"textarea","required":true},
  {"key":"resultados","label":"Metas e resultados atingidos (com números)","type":"textarea","required":true},
  {"key":"conquistas","label":"Principais conquistas profissionais","type":"textarea","required":false},
  {"key":"projetos","label":"Principais projetos","type":"textarea","required":false}
 ]$j$::jsonb, NULL, true, 3, 1),

('ficha-oferta', 'Ficha de 1 página da oferta', 'prototipacao', 'declarativa',
 'Protótipo conceitual da oferta: público, problema, solução, proposta de valor, formato e hipótese de validação.',
 $j$[
  {"key":"publico","label":"Público","type":"textarea","required":true},
  {"key":"problema","label":"Problema","type":"textarea","required":true},
  {"key":"solucao","label":"Solução","type":"textarea","required":true},
  {"key":"proposta_valor","label":"Proposta de valor","type":"textarea","required":true},
  {"key":"formato","label":"Formato (palestra, workshop, consultoria, curso, programa…)","type":"text","required":true},
  {"key":"hipotese","label":"Hipótese de validação (como vou testar?)","type":"textarea","required":true}
 ]$j$::jsonb, NULL, true, 3, 2),

('precificacao', 'Precificação', 'prototipacao', 'declarativa',
 'Define o modelo de cobrança, os custos e o preço da oferta.',
 $j$[
  {"key":"modelo","label":"Modelo de cobrança","type":"select","options":["Projeto","Mensalidade","Por turma","Por hora","Licença","Outro"],"required":true},
  {"key":"custos","label":"Custos e esforço envolvidos","type":"textarea","required":true},
  {"key":"preco","label":"Preço","type":"text","required":true},
  {"key":"justificativa","label":"Por que esse preço?","type":"textarea","required":false}
 ]$j$::jsonb, NULL, true, 2, 3),

('roteiro-pitch', 'Roteiro do pitch', 'prototipacao', 'declarativa',
 'Roteiro curto para apresentar a oferta em uma conversa.',
 $j$[
  {"key":"abertura","label":"Abertura (gancho)","type":"textarea","required":true},
  {"key":"problema","label":"O problema que o cliente reconhece","type":"textarea","required":true},
  {"key":"solucao","label":"A solução em uma frase","type":"textarea","required":true},
  {"key":"prova","label":"Prova (resultado, case, número)","type":"textarea","required":false},
  {"key":"chamada","label":"Chamada para a ação","type":"text","required":true}
 ]$j$::jsonb, NULL, false, 1, 4),

('modelo-proposta', 'Modelo de proposta', 'prototipacao', 'declarativa',
 'Estrutura da proposta comercial da oferta.',
 $j$[
  {"key":"escopo","label":"Escopo","type":"textarea","required":true},
  {"key":"entregaveis","label":"Entregáveis","type":"textarea","required":true},
  {"key":"prazo","label":"Prazo","type":"text","required":true},
  {"key":"investimento","label":"Investimento","type":"text","required":true},
  {"key":"condicoes","label":"Condições","type":"textarea","required":false}
 ]$j$::jsonb, NULL, false, 1, 5),

('material-entrega', 'Material de entrega', 'prototipacao', 'declarativa',
 'Registra o material pronto para entregar a oferta (apresentação, roteiro, workbook…).',
 $j$[
  {"key":"tipo","label":"Tipo de material","type":"text","required":true},
  {"key":"link","label":"Link do material","type":"url","required":true},
  {"key":"descricao","label":"Descrição","type":"textarea","required":false}
 ]$j$::jsonb, NULL, false, 1, 6),

('plano-aquisicao', 'Plano de aquisição', 'lancamento', 'declarativa',
 'Canais de aquisição e metas semanais para levar a oferta ao mercado.',
 $j$[
  {"key":"canais","label":"Canais de aquisição (onde vende)","type":"textarea","required":true},
  {"key":"contas_semana","label":"Contas novas por semana","type":"number","required":true},
  {"key":"reunioes_semana","label":"Reuniões por semana","type":"number","required":true},
  {"key":"propostas_semana","label":"Propostas por semana","type":"number","required":false},
  {"key":"abordagem","label":"Abordagem e mensagem","type":"textarea","required":false}
 ]$j$::jsonb, NULL, true, 3, 7),

('checklist-evento', 'Checklist de evento ou grupo fechado', 'lancamento', 'declarativa',
 'Passo a passo para lançar a oferta em um evento, workshop ou grupo fechado.',
 $j$[
  {"key":"data","label":"Data do evento","type":"text","required":true},
  {"key":"meta_participantes","label":"Meta de participantes","type":"number","required":false},
  {"key":"itens","label":"Checklist","type":"checklist","options":["Público e tema definidos","Local ou plataforma","Data e agenda","Material de divulgação","Lista de convidados","Roteiro da apresentação","Coleta de contatos","Follow-up planejado"],"required":false},
  {"key":"observacoes","label":"Observações","type":"textarea","required":false}
 ]$j$::jsonb, NULL, false, 1, 8),

('agenda-editorial', 'Agenda editorial', 'lancamento', 'declarativa',
 'Temas, canais e calendário de conteúdo que sustentam a autoridade.',
 $j$[
  {"key":"temas","label":"Temas centrais","type":"textarea","required":true},
  {"key":"canais","label":"Canais","type":"text","required":true},
  {"key":"calendario","label":"Calendário (semana a semana)","type":"textarea","required":true}
 ]$j$::jsonb, NULL, false, 1, 9),

('registro-depoimento', 'Registro de depoimento', 'transversal', 'declarativa',
 'Guarda um depoimento de cliente como prova social.',
 $j$[
  {"key":"cliente","label":"Cliente","type":"text","required":true},
  {"key":"depoimento","label":"Depoimento","type":"textarea","required":true},
  {"key":"link","label":"Link (vídeo, post, carta)","type":"url","required":false}
 ]$j$::jsonb, NULL, false, 1, 10),

('registro-case', 'Registro de case', 'transversal', 'declarativa',
 'Documenta um case: problema, ação e resultado com indicadores.',
 $j$[
  {"key":"cliente","label":"Cliente","type":"text","required":true},
  {"key":"problema","label":"Problema","type":"textarea","required":true},
  {"key":"acao","label":"O que foi feito","type":"textarea","required":true},
  {"key":"resultado","label":"Resultado (com indicadores)","type":"textarea","required":true}
 ]$j$::jsonb, NULL, true, 2, 11);

INSERT INTO tools (slug, name, phase, kind, description, external_url, strategic, weight, sort) VALUES
('planner-lider', 'Planner do Líder', 'transversal', 'externa',
 'Planejamento e gestão da rotina do líder (Kanban, metas, matriz de prioridade). Abre em outra aba.',
 'https://planner.institutodalideranca.com.br', false, 1, 12);

-- Concluir a ferramenta, numa oferta, comprova estes itens de portão
INSERT INTO tool_gate_links (tool_slug, gate_key) VALUES
  ('ficha-oferta', 'ficha-1-pagina'),
  ('precificacao', 'preco'),
  ('roteiro-pitch', 'pitch'),
  ('modelo-proposta', 'proposta'),
  ('material-entrega', 'material-entrega'),
  ('plano-aquisicao', 'canal-aquisicao'),
  ('plano-aquisicao', 'metas-semanais'),
  ('registro-depoimento', 'depoimento'),
  ('registro-case', 'case');

-- O template-base inclui todas as ferramentas iniciais
INSERT INTO template_tools (template_id, tool_slug)
SELECT t.id, k.slug FROM program_templates t, tools k
WHERE t.name = 'Base IDL — 9 Fontes de Receita' AND t.version = 1;
