# Executive Growth — Sprint 0 (conceito, modelo e plano)

Data: 11/10/2026 · Status: **proposta para validação** — nenhum sistema existente foi alterado, nada foi publicado, nenhum repositório foi criado.

Produto irmão do **IL Career Hub** (recolocação). O Career Hub acompanha *vagas*; o Executive Growth acompanha *ofertas*: produtos e serviços que um executivo/especialista leva da ideia até a escala, dentro de uma mentoria online.

Fontes analisadas (todas locais; Drive não foi usado): cronograma de implementação e estrutura das 9 Receitas da Carol; síntese profissional, posicionamento e Método MOVA da Carol; Pirâmide (modelo de escala do negócio com propósito); infográficos "Método 9 Receitas" da Eliane, da Carol e da Ana Paula; agenda semanal + OPIs/KPIs + PDCA da Eliane; proposta "Mentoria Executiva – Impact Leader" (Smart/Executive/Master/Advisory); Programa Impulso (PUC Angels); contrato-modelo de assessoria. **Nenhum dado pessoal (CPF, RG, endereço, telefone) foi copiado** para este repositório; contratos entram apenas como modelo de cláusulas.

---

## 1. Decisões já tomadas (conversa de 11/10/2026)

| # | Decisão |
|---|---|
| 1 | Três lentes sobre cada mentorado: **9 Receitas** (portfólio), **Escala do Negócio** (pirâmide com propósito) e **ciclo de oferta** (Levantamento → Prototipação → Lançamento). |
| 2 | O ciclo de cada oferta tem 7 estágios: **Ideia → Prototipada → Oferta pronta → Em prospecção → Primeira venda → Validada → Escala**. |
| 3 | A regra de ativação da Carol ("Ativa") equivale a **chegar em Primeira venda** (estágio 5). |
| 4 | **Critérios de cada portão são editáveis por segmento e por modelo de programa.** Os números sugeridos aqui são só o ponto de partida. |
| 4c | **Aplicação separada** (decidido em 26/10/2026): repositório `il-executive-growth`, banco Neon e serviço Render **próprios**, na mesma conta Render. Não compartilha serviço, código nem banco com o Career Hub nem com o Planner. O Planner do Líder entra depois como **ferramenta externa integrada** (seção 3.2). |
| 4a | O sistema é **acompanhamento de mentoria + lançamento de produtos**, com **Caixa de ferramentas** (seção 3.2): ferramentas amarradas a portões **e** avulsas, acessíveis pelo **menu lateral esquerdo** (seção 3.3). Haverá mais ferramentas além da lista inicial. |
| 4b | **Ferramentas-chave liberam novos estágios** para o negócio (estágios da oferta, níveis da pirâmide, ondas, outras ferramentas) — seção 3.5. Regras editáveis por segmento e modelo. |
| 5 | A pirâmide é o **modelo econômico do plano** (volume, ticket, esforço, papel por nível), não uma etiqueta. O propósito fica no topo do plano. |
| 6 | Herdadas do Career Hub: Render, Neon **novo e isolado**, auth no padrão do planner (bcrypt + e-mail de liberação via Resend), papéis admin/direção/mentor/mentorado, auditoria. |

### 1.1 Arquitetura e hospedagem

```
Next.js 16 (App Router, TS estrito) ── Server Actions / Route Handlers (zod)
   │        domains/{mentees,programs,offers,tools,score,cadence,commercial,imports}
   │        lib/{auth,authorization,audit,db,tools,nav}
   ▼
Neon PostgreSQL (projeto novo e isolado) ── Drizzle + migrations SQL versionadas
   RLS por papel (flag RLS_ENABLED, como no Career Hub)   ·   PGlite nos testes
Hospedagem: Render (web service próprio, mesma conta dos demais)
Domínio: growth.institutodalideranca.com.br (a confirmar) via Cloudflare
E-mail: Resend (convite, redefinição de senha, avisos de liberação)
```

- Stack e padrões copiados do Career Hub **em código novo**: shell IDL com sidebar (`lib/nav.ts`), `authorize()` + `requireRole`, auditoria, testes com PGlite, importador idempotente com dry-run. Nenhum import entre repositórios.
- Auth: bcrypt + e-mail de liberação via Resend, admin redefine/reenvia senha (padrão do planner e do Career Hub).
- Plano do Render: o **free hiberna** sem acessos; para uso diário de mentoria, prever plano pago (decisão sua).
- Nada vai ao GitHub, ao Neon ou ao Render sem sua autorização.

