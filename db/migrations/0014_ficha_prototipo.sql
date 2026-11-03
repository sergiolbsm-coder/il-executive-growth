-- IL Executive Growth — 0014: a ficha da oferta ganha o protótipo (tipo + link), opcional
UPDATE tools
SET fields = fields || $j$[
  {"key":"tipo_prototipo","label":"Tipo de protótipo (opcional)","type":"select","options":["Apresentação comercial","Formulário","Assessment","Site / página","MVP","Outro"],"required":false},
  {"key":"link_prototipo","label":"Link do protótipo (opcional)","type":"url","required":false}
]$j$::jsonb
WHERE slug = 'ficha-oferta'
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'key' = 'tipo_prototipo');
