-- IL Executive Growth — 0012: Conteúdo vira só biblioteca de links (Drive, atividades, assessments) com check "já fiz/acessei".
-- As tabelas de eixos e publicações (0009) ficam no banco, sem uso na interface (nada é apagado).
ALTER TABLE library_links
  ADD COLUMN done boolean NOT NULL DEFAULT false,
  ADD COLUMN done_at timestamptz,
  ADD COLUMN done_by uuid REFERENCES users(id);