---

## 2. Conceito

```
                PROPÓSITO (por programa)
                        │
   ESCALA DO NEGÓCIO ── níveis 1–5: volume · ticket · esforço · papel
                        │
   9 RECEITAS ───────── catálogo de fontes de receita (por modelo/segmento)
                        │
   OFERTA ───────────── produto/serviço concreto: receita + nível + estágio
                        │
   CICLO (7 estágios) ─ portões com evidência, editáveis
                        │
   CADÊNCIA SEMANAL ─── check-in PDCA + KPIs meta × realizado
```

Uma **oferta** pertence a uma receita e a um nível da pirâmide. Uma receita tem várias ofertas. Uma oferta "puxa" outra (palestra → diagnóstico → projeto → advisory) e cada venda registra a oferta de origem do lead.

### 2.1 Escala do Negócio (nível 1 é a base)

Valores do material da Carol; todos editáveis por programa.

| Nível | Nome | Volume | Ticket | Esforço | Papel |
|---|---|---|---|---|---|
| 5 | Influência e legado | Baixo | Muito alto | Muito alto | Influenciar decisões e gerar legado |
| 4 | Escala e crescimento | Baixo a médio | Alto | Alto | Apoiar crescimento e expansão |
| 3 | Transformação organizacional | Médio | Alto | Alto | Transformar instituições |
| 2 | Desenvolvimento de pessoas | Alto | Médio | Médio | Desenvolver pessoas e converter clientes |
| 1 | Autoridade e alcance | Muito alto | Baixo | Baixo/médio | Gerar autoridade e oportunidades |

O que o app calcula a partir daqui:
1. **Decomposição da meta de receita** por nível (clientes/mês × ticket).
2. **Forma da pirâmide**: alerta quando falta base (volume) ou topo.
3. **Capacidade**: soma de esforço das ofertas em construção/entrega vs horas semanais declaradas.

### 2.2 As 9 Receitas — catálogo, não numeração fixa

Os materiais usam **três ordens diferentes** e a Eliane usa nove *linhas de serviço próprias*. Por isso o app guarda **slugs estáveis** dentro de um **catálogo por modelo/segmento**; a numeração é só de exibição.

Catálogo canônico (Carol e Ana Paula):

| Slug | Receita | Nível sugerido |
|---|---|---|
| `autoridade` | Autoridade e marca pessoal | 1 |
| `workshops` | Workshops, palestras e eventos | 1 |
| `digitais` | Produtos digitais | 1 |
| `cursos` | Cursos e treinamentos online | 2 |
| `recorrencia` | Recorrência e comunidade | 2 |
| `instituicoes` | Soluções para instituições | 3 |
| `alto-valor` | Produtos de alto valor | 4 |
| `parcerias` | Parcerias e licenciamento | 4 |
| `conselhos` | Conselhos e advisory | 5 |

Catálogo próprio da Eliane: Liderança Financeira, Gestão por Indicadores, Performance Empresarial, Estruturação Financeira e Governança, Planejamento Financeiro e Orçamentário, CFOaaS, Business Advisory, Formação de Gestores, Educação Executiva.

O mapa de cobertura mostra, por mentorado, quais receitas têm oferta e em que estágio. **Receita sem oferta é lacuna visível**, não erro.

---

## 3. Ciclo da oferta e portões

| Fase | Estágio | Portão de saída (padrão) |
|---|---|---|
| Levantamento | 1. Ideia | Receita e nível definidos; problema e público em 1–2 linhas |
| Prototipação | 2. Prototipada | Ficha de 1 página: público, problema, solução, proposta de valor, formato, hipótese de validação |
| | 3. Oferta pronta | Oferta + **preço** + pitch + proposta + material de entrega |
| Lançamento | 4. Em prospecção | **Canal de aquisição** ativo + metas semanais (contas, reuniões, propostas) |
| | 5. Primeira venda | 1 contrato/pagamento registrado, com oferta/canal de origem · **= "Ativa"** |
| | 6. Validada | *Sugestão:* ≥ 2 clientes pagantes + 1 depoimento + 1 case |
| | 7. Escala | *Sugestão:* entrega replicável + vendas por mais de um canal + meta de receita própria |

