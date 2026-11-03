/**
 * Orientação didática de cada estágio e de cada portão (chave estável do template-base).
 * Fica no código — não altera os portões, então vale para os programas já criados.
 * Portões criados à mão, sem texto aqui, aparecem sem o "Como fazer".
 */
export type StageGuide = {
  goal: string;
  steps: string[];
  deliverable: string;
};

export type GateGuide = {
  how: string[];
  example?: string;
  evidence: string;
  tool?: string;
};

export const STAGE_GUIDES: Record<number, StageGuide> = {
  2: {
    goal: "Transformar a ideia em algo que dê para explicar em uma página, para alguém que não te conhece entender.",
    steps: [
      "Escolha UM público específico (quem exatamente tem o problema).",
      "Escreva o problema com as palavras que o cliente usa, não as suas.",
      "Descreva a solução e o formato (palestra, workshop, consultoria, programa…).",
      "Defina como você vai testar se existe interesse real.",
    ],
    deliverable: "Ficha de 1 página da oferta.",
  },
  3: {
    goal: "Deixar a oferta pronta para ser vendida: preço, discurso, proposta e material para entregar.",
    steps: [
      "Calcule custos e esforço e defina o preço (use a calculadora de precificação).",
      "Escreva o pitch de 1 minuto: problema, solução, prova, chamada para ação.",
      "Monte o modelo de proposta: escopo, entregáveis, prazo e investimento.",
      "Prepare o material que será entregue (slides, roteiro, modelo, trilha).",
    ],
    deliverable: "Preço, pitch, modelo de proposta e material de entrega.",
  },
  4: {
    goal: "Colocar a oferta na rua: escolher por onde os clientes chegam e criar uma rotina semanal de prospecção.",
    steps: [
      "Escolha 1 canal principal (indicação, LinkedIn, evento, rede de contatos, parceiros).",
      "Liste os primeiros contatos-alvo (perfis de cliente, sem dados sensíveis).",
      "Defina metas semanais: contas abordadas, reuniões e propostas enviadas.",
      "Registre o que aprender no quadro da Estratégia de vendas.",
    ],
    deliverable: "Canal ativo e metas semanais definidas.",
  },
  5: {
    goal: "Fechar a primeira venda. Ela prova que alguém paga pelo que você oferece.",
    steps: [
      "Priorize as reuniões e propostas que estão mais perto de fechar.",
      "Faça o acompanhamento de cada proposta enviada (retorno em até 3 dias).",
      "Ao fechar, registre a venda na própria oferta (cliente, valor, canal).",
    ],
    deliverable: "Primeira venda registrada na oferta.",
  },
  6: {
    goal: "Confirmar que a venda se repete e reunir provas (clientes pagantes, depoimento e case).",
    steps: [
      "Busque o segundo cliente pagante usando o que funcionou na primeira venda.",
      "Peça um depoimento curto ao primeiro cliente, logo após a entrega.",
      "Documente um case: situação, o que foi feito, resultado.",
    ],
    deliverable: "Clientes pagantes, depoimento e case.",
  },
  7: {
    goal: "Fazer a oferta crescer sem depender só de você: entrega repetível, mais de um canal e meta de receita.",
    steps: [
      "Escreva o passo a passo da entrega para ela poder ser repetida ou delegada.",
      "Teste um segundo canal de vendas.",
      "Defina a meta de receita da oferta e acompanhe.",
    ],
    deliverable: "Entrega replicável, vendas por mais de um canal e meta de receita.",
  },
};

