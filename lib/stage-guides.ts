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

/** Exemplos por tipo de oferta (fonte de receita da oferta); sem exemplo específico, vale o genérico do portão. */
const EX: Record<string, Record<string, string>> = {
  "ficha-1-pagina": {
    autoridade: "Público: gestores que querem referência em liderança. Problema: 'tenho resultado, mas ninguém sabe'. Formato: conteúdo semanal + 1 palestra aberta por trimestre.",
    workshops: "Público: gestores de primeira viagem em PMEs. Problema: 'viro o bombeiro do time'. Formato: workshop de 4h, até 20 pessoas.",
    digitais: "Público: RHs de empresas pequenas. Problema: 'não tenho modelo pronto de avaliação'. Formato: kit de planilhas e roteiros para baixar.",
    cursos: "Público: profissionais em transição de carreira. Problema: 'não sei como me apresentar'. Formato: curso online de 4 módulos, 6 horas.",
    recorrencia: "Público: empreendedoras solo. Problema: 'trabalho sozinha e travo'. Formato: comunidade com encontro mensal e plantão de dúvidas.",
    instituicoes: "Público: diretores de escolas. Problema: 'equipe desmotivada e rotatividade alta'. Formato: programa de 3 meses com a equipe gestora.",
    "alto-valor": "Público: donos de empresa de 20 a 100 pessoas. Problema: 'a empresa depende de mim'. Formato: mentoria individual de 6 meses.",
    parcerias: "Público: consultorias que querem adicionar liderança ao portfólio. Formato: licença do método com formação dos consultores.",
    conselhos: "Público: empresas familiares em sucessão. Problema: 'decisões travadas entre gerações'. Formato: participação em reunião trimestral de conselho.",
  },
  preco: {
    autoridade: "Palestra aberta paga por ingresso (R$ 150) ou cachê por convite (R$ 3.000); o objetivo é gerar contatos, então defina a meta de leads por evento.",
    workshops: "Workshop de 4h para 20 pessoas: R$ 4.000 por turma, com custo de R$ 900 e margem de 77%.",
    digitais: "Kit a R$ 97 com custo quase zero por unidade; calcule quantas vendas por mês cobrem seu tempo de criação.",
    cursos: "Curso de R$ 497 à vista ou 12x; considere taxa da plataforma e do cartão (cerca de 10%) antes de calcular a margem.",
    recorrencia: "Mensalidade de R$ 89; defina o ponto de equilíbrio (quantos membros pagam seu tempo e a plataforma) e a taxa de saída esperada.",
    instituicoes: "Projeto por escopo: R$ 18.000 por 3 meses, com horas de preparo, deslocamento e imposto na conta; considere o ciclo de pagamento da instituição.",
    "alto-valor": "Mentoria de 6 meses a R$ 12.000 (R$ 2.000 por mês); cobre menos clientes com mais tempo por cliente, então defina o limite de vagas.",
    parcerias: "Licença anual por consultor (R$ 6.000) + percentual por projeto vendido; defina o que o parceiro paga e o que você entrega.",
    conselhos: "Retainer mensal de R$ 3.500 por empresa, com reuniões e disponibilidade combinadas por contrato.",
  },
  pitch: {
    autoridade: "'Todo mês eu ajudo gestores a destravar o time. Posso te mandar um conteúdo e você me diz se faz sentido conversarmos?'",
    workshops: "'Seus líderes passam o dia apagando incêndio. Em 4 horas, eles saem com um plano para delegar. Posso te mandar a proposta até sexta?'",
    digitais: "'Em 10 minutos você usa o modelo e já tem a avaliação pronta. Quer testar a versão de amostra?'",
    cursos: "'Em 6 horas, você sai com seu discurso profissional pronto e treinado. A primeira aula é gratuita; quer ver?'",
    recorrencia: "'Aqui você não trabalha sozinha: uma vez por mês nos reunimos e cada uma sai com uma ação. Entre e participe do próximo encontro.'",
    instituicoes: "'Sua equipe gestora tem alta rotatividade. Em 3 meses, trabalhamos o clima e a liderança com meta e indicadores. Posso apresentar o escopo à direção?'",
    "alto-valor": "'Se a empresa para quando você sai, o negócio é um emprego. Em 6 meses, construímos o time e os processos para isso mudar. Vamos conversar 30 minutos?'",
    parcerias: "'Você já vende consultoria. Com o nosso método licenciado, você adiciona liderança ao portfólio sem criar do zero.'",
    conselhos: "'Decisões importantes ficam travadas na família. Um conselho trimestral traz neutralidade e acompanhamento. Posso participar de uma reunião como convidado?'",
  },
  "material-entrega": {
    autoridade: "Roteiro de palestra, slides e um material de apoio (checklist) para entregar à plateia em troca do contato.",
    workshops: "Slides, roteiro minuto a minuto, atividades impressas e lista de presença.",
    digitais: "O produto em si (planilhas, modelos), um guia rápido de uso e a página de entrega.",
    cursos: "Aulas gravadas, apostila, exercícios e a trilha na plataforma; grave o módulo 1 primeiro.",
    recorrencia: "Calendário de encontros do trimestre, pauta padrão e regras da comunidade.",
    instituicoes: "Plano do programa por mês, instrumentos de diagnóstico e modelo de relatório para a direção.",
    "alto-valor": "Pasta do mentorado, modelo de plano de ação, calendário de sessões e planilha de acompanhamento.",
    parcerias: "Manual do método, treinamento dos parceiros, kit de materiais e regras de uso da marca.",
    conselhos: "Pauta-padrão de reunião, relatório de acompanhamento e modelo de ata.",
  },
  "canal-aquisicao": {
    autoridade: "LinkedIn: 3 conteúdos por semana e 10 conexões qualificadas por dia, convidando os mais engajados para uma conversa.",
    workshops: "Contato direto com RHs e entidades de classe: 5 mensagens por semana oferecendo uma turma-piloto.",
    digitais: "Distribuição de uma amostra gratuita em redes e listas, com página de captura e acompanhamento por e-mail.",
    cursos: "Aula experimental ao vivo para a rede de contatos e convite ao final.",
    recorrencia: "Convite pessoal para as 20 primeiras pessoas e indicação das fundadoras.",
    instituicoes: "Relacionamento com diretores e mantenedoras; peça apresentação por quem já é cliente.",
    "alto-valor": "Indicação: peça a 5 clientes antigos que apresentem um dono de empresa que passa pelo mesmo problema.",
    parcerias: "Lista de 10 consultorias complementares e uma conversa de 20 minutos com cada uma.",
    conselhos: "Contadores, advogados e bancos que atendem empresas familiares e podem indicar.",
  },
  "metas-semanais": {
    autoridade: "3 publicações, 10 conexões qualificadas e 2 conversas com quem interagiu.",
    workshops: "5 abordagens, 2 reuniões e 1 proposta de turma por semana.",
    digitais: "100 pessoas alcançadas com a amostra, 10 downloads e 1 venda por semana.",
    cursos: "1 aula ao vivo por mês, 30 inscritos e 3 matrículas por turma.",
    recorrencia: "3 convites por semana e 1 novo membro por semana.",
    instituicoes: "2 conversas com diretores e 1 apresentação de escopo por mês (o ciclo é mais longo).",
    "alto-valor": "2 pedidos de indicação, 1 reunião e 1 proposta por semana (poucas contas, alto valor).",
    parcerias: "2 conversas com parceiros e 1 proposta de piloto por mês.",
    conselhos: "1 conversa com um indicador por semana e 1 apresentação por mês.",
  },
};

/** Exemplo do portão adaptado ao tipo de oferta (slug da fonte de receita); cai no exemplo genérico. */
export function guideFor(gateKey: string, revenueSlug: string): GateGuide | undefined {
  const g = GATE_GUIDES[gateKey];
  if (!g) return undefined;
  const ex = EX[gateKey]?.[revenueSlug];
  return ex ? { ...g, example: ex } : g;
}