Regras:
- O estágio é **derivado**: é o maior estágio cujos itens obrigatórios (e os de todos os anteriores) estão marcados. Marcar um item exige evidência (texto, link ou arquivo) e fica na auditoria.
- Estágio 5 só existe com um registro em `sales`; não se "marca" venda sem lançá-la.
- Pode **voltar** de estágio e **pausar/descartar** com motivo obrigatório. Nada é apagado (remoção é só do admin, com snapshot, como no Career Hub).
- Cada oferta tem **prazo** e **onda**; o app compara estágio esperado × real e marca *no prazo / em risco / atrasada*.

### 3.1 Edição por segmento e modelo

Hierarquia (a camada mais específica vence):

```
template-base IDL  →  template do segmento (educação, finanças, saúde…)
                   →  template do modelo (Smart · Executive · Master · Advisory · Impulso…)
                   →  programa do mentorado (snapshot editável)
```

- Ao criar um programa, o app **copia (snapshot)** catálogo, níveis da pirâmide, portões e KPIs do template. Mudar o template **não altera programas em andamento**; o mentor vê um diff e decide "atualizar".
- Cada portão é um item configurável: rótulo, obrigatório (sim/não), tipo de evidência, peso e **limiar numérico** (ex.: nº de clientes pagantes).
- Quem edita: admin e direção edita templates; mentor edita o programa dos seus mentorados (com autoria e data visíveis só à equipe).

### 3.2 Caixa de ferramentas

Biblioteca de ferramentas do mentorado, acessível de **duas formas**:

- **Amarrada ao portão:** concluir a ferramenta marca o item do portão e anexa o registro como evidência. Ex.: precificação concluída → item "preço" da *Oferta pronta*.
- **Avulsa:** qualquer ferramenta pode ser aberta a qualquer momento pelo menu, com ou sem vínculo a uma oferta, sem exigência de portão. Serve para explorar, refazer e usar fora do ciclo.

Duas famílias de ferramenta, para que **novas ferramentas entrem sem nova migration**:

| Tipo | Como é criada | Exemplos |
|---|---|---|
| **Declarativa** | O admin define campos, seções e regras de conclusão num editor (esquema JSON versionado); o app gera o formulário/checklist/tabela | Síntese profissional, ficha da oferta, roteiro de pitch, modelo de proposta, checklist de evento, agenda semanal, agenda editorial |
| **Nativa** | Componente de código registrado no catálogo (`lib/tools`) | Mapa das 9 Receitas, Escala do Negócio (calculadora), painel de KPIs, pipeline comercial |
| **Externa** *(a decidir)* | Link ou embed, sem dados no app | Diagnóstico de perfil (DISC) do `idl-sistema` |

Ficha de cada ferramenta: slug, nome, fase (levantamento · prototipação · lançamento · transversal), tipo, versão, quem usa (papéis), **quais modelos de programa a incluem** e **quais itens de portão ela comprova** (zero ou mais).

**Ferramentas por modelo.** A proposta da Mentoria Executiva já diferencia Smart / Executive / Master / Advisory pelas ferramentas incluídas (PDL, ferramentas de gestão, diagnósticos de perfil/fit/valores/propósito, LinkedIn, 9 Receitas, planejamento e tomada de decisão). O mesmo mecanismo vale aqui: o template do modelo define **quais ferramentas o mentorado vê**. Ferramenta fora do modelo aparece bloqueada, com o nome do modelo que a libera.

Registros: cada preenchimento é um `tool_entry` (mentorado, oferta opcional, versão da ferramenta, dados, status rascunho/concluída, autor, data). Reabrir cria nova versão; a anterior permanece na auditoria. Exportação (PDF/DOCX/XLSX) fica para o Sprint 3. Cada ferramenta tem peso e a marca "estratégica", que alimenta o Score de Alavancagem (seção 3.4).

**Ferramentas iniciais** (lista aberta — haverá outras):