export const GATE_GUIDES: Record<string, GateGuide> = {
  "ficha-1-pagina": {
    how: [
      "Público: descreva quem é (cargo, porte da empresa, momento de vida) e o que o incomoda.",
      "Problema: a dor em uma frase que o próprio cliente diria.",
      "Solução e proposta de valor: o que muda para ele depois de contratar você.",
      "Formato: palestra, workshop, consultoria, curso ou programa; duração e entrega.",
      "Hipótese de validação: com quem vai conversar e o que precisa ouvir para confirmar o interesse.",
    ],
    example: "Público: gestores de primeira viagem em PMEs. Problema: 'viro o bombeiro do time e não sobra tempo para liderar'. Hipótese: 3 de 5 gestores abordados querem uma conversa.",
    evidence: "Cole o texto da ficha ou o link do documento.",
    tool: "ficha-oferta",
  },
  preco: {
    how: [
      "Liste custos (seu tempo, ferramentas, deslocamento) e o esforço de preparo e entrega.",
      "Escolha o modelo de cobrança: projeto, mensalidade, turma, hora ou licença.",
      "Teste o preço na calculadora de precificação e compare com o valor que o cliente recebe.",
    ],
    example: "Workshop de 4h para 20 pessoas: preço por turma de R$ 4.000, com custo de R$ 900 e margem de 77%.",
    evidence: "Informe o preço e o modelo de cobrança (ex.: 'R$ 4.000 por turma').",
    tool: "precificacao",
  },
  pitch: {
    how: [
      "Abertura: uma pergunta ou dado que prenda a atenção em 10 segundos.",
      "Problema que o cliente reconhece, solução em uma frase e uma prova (resultado ou case).",
      "Chamada para ação clara: 'posso te mandar uma proposta até sexta?'.",
      "Treine em voz alta até caber em 1 minuto.",
    ],
    evidence: "Cole o roteiro ou o link de um áudio/vídeo do pitch.",
    tool: "roteiro-pitch",
  },
  proposta: {
    how: [
      "Escopo: o que está e o que não está incluído.",
      "Entregáveis, prazo e investimento, com condições de pagamento.",
      "Deixe um espaço para personalizar o nome do cliente e o contexto dele.",
    ],
    evidence: "Cole o link do modelo de proposta (Drive ou PDF).",
    tool: "modelo-proposta",
  },
  "material-entrega": {
    how: [
      "Liste o que o cliente recebe: slides, roteiro, trilha, modelos, planilhas.",
      "Monte a primeira versão. Basta usar, não precisa estar perfeito.",
      "Revise com alguém de confiança antes da primeira entrega.",
    ],
    evidence: "Cole o link da pasta ou do material.",
    tool: "material-entrega",
  },
  "canal-aquisicao": {
    how: [
      "Escolha o canal em que seu público já está e onde você já tem alguma credibilidade.",
      "Defina a primeira ação (ex.: mensagem para 10 contatos da sua rede).",
      "Marque a data de início e registre o canal.",
    ],
    evidence: "Descreva o canal e a primeira ação feita (com data).",
    tool: "plano-aquisicao",
  },
  "metas-semanais": {
    how: [
      "Defina números realistas por semana: contas abordadas, reuniões, propostas enviadas.",
      "Reserve horários fixos na agenda para prospectar.",
      "Revise as metas nas sessões com o mentor.",
    ],
    example: "5 abordagens, 2 reuniões e 1 proposta por semana.",
    evidence: "Informe as metas semanais definidas.",
    tool: "plano-aquisicao",
  },
  "primeira-venda": {
    how: ["Registre a venda na seção 'Vendas' desta oferta (cliente, valor, canal). O item é marcado automaticamente."],
    evidence: "Automático: contado a partir das vendas registradas.",
  },
  "clientes-pagantes": {
    how: ["Registre cada nova venda na seção 'Vendas'. O item conta os clientes pagantes sozinho."],
    evidence: "Automático: contado a partir das vendas registradas.",
  },
  depoimento: {
    how: [
      "Peça logo após a entrega, quando o resultado está fresco.",
      "Facilite: mande 3 perguntas curtas (antes, o que mudou, recomendaria?).",
      "Obtenha a autorização para usar o nome e o texto.",
    ],
    evidence: "Cole o depoimento (ou o link) e confirme a autorização.",
    tool: "registro-depoimento",
  },
  case: {
    how: [
      "Situação do cliente antes, o que foi feito, resultado com números.",
      "Use o nome do cliente apenas com autorização; senão, anonimize.",
    ],
    evidence: "Cole o texto do case ou o link do documento.",
    tool: "registro-case",
  },
  "entrega-replicavel": {
    how: [
      "Escreva o passo a passo da entrega, com tempos e materiais.",
      "Identifique o que só você faz e o que outra pessoa poderia fazer.",
    ],
    evidence: "Cole o link do roteiro/processo da entrega.",
  },
  "multiplos-canais": {
    how: [
      "Teste um segundo canal por 4 semanas com metas próprias.",
      "Registre em cada venda o canal de origem.",
    ],
    evidence: "Informe os canais que geraram vendas.",
  },
  "meta-receita": {
    how: [
      "Defina quanto essa oferta deve faturar por mês ou trimestre.",
      "Desdobre em número de clientes e propostas necessárias.",
    ],
    evidence: "Informe a meta (valor e prazo).",
  },
};
