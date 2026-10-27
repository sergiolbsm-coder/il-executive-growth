# IL Executive Growth

Acompanhamento de mentoria online e lançamento de ofertas — Instituto da Liderança.
Conceito, modelo de dados e plano: [`docs/SPRINT-0.md`](docs/SPRINT-0.md).

**Stack:** Next.js 16 (App Router, TS estrito) · Drizzle · Neon PostgreSQL (produção) / PGlite (dev e testes) · zod · Resend.

## Rodar localmente

```bash
npm install
npm run seed:dev     # dados SINTÉTICOS + credenciais em .data/dev-credentials.txt (recusa rodar com DATABASE_URL)
npm run dev -- -p 3120
npm test             # autorização, templates, snapshot de programas, auditoria (PGlite em memória)
npm run typecheck
```

Sem `DATABASE_URL` o app usa PGlite em `.data/pglite`. Migrations em `db/migrations/*.sql` são aplicadas ao conectar.
Primeiro administrador em produção: `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` + `npm run admin:create`.

## Estado (Sprint 1, passos 1 e 2)

Pronto: login e troca obrigatória de senha, papéis (admin · direção · mentor · mentorado), mentorados (com/sem acesso),
atribuição de mentores, templates (base IDL: 9 fontes de receita + Escala do Negócio, derivação por segmento/modelo),
programas com **snapshot** do template, auditoria, menu lateral.
**Ofertas:** ciclo de 7 estágios (Ideia → Prototipada → Oferta pronta → Em prospecção → Primeira venda → Validada → Escala)
derivado de **portões editáveis** por template e por programa; marcação com evidência (mentorado marca como pendente, equipe confirma);
vendas com origem (estágio 5+ só com venda registrada); prazo (cumprida / no prazo / em risco / atrasada);
mapa das receitas × estágios e medidores da meta.
Próximo: edição de templates/portões pela interface, Caixa de ferramentas, Score de Alavancagem, liberação por ferramenta-chave, check-in e KPIs semanais.

## Regras

- Sem dados reais em fixtures/seed. Contratos entram só como modelo de cláusulas (nunca CPF/RG).
- Nunca registrar dados clínicos de pacientes (mentora psicóloga) — acompanha-se o negócio, não o consultório.
- Nada vai ao GitHub/Neon/Render sem autorização.