| Fase | Ferramenta | Tipo | Comprova (portão) |
|---|---|---|---|
| Levantamento | Síntese profissional (problemas resolvidos, especialidades, resultados, projetos) | Declarativa | Ideia |
| Levantamento | Mapa das 9 Receitas | Nativa | Ideia |
| Levantamento | Escala do Negócio e propósito | Nativa | Ideia |
| Levantamento | Diagnóstico de perfil | Externa | — (avulsa) |
| Prototipação | Ficha de 1 página da oferta | Declarativa | Prototipada |
| Prototipação | Precificação | Declarativa | Oferta pronta · preço |
| Prototipação | Roteiro do pitch | Declarativa | Oferta pronta · pitch |
| Prototipação | Modelo de proposta | Declarativa | Oferta pronta · proposta |
| Lançamento | Plano de aquisição (canais, metas semanais) | Declarativa | Em prospecção |
| Lançamento | Agenda semanal e KPIs | Nativa | — (cadência) |
| Lançamento | Checklist de evento / grupo fechado | Declarativa | Em prospecção |
| Lançamento | Agenda editorial | Declarativa | — (avulsa) |
| Lançamento | Pipeline comercial | Nativa | Primeira venda |
| Transversal | Registro de depoimentos e cases | Declarativa | Validada |
| Transversal | Planner do Líder (`planner.institutodalideranca.com.br`) | Externa (integração futura) | — (avulsa; liberada por modelo/estágio) |

### 3.3 Menu lateral (esquerda)

Mesmo padrão do Career Hub: shell IDL com sidebar e um catálogo de itens (`lib/nav.ts`) em que cada item tem rótulo, ícone, rota, papéis e status `ready` / `soon`. Novos painéis e ferramentas entram acrescentando um item.

```
Painel                       (todos)
Score de Alavancagem         (todos; composição e próximo melhor passo)
Mentorados | Meu plano       (mentor: carteira · mentorado: o próprio plano)
Ofertas                      (mapa 9 Receitas × 7 estágios)
Escala do Negócio
Cadência                     (check-in semanal · KPIs)
Comercial                    (pipeline · vendas)
Conteúdo                     (agenda editorial)
Sessões e tarefas
▾ Ferramentas                (grupo expansível)
    Todas as ferramentas
    Levantamento · Prototipação · Lançamento · Transversal
    Favoritas / usadas recentemente
Operação                     (mentor, direção, admin)
    Portões a confirmar · Fila Venture
Administração                (admin)
    Usuários · Templates (programa/segmento/modelo) · Ferramentas (cadastro e editor) · Importações
```

- O grupo **Ferramentas** lista tudo o que o modelo do mentorado inclui, **mesmo as não amarradas a nenhum portão**; a busca é por nome ou fase.
- Dentro de uma oferta, a aba "Portões" abre direto a ferramenta que comprova cada item; o menu e a oferta apontam para o mesmo registro.
- Itens futuros aparecem desabilitados (`soon`), como no Career Hub.

### 3.4 Score de Alavancagem

Quanto **mais informação** o mentorado registra e **mais ferramentas estratégicas** usa, **mais o score sobe**. O score mede o quanto o negócio está *preparado para alavancar*: informação, ferramentas, ofertas e tração em uma nota de 0 a 100, por mentorado e por oferta.

| Componente | O que entra | Peso padrão |
|---|---|---|
| **Informação** | Completude do plano: propósito, síntese, pirâmide, ofertas, campos das ferramentas (campos aplicáveis preenchidos ÷ aplicáveis) | 20 |
| **Ferramentas estratégicas** | Ferramentas concluídas do modelo, ponderadas pelo peso de cada uma (estratégicas pesam mais) ÷ total do modelo | 20 |
| **Ofertas** | Estágio de cada oferta (1–7), ponderado pelo nível da pirâmide (oferta validada em nível alto vale mais que em nível baixo) | 25 |
| **Estrutura** | Receitas prioritárias cobertas, forma da pirâmide equilibrada, ligações "puxa →" ativas e já convertidas | 15 |
| **Tração** | Vendas, KPIs × meta, check-ins em dia | 20 |

