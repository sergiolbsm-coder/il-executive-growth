-- IL Executive Growth — 0011: remove o link externo do Planner do Líder da caixa de ferramentas
-- (o ON DELETE CASCADE limpa program_tools, template_tools e tool_gate_links; ferramentas externas não têm entradas).
DELETE FROM tools WHERE slug = 'planner-lider';