Regras para o score ser útil e não virar jogo de preencher campo:
- **Pesos, ferramentas "estratégicas" e limiares são editáveis** por segmento e modelo (mesma hierarquia da seção 3.1).
- **Qualidade conta mais que volume:** campo vazio ou texto de enchimento não pontua (mínimos por campo); ganho com **retorno decrescente** (a 10ª ferramenta pesa menos que a 3ª); reabrir ou duplicar um registro não soma duas vezes.
- **Revisão do mentor:** ferramenta concluída conta parcialmente (padrão 60%) e **integralmente após confirmação do mentor**.
- **Detalhamento sempre visível:** o score mostra o que o compõe e o **"próximo melhor passo"** (a ação que mais o elevaria, com o ganho estimado em pontos).
- **Histórico semanal** (`score_snapshots`, com a versão da configuração usada), para ver a evolução e comparar antes/depois de mudar os pesos.
- **Visibilidade:** mentorado vê o seu e o detalhamento; mentor vê a carteira; comparação entre mentorados é só da equipe, sem ranking público.

Honestidade metodológica (mesmo cuidado do MOVA): é um **índice de prontidão para alavancagem, não uma previsão de receita**. Os pesos iniciais são hipótese e serão calibrados com os pilotos antes de qualquer comparação entre mentorados ser apresentada como benchmark.

### 3.5 Liberação de estágios por ferramenta

Algumas ferramentas são **chaves**: concluí-las **libera novos estágios para o negócio**. Hoje o estágio de uma oferta é *derivado* dos itens de portão; a liberação acrescenta uma camada de **progressão da jornada**: o mentorado vê o que ainda está bloqueado, o que falta para abrir e o que acabou de abrir.

Dois tipos de ligação entre ferramenta e portão, que não se confundem:

| Ligação | Efeito |
|---|---|
| **Comprova** (seção 3.2) | Marca um item do portão, com a evidência |
| **Libera** (esta seção) | Torna **disponível** um estágio, um nível da pirâmide, uma onda ou outra ferramenta |

O que uma chave pode liberar (suposição minha sobre "estágios para o negócio" — confirmar):
- **Estágios do ciclo de uma oferta.** Ex.: *Em prospecção* só abre com Plano de aquisição + Precificação concluídos.
- **Níveis da pirâmide.** Ex.: níveis 4 e 5 (Escala e Influência) abrem depois de ofertas validadas nos níveis de base.
- **Ondas do cronograma** (vender e validar → aumentar ticket → recorrência).
- **Novas ferramentas** (progressão de ferramentas, não só de estágios).

Regras de liberação (tipos, todas editáveis por segmento e modelo, como os portões):
- ferramenta concluída (opcionalmente **já revisada pelo mentor**);
- **Score de Alavancagem** mínimo (seção 3.4);
- estágio mínimo de N ofertas (ex.: 2 ofertas em *Validada*);
- liberação manual pelo mentor, com justificativa e registro na auditoria.

Comportamento: estágio ou ferramenta **bloqueada continua visível**, com o motivo e a lista do que falta; ao liberar, o app registra um evento e destaca a novidade no painel e no menu. Dois bloqueios distintos na interface: **por modelo** (a ferramenta não faz parte do programa contratado) e **por jornada** (ainda não cumpriu a chave).

---

## 4. Cadência semanal

Camada operacional, importada do modelo da Eliane (meta × realizado, PDCA) e generalizada.

- **Check-in semanal (15 min, sexta):** Plan / Do / Check / Act por oferta, com semáforo e 3 perguntas fixas (qual objeção apareceu, qual conteúdo engajou, o que travou).
- **KPIs por semana → mês → total, com % da meta.** Conjunto padrão (editável): posts, artigos, comentários estratégicos, interações, novas conexões qualificadas, vídeos, contatos WhatsApp, e-mails, cafés estratégicos, eventos, palestras, reuniões agendadas/realizadas, diagnósticos, propostas, contratos, receita.
- **Indicadores antecedentes por receita** (ex.: autoridade → convites e reuniões diagnósticas; workshops → reuniões e diagnósticos). Vêm do material da Carol.
- **Taxa de conversão** calculada, com divisão por zero tratada (a planilha atual mostra `#DIV/0!`).
- **Agenda editorial** (a de 12 publicações da Carol é o template) e **pipeline comercial** (conta → decisor → reunião → proposta → contrato) ligados à oferta.

---

## 5. Modelo de dados v0 (para revisão)

Mesma convenção do Career Hub (tabelas em inglês, enums em pt-BR no domínio).

| Grupo | Tabelas |
|---|---|
| Identidade | `users`, `sessions`, `profiles(role: admin·direcao·mentor·mentorado)`, `mentor_assignments` (N mentores por mentorado) |
| Templates | `program_templates(segment, model, version)`, `template_revenue_sources`, `template_pyramid_levels`, `template_gates`, `template_kpis` |
| Programa | `mentees`, `programs(tier, start, end, purpose, weekly_hours)`, `program_revenue_sources`, `program_pyramid_levels`, `program_gates`, `program_kpis` |
| Ofertas | `offers(revenue_source, level, stage, wave, due, price, status)`, `offer_gate_checks(evidence, by, at)`, `offer_links(from, to, planned, realized_rate)`, `offer_events` |
| Ferramentas | `tools(slug, kind: declarativa·nativa·externa, phase, schema_json, version)`, `tool_versions`, `template_tools` (ferramentas incluídas por modelo), `tool_gate_links(tool, gate_key)`, `tool_entries(mentee, offer?, tool_version, data, status, by, at)` |
| Liberação | `unlock_rules(scope: template·program, trigger: tool·score·stage_count·manual, target_kind: stage·level·wave·tool, target_ref, params)`, `unlock_events(program, rule, offer?, at, by)` |
| Score | `template_score_config(weights, strategic_tools, thresholds)`, `program_score_config`, `score_snapshots(program, offer?, week, total, components_json, config_version)` |
| Comercial | `accounts`, `pipeline_items`, `sales(offer, origin_offer, channel, value, date)` |
| Cadência | `weekly_checkins`, `kpi_entries(week, kpi, target, actual)`, `content_items` |
| Sessões | `mentoring_sessions` (ata, decisões), `tasks` |
| Venture | `venture_candidates(offer, status, notes)` — apenas avaliação interna, sem promessa |
| Transversal | `activity_log`, `imports` / `import_rows` (reuso do importador do Career Hub) |

Índices: `(program_id, stage)`, `(mentee_id)`, `(offer_id, week)`. RLS por papel, igual ao Career Hub (flag `RLS_ENABLED`).

---

## 6. Perfis e visibilidade

| Papel | Vê / faz |
|---|---|
| admin | Tudo; edita templates; remove registros; redefine senhas |
| direção | Leitura global; edita templates e programas |
| mentor | Mentorados atribuídos (todos/alguns, definido pelo admin); edita programa, ofertas, portões |
| mentorado | O próprio plano; preenche check-in e KPIs; marca portões com evidência (**sujeito a confirmação do mentor**) |

Notas internas do mentor nunca entram no DTO do mentorado.

---

## 7. Plano por sprints

| Sprint | Entregas | Critério de saída |
|---|---|---|
| **0** (este) | Conceito, modelo, decisões | Seção 9 respondida |
| **1** | Repositório e Neon novos, auth, papéis, shell IDL, mentorados e programas, catálogo e pirâmide editáveis, **ofertas com ciclo de 7 estágios e portões**, mapa das 9 Receitas, **menu lateral e Caixa de ferramentas (motor de ferramentas declarativas + 4–5 ferramentas iniciais amarradas aos portões)**, **Score de Alavancagem v1** (informação + ferramentas + ofertas, calculado na hora, com detalhamento e "próximo melhor passo"), **liberação de estágios por ferramenta-chave** (regras `tool` e `manual`; `score` e `stage_count` no Sprint 3) | Piloto Carol: plano de 9 ofertas carregado; estágio derivado e "no prazo/atrasada" corretos |
| **2** | Check-in semanal, KPIs meta × realizado, importador da planilha da Eliane, painel do mentor | Piloto Eliane: 1 mês de KPIs reconciliado |
| **3** | Pipeline comercial, vendas com origem, grafo "puxa →", agenda editorial, decomposição de receita pela pirâmide, alerta de capacidade | Meta de receita decomposta por nível para um programa real |
| **4** | Modo evento (checklist de lançamento — piloto Ana Paula, evento de 7/11), fila Venture, portal do mentorado completo, testes E2E, backup/restauração | Critérios de aceite fechados com os 3 pilotos |

Observação de prazo: o evento da Ana Paula é daqui a ~4 semanas, antes do fim do Sprint 3. Se o evento for prioridade, o **modo evento** pode ser antecipado como checklist simples dentro do Sprint 1.

---

## 8. Riscos e inconsistências encontrados nos materiais

1. **Numerações divergentes das 9 Receitas** (3 ordens + catálogo próprio da Eliane) → resolvido com slugs e catálogos (seção 2.2).
2. **"Receita 01–09" do cronograma da Carol são ofertas**, não categorias. Sugestão: renomear a coluna para "Oferta" e acrescentar "Receita (categoria)".
3. **Palestras:** tabela diz "2 realizadas", texto diz "2 vendidas".
4. **Outubro/26 concentra** portfólio, 4 diagnósticos, 2 palestras e prospecção de 20 contas/semana em ~20 dias restantes.
5. **Gestão 5.0** aparece como diagnóstico (nível 3) na pirâmide e como formação (nível 2) no cronograma → tratar como duas ofertas.
6. **Roadmap to Your Future** está no nível 1 (volume) mas na onda "aumentar ticket"; e a meta mistura B2C e B2B ("5 participantes ou 1 escola/mês") → separar.
7. **Ausência de valores:** o cronograma não tem ticket nem receita-meta (a Eliane tem R$ 30 mil/mês).
8. **Conversão 20 contas → 3 reuniões (15%)** é ~2× a taxa de 7,8% da planilha da Eliane → calibrar nas primeiras semanas.
9. **Sem horas/semana declaradas** → campo `weekly_hours` e alerta de capacidade.
10. **Sobreposição Diagnóstico 5.0 × MOVA** (dimensões muito próximas). Hipótese: 5.0 = versão escolar do MOVA, mesmo instrumento adaptado. Decisão da Carol.
11. **"Temas Chocolate"** (material da Carol) sem definição clara → tratar como tag de tema de palestra até esclarecer.
12. **Ana Paula (psicóloga):** o app acompanha o *negócio* dela; **nunca** registrar dados clínicos de pacientes (LGPD). Campo livre com aviso e revisão no onboarding.
13. **Contratos** contêm identificadores pessoais → só modelo de cláusulas, nunca fixture.

---

## 9. Decisões pendentes

1. **Escopo de abril (Carol):** a meta é "9 ofertas estruturadas" ou "9 receitas cobertas"? (muda se Produtos digitais, Comunidade e Parcerias entram no cronograma).
2. **Catálogo:** confirmar canônico como template e catálogo próprio para a Eliane.
3. **Níveis como agrupamento principal** do painel (A/B/C vira tag secundária ou sai).
4. **Pirâmide:** mesma para todos os mentorados (rótulos próprios) ou versões diferentes por programa?
5. **Subdomínio** (sugestão: `growth.institutodalideranca.com.br`) e nome final do produto.
6. **Mentorado edita?** Recomendo: preenche check-in e marca portões com evidência; mentor confirma.
7. **Valores dos portões Validada/Escala** por segmento (usar as sugestões da seção 3 como ponto de partida).
8. **Repositório:** criar `sergiolbsm-coder/il-executive-growth` privado, projeto Neon novo e serviço Render — só com sua autorização; nada será enviado antes. (Decidido: serviço separado, seção 1.1.)
9. **Dois níveis de templates** (segmento e modelo) já na Sprint 1, ou só um template por modelo no início?
10. **Ferramentas:** quais outras ferramentas entram (lista completa) e quais já existem em planilha/documento para virar template? O diagnóstico de perfil (DISC) do `idl-sistema` entra como link externo ou é integrado?
11. **Quem cria ferramentas declarativas:** só admin, ou direção também? E o mentor pode criar uma ferramenta só para o seu mentorado?
12. **Score de Alavancagem:** os pesos padrão da seção 3.4 servem como ponto de partida? Quais ferramentas são marcadas como "estratégicas"? O mentorado vê o próprio score e o detalhamento?
13. **Liberação:** o bloqueio é **rígido** (não dá para iniciar o estágio sem a chave) ou **orientativo** (aviso, mas o mentor pode seguir)? Quais ferramentas são chaves e o que cada uma libera (estágio da oferta, nível da pirâmide, onda, outra ferramenta)?
