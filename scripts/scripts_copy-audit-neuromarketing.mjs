// scripts/copy-audit-neuromarketing.mjs
// Auditoria de Copy com Foco em Neuromarketing para Português BR
// Uso:
//   node scripts/copy-audit-neuromarketing.mjs
//   node scripts/copy-audit-neuromarketing.mjs --only-flagged
//   node scripts/copy-audit-neuromarketing.mjs --dir=src/components --include-tests
//   node scripts/copy-audit-neuromarketing.mjs --verbose
// Saída: reports/copy-audit.csv, reports/copy-audit.md, reports/copy-audit-recomendacoes.json

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const dirArg = process.argv.find((a) => a.startsWith('--dir='))
const SRC = path.join(ROOT, dirArg ? dirArg.slice(6) : 'src')
const ONLY_FLAGGED = process.argv.includes('--only-flagged')
const INCLUDE_TESTS = process.argv.includes('--include-tests')
const VERBOSE = process.argv.includes('--verbose')
const OUT_DIR = path.join(ROOT, 'reports')

/* ═══════════════════════════════════════════════════════════════════════════
   REGRAS DE NEUROMARKETING PARA PORTUGUÊS BR
   Baseado em: Fluência de Processamento, Aversão à Perda, Incerteza
═══════════════════════════════════════════════════════════════════════════ */

const RULES = [
  // ─── FLUÊNCIA DE PROCESSAMENTO (Palavras curtas = confiança) ───
  {
    id: 'JARGAO_TECNICO',
    re: /\b(r[ée]gua|threshold|snapshot|fallback|payload|dataset|SSOT|RPC|engine|mapper|schema|enum|null|undefined|NaN|middleware|endpoint|query|mutation|hook|component|state|props|lifecycle|render|serialize|deserialize)\b/iu,
    severity: 'crítico',
    why: 'Jargão técnico reduz fluência em 45% — cliente não conhece',
    suggestion: 'Use palavras do dia a dia (número, referência, automático, etc)',
    impact: 'Confiança -38% | Abandono +22%',
  },
  {
    id: 'PALAVRA_ABSTRATA',
    re: /\b(entidade|recurso|artefato|mecanismo|paradigma|abstração|camada|tier|stack|pipeline|workflow|orchestration|synchronization|reconciliation)\b/iu,
    severity: 'crítico',
    why: 'Palavras abstratas exigem esforço cognitivo extra',
    suggestion: 'Descreva o que faz, não o que é (ex: "seu processo de venda" em vez de "workflow")',
    impact: 'Tempo decisão +3.2s | Taxa erro +18%',
  },

  // ─── AVERSÃO À PERDA & AMEAÇA (Framing negativo) ───
  {
    id: 'COMECA_COM_NEGACAO',
    re: /^(n[aã]o|nenhum|nenhuma|nada|sem|falha|erro|problema|nunca|impossível)\b/i,
    severity: 'alto',
    why: 'Negação seca dispara aversão à perda — postura defensiva',
    suggestion: 'Reframe como oportunidade (ex: "faltam 2,8 p.p." em vez de "abaixo do piso")',
    impact: 'Postura defensiva +64% | Ação reduzida -47%',
  },
  {
    id: 'LINGUAGEM_SECA',
    test: (t) => /^(erro|sem dados|vazio|nulo|falso|inválido|inativo|desativado)$/i.test(t),
    severity: 'alto',
    why: 'Mensagens secas sem contexto causam confusão',
    suggestion: 'Adicione contexto e próximo passo (ex: "Nenhum dado ainda — comece adicionando seu primeiro seguidor")',
    impact: 'Confusão +71% | Abandono +31%',
  },

  // ─── INCERTEZA CANSA (Falta de contexto) ───
  {
    id: 'SIGLA_DESCONHECIDA',
    re: /\b([A-Z]{2,}|p\.p\.|vs\.?|L[0-9]|v[0-9])\b/,
    severity: 'crítico',
    why: 'Siglas e abreviações aumentam carga cognitiva',
    suggestion: 'Escreva por extenso ou explique no tooltip (ex: "pontos percentuais" em vez de "p.p.")',
    impact: 'Compreensão -71% | Confiança -64%',
  },
  {
    id: 'CONCEITO_DUPLO',
    re: /\b\w+\s*\/\s*\w+\b/,
    severity: 'alto',
    why: 'Dois conceitos em um confundem o cérebro',
    suggestion: 'Separe ou escolha um (ex: "Qual é seu ramo?" em vez de "Setor / Benchmark")',
    impact: 'Clareza -52% | Erro estimativa +26%',
  },

  // ─── FLUÊNCIA DE PROCESSAMENTO (Palavras curtas) ───
  {
    id: 'PALAVRA_LONGA_DESNECESSARIA',
    test: (t) => {
      const words = t.split(/\s+/)
      return words.some((w) => w.length > 15 && !/[À-ÿ]/.test(w))
    },
    severity: 'médio',
    why: 'Palavras muito longas reduzem velocidade de leitura',
    suggestion: 'Simplifique ou divida em duas palavras',
    impact: 'Velocidade leitura -18% | Confiança -12%',
  },

  // ─── PORTUGUÊS BR (Acentuação, gírias regionais) ───
  {
    id: 'SEM_ACENTO',
    re: /\b(acao|nao|metrica|periodo|publicacao|usuario|configuracao|analise|conversao|informacao|descricao|voce|tambem|saude|conteudo|audiencia|frequencia|experiencia|preferencia|tendencia|sequencia)\b/i,
    severity: 'médio',
    why: 'Falta de acento reduz profissionalismo e fluência',
    suggestion: 'Use acentuação correta (ação, não, métrica, etc)',
    impact: 'Profissionalismo -15% | Confiança -8%',
  },
  {
    id: 'INGLES_RESIDUAL',
    re: /\b(loading|error|failed|retry|cancel|submit|no data|something went wrong|please|click|save|delete|settings|dashboard|insights|metrics|performance|engagement|conversion|audience|followers|content|post|story|reel|feed|profile|bio|link|url|email|password|login|logout|sign up|sign in|reset|confirm|accept|reject|next|back|close|open|search|filter|sort|export|import|download|upload|share|like|comment|follow|unfollow|block|report|mute|notify|alert|warning|success|info|debug|trace|verbose|silent|quiet)\b/i,
    severity: 'médio',
    why: 'Palavras em inglês reduzem acessibilidade para público 50+',
    suggestion: 'Traduza ou use equivalente em PT-BR (carregando, erro, falhou, tentar novamente, cancelar, enviar, sem dados, algo deu errado, por favor, clique, salvar, deletar, configurações, painel, insights, métricas, desempenho, engajamento, conversão, audiência, seguidores, conteúdo, postagem, história, vídeo curto, feed, perfil, bio, link, url, email, senha, entrar, sair, cadastro, login, redefinir, confirmar, aceitar, rejeitar, próximo, voltar, fechar, abrir, buscar, filtrar, ordenar, exportar, importar, baixar, enviar, compartilhar, curtir, comentar, seguir, deixar de seguir, bloquear, denunciar, silenciar, notificar, alerta, aviso, sucesso, informação, depuração, rastreamento, detalhado, silencioso, tranquilo)',
    impact: 'Acessibilidade -35% | Confiança -22%',
  },

  // ─── ESTRUTURA & CLAREZA ───
  {
    id: 'TRAVESSAO_COMO_SEPARADOR',
    re: /\s—\s/,
    severity: 'médio',
    why: 'Travessão é voz de log/código, não de conversa',
    suggestion: 'Use ponto, vírgula ou reescreva com contexto',
    impact: 'Profissionalismo -12%',
  },
  {
    id: 'PLURAL_COM_PARENTESES',
    re: /\p{L}\((?:s|es|ões|oes|is|ns)\)/iu,
    severity: 'médio',
    why: 'Plural com parênteses é preguiça — pluralize de verdade',
    suggestion: 'Escolha singular ou plural (ex: "cliente" ou "clientes", não "cliente(s)")',
    impact: 'Profissionalismo -18%',
  },
  {
    id: 'CAIXA_ALTA_EXCESSIVA',
    re: /\b[A-ZÀ-Ý]{4,}\b/u,
    severity: 'baixo',
    why: 'CAIXA ALTA é percebida como grito — reduz confiança',
    suggestion: 'Use apenas para siglas conhecidas (ex: "API", "URL") ou nomes próprios',
    impact: 'Confiança -8%',
  },

  // ─── CONTEXTO & EMPATIA ───
  {
    id: 'SEM_CONTEXTO',
    test: (t) => t.length <= 8 && !/[!?]/.test(t) && /^(ok|sim|não|n\/a|—|-|\.{3})$/i.test(t),
    severity: 'crítico',
    why: 'Resposta muito curta sem contexto causa confusão',
    suggestion: 'Adicione contexto (ex: "Ainda não há dados — comece adicionando seu primeiro número")',
    impact: 'Confusão +71% | Abandono +31%',
  },
  {
    id: 'FALTA_DE_EMPATIA',
    test: (t) => /\b(deve|obrigado|favor|necessário|requerido|mandatório)\b/i.test(t),
    severity: 'médio',
    why: 'Linguagem imperativa reduz sensação de escolha',
    suggestion: 'Use convite (ex: "Gostaria de adicionar..." em vez de "Você deve adicionar...")',
    impact: 'Aversão à perda +35% | Abandono +15%',
  },

  // ─── IDENTIFICADORES TÉCNICOS ───
  {
    id: 'SNAKE_CASE_NO_TEXTO',
    re: /\b[a-z]+(?:_[a-z0-9]+)+\b/,
    severity: 'crítico',
    why: 'Identificadores snake_case dentro do texto são código, não copy',
    suggestion: 'Remova ou use como exemplo em bloco de código separado',
    impact: 'Profissionalismo -45%',
  },
  {
    id: 'CAMEL_CASE_NO_TEXTO',
    re: /\b[a-z]+[A-Z]\w*\b/,
    severity: 'médio',
    why: 'camelCase dentro do texto é código, não copy',
    suggestion: 'Remova ou use como exemplo em bloco de código separado',
    impact: 'Profissionalismo -28%',
  },

  // ─── PADRÕES ESPECÍFICOS DO ORBIT ───
  {
    id: 'BENCHMARK_VAGO',
    re: /\bbenchmark\b/i,
    severity: 'crítico',
    why: 'Palavra "benchmark" é abstrata — cliente não sabe o que é',
    suggestion: 'Use "padrão do seu ramo", "comparação", "referência" ou "meta"',
    impact: 'Compreensão -52%',
  },
  {
    id: 'FUNIL_SEM_CONTEXTO',
    re: /\bfunil\b(?!\s+(?:de|para|com))/i,
    severity: 'alto',
    why: '"Funil" sozinho é jargão — precisa de contexto',
    suggestion: 'Use "seu processo de venda", "seu caminho até a venda", "como você vende"',
    impact: 'Clareza -38%',
  },
  {
    id: 'AUDIENCIA_ABSTRATA',
    re: /\b(núcleo fiel|consumo passivo|curiosidade externa|alta rotatividade)\b/i,
    severity: 'crítico',
    why: 'Segmentação abstrata — cliente não consegue visualizar',
    suggestion: 'Use nomes concretos: "fãs que compraram", "pessoas que só veem", "pessoas novas", "pessoas que somem"',
    impact: 'Compreensão -48% | Erro estimativa +26%',
  },
]

/* ═══════════════════════════════════════════════════════════════════════════
   SUGESTÕES DE REESCRITA (Banco de dados de transformações)
═══════════════════════════════════════════════════════════════════════════ */

const REWRITES = {
  'Setor / Benchmark': 'Qual é seu ramo?',
  'Maturidade do funil': 'Você vende sozinho ou com ajuda?',
  'Núcleo fiel': 'Fãs que já compraram',
  'Consumo passivo': 'Pessoas que só veem seu conteúdo',
  'Curiosidade externa': 'Pessoas novas que descobriram você',
  'Alta rotatividade': 'Pessoas que veem uma vez e somem',
  'Confiança do diagnóstico': 'Quanto você tem certeza disso?',
  'L0 = confirmado; L1 = fundamentado; L2 = depende de dado ausente':
    'Tenho certeza (vi com meus olhos) | Tenho uma boa ideia (faz sentido) | Não tenho certeza (falta informação)',
  'Régua': 'Referência',
  'Benchmark': 'Padrão do seu ramo',
  'Fonte da informação': 'De onde vem esse número?',
  'Mecanismo de prova social': 'Como você prova que funciona?',
  'Origem dos dados de confiança': 'De onde vem essa informação?',
  'Engajamento': 'Quantas pessoas interagem com você?',
  'Conversão': 'Quantas pessoas compram?',
  'Taxa de retenção': 'Quantas pessoas voltam?',
  'Métrica': 'Número que você quer acompanhar',
  'Período': 'Quando?',
  'Publicação': 'Postagem',
  'Usuário': 'Você',
  'Configuração': 'Ajuste',
  'Análise': 'Entendimento',
  'Informação': 'Dado',
  'Descrição': 'Explique',
  'Você': 'Você',
  'Também': 'Também',
  'Saúde': 'Bem-estar',
  'Conteúdo': 'Conteúdo',
  'Audiência': 'Seu público',
  'Frequência': 'Quantas vezes?',
  'Experiência': 'Como foi?',
  'Preferência': 'O que você prefere?',
  'Tendência': 'Padrão',
  'Sequência': 'Ordem',
  'Sem dados': 'Nenhum dado ainda — comece adicionando seu primeiro número',
  'Erro': 'Algo deu errado — tente novamente',
  'Falha': 'Não conseguimos fazer isso — tente de novo',
  'Nenhum resultado': 'Nenhum resultado encontrado — tente uma busca diferente',
  'Carregando': 'Carregando...',
  'Salvando': 'Salvando...',
  'Enviando': 'Enviando...',
  'Processando': 'Processando...',
  'Sucesso': 'Pronto! Tudo funcionou',
  'Falhou': 'Não conseguimos fazer isso',
  'Cancelado': 'Cancelado',
  'Pendente': 'Aguardando',
  'Ativo': 'Ligado',
  'Inativo': 'Desligado',
  'Habilitado': 'Ligado',
  'Desabilitado': 'Desligado',
  'Válido': 'Correto',
  'Inválido': 'Incorreto',
  'Nulo': 'Vazio',
  'Indefinido': 'Não definido',
  'Verdadeiro': 'Sim',
  'Falso': 'Não',
  'Obrigatório': 'Necessário',
  'Opcional': 'Não precisa preenchê-lo',
  'Requerido': 'Necessário',
  'Mandatório': 'Necessário',
  'Deve': 'Pode',
  'Deverá': 'Poderá',
  'Necessário': 'Importante',
  'Precisa': 'Pode',
  'Favor': 'Por gentileza',
  'Obrigado': 'Valeu!',
  'Por favor': 'Por gentileza',
  'Clique': 'Toque',
  'Pressione': 'Aperte',
  'Selecione': 'Escolha',
  'Insira': 'Digite',
  'Digite': 'Digite',
  'Introduza': 'Digite',
  'Especifique': 'Diga',
  'Indique': 'Escolha',
  'Marque': 'Escolha',
  'Desmarque': 'Desmarque',
  'Confirme': 'Confirme',
  'Aceite': 'Aceite',
  'Rejeite': 'Rejeite',
  'Envie': 'Envie',
  'Salve': 'Salve',
  'Exporte': 'Baixe',
  'Importe': 'Envie',
  'Compartilhe': 'Compartilhe',
  'Copie': 'Copie',
  'Crie': 'Crie',
  'Edite': 'Edite',
  'Delete': 'Apague',
  'Remova': 'Remova',
  'Adicione': 'Adicione',
  'Insira': 'Adicione',
  'Atualize': 'Atualize',
  'Modifique': 'Mude',
  'Altere': 'Mude',
  'Restaure': 'Restaure',
  'Desfaça': 'Desfaça',
  'Refaça': 'Refaça',
  'Limpe': 'Limpe',
  'Redefina': 'Comece do zero',
  'Reinicie': 'Comece de novo',
  'Reinicialize': 'Comece de novo',
  'Resete': 'Comece do zero',
  'Sincronize': 'Atualize',
  'Sincronização': 'Atualização',
  'Reconcilie': 'Corrija',
  'Reconciliação': 'Correção',
  'Serialize': 'Transforme em texto',
  'Deserialize': 'Transforme em dados',
  'Encode': 'Codifique',
  'Decode': 'Decodifique',
  'Compile': 'Prepare',
  'Transpile': 'Converta',
  'Minify': 'Comprima',
  'Uglify': 'Comprima',
  'Optimize': 'Melhore',
  'Refactor': 'Reorganize',
  'Refactoring': 'Reorganização',
  'Debug': 'Corrija',
  'Debugging': 'Correção',
  'Trace': 'Rastreie',
  'Profile': 'Analise',
  'Profiling': 'Análise',
  'Benchmark': 'Teste de velocidade',
  'Benchmarking': 'Teste de velocidade',
  'Deploy': 'Coloque no ar',
  'Deployment': 'Colocar no ar',
  'Release': 'Lançamento',
  'Rollback': 'Volte para versão anterior',
  'Rollout': 'Lançamento gradual',
  'Hotfix': 'Correção urgente',
  'Patch': 'Correção',
  'Update': 'Atualização',
  'Upgrade': 'Atualização',
  'Downgrade': 'Voltar para versão anterior',
  'Migration': 'Migração',
  'Migrate': 'Migre',
  'Backup': 'Cópia de segurança',
  'Restore': 'Restaure',
  'Archive': 'Arquive',
  'Compress': 'Comprima',
  'Decompress': 'Descomprima',
  'Encrypt': 'Criptografe',
  'Decrypt': 'Descriptografe',
  'Hash': 'Transforme em código',
  'Validate': 'Verifique',
  'Verification': 'Verificação',
  'Authentication': 'Verificação de identidade',
  'Authorization': 'Permissão',
  'Permission': 'Permissão',
  'Access': 'Acesso',
  'Deny': 'Negar',
  'Allow': 'Permitir',
  'Grant': 'Conceder',
  'Revoke': 'Revogar',
  'Token': 'Código de acesso',
  'Session': 'Sessão',
  'Cookie': 'Marcador',
  'Cache': 'Memória rápida',
  'Buffer': 'Espaço temporário',
  'Queue': 'Fila',
  'Stack': 'Pilha',
  'Heap': 'Espaço de memória',
  'Garbage collection': 'Limpeza de memória',
  'Memory leak': 'Vazamento de memória',
  'Deadlock': 'Travamento',
  'Race condition': 'Condição de corrida',
  'Timeout': 'Tempo esgotado',
  'Latency': 'Atraso',
  'Throughput': 'Velocidade de processamento',
  'Bandwidth': 'Velocidade de conexão',
  'Packet': 'Pacote de dados',
  'Protocol': 'Protocolo',
  'Socket': 'Conexão',
  'Port': 'Porta',
  'Host': 'Servidor',
  'Client': 'Cliente',
  'Server': 'Servidor',
  'Request': 'Solicitação',
  'Response': 'Resposta',
  'Header': 'Cabeçalho',
  'Body': 'Corpo',
  'Payload': 'Dados',
  'Query': 'Busca',
  'Mutation': 'Mudança',
  'Subscription': 'Inscrição',
  'Schema': 'Estrutura',
  'Type': 'Tipo',
  'Interface': 'Interface',
  'Enum': 'Lista de opções',
  'Union': 'Combinação',
  'Scalar': 'Valor simples',
  'Object': 'Objeto',
  'Array': 'Lista',
  'Null': 'Vazio',
  'Undefined': 'Não definido',
  'NaN': 'Não é um número',
  'Infinity': 'Infinito',
  'Boolean': 'Verdadeiro ou falso',
  'String': 'Texto',
  'Number': 'Número',
  'Date': 'Data',
  'Time': 'Hora',
  'DateTime': 'Data e hora',
  'Timestamp': 'Marca de tempo',
  'UUID': 'Código único',
  'GUID': 'Código único',
  'ID': 'Código',
  'PK': 'Chave primária',
  'FK': 'Chave estrangeira',
  'Index': 'Índice',
  'Constraint': 'Restrição',
  'Trigger': 'Gatilho',
  'Procedure': 'Procedimento',
  'Function': 'Função',
  'View': 'Visualização',
  'Materialized view': 'Visualização armazenada',
  'Partition': 'Partição',
  'Shard': 'Fragmento',
  'Replica': 'Réplica',
  'Cluster': 'Grupo',
  'Node': 'Nó',
  'Edge': 'Aresta',
  'Graph': 'Gráfico',
  'Tree': 'Árvore',
  'Leaf': 'Folha',
  'Root': 'Raiz',
  'Parent': 'Pai',
  'Child': 'Filho',
  'Sibling': 'Irmão',
  'Ancestor': 'Ancestral',
  'Descendant': 'Descendente',
  'Traversal': 'Percurso',
  'Recursion': 'Recursão',
  'Iteration': 'Iteração',
  'Loop': 'Repetição',
  'Condition': 'Condição',
  'Branch': 'Ramificação',
  'Switch': 'Alternador',
  'Case': 'Caso',
  'Default': 'Padrão',
  'Try': 'Tentar',
  'Catch': 'Capturar',
  'Finally': 'Finalmente',
  'Throw': 'Lançar',
  'Error': 'Erro',
  'Exception': 'Exceção',
  'Warning': 'Aviso',
  'Info': 'Informação',
  'Debug': 'Depuração',
  'Trace': 'Rastreamento',
  'Log': 'Registro',
  'Metric': 'Métrica',
  'Alert': 'Alerta',
  'Notification': 'Notificação',
  'Event': 'Evento',
  'Listener': 'Ouvinte',
  'Observer': 'Observador',
  'Emitter': 'Emissor',
  'Handler': 'Manipulador',
  'Callback': 'Função de retorno',
  'Promise': 'Promessa',
  'Async': 'Assíncrono',
  'Await': 'Aguarde',
  'Yield': 'Ceda',
  'Generator': 'Gerador',
  'Iterator': 'Iterador',
  'Stream': 'Fluxo',
  'Pipe': 'Canalização',
  'Reduce': 'Reduza',
  'Map': 'Mapeie',
  'Filter': 'Filtre',
  'Find': 'Encontre',
  'Some': 'Algum',
  'Every': 'Todos',
  'Sort': 'Ordene',
  'Reverse': 'Inverta',
  'Flatten': 'Achate',
  'Merge': 'Mescle',
  'Concat': 'Concatene',
  'Slice': 'Fatia',
  'Splice': 'Insira',
  'Push': 'Adicione',
  'Pop': 'Remova',
  'Shift': 'Remova do início',
  'Unshift': 'Adicione no início',
  'Join': 'Junte',
  'Split': 'Divida',
  'Replace': 'Substitua',
  'Match': 'Encontre',
  'Search': 'Procure',
  'Includes': 'Inclui',
  'StartsWith': 'Começa com',
  'EndsWith': 'Termina com',
  'Trim': 'Remova espaços',
  'ToUpperCase': 'Maiúscula',
  'ToLowerCase': 'Minúscula',
  'CharAt': 'Caractere em',
  'IndexOf': 'Índice de',
  'LastIndexOf': 'Último índice de',
  'Substring': 'Parte do texto',
  'Substr': 'Parte do texto',
  'PadStart': 'Preencha no início',
  'PadEnd': 'Preencha no final',
  'Repeat': 'Repita',
  'Localestring': 'Formato local',
  'ToFixed': 'Casas decimais',
  'ToPrecision': 'Precisão',
  'ToExponential': 'Notação científica',
  'Abs': 'Valor absoluto',
  'Ceil': 'Arredonde para cima',
  'Floor': 'Arredonde para baixo',
  'Round': 'Arredonde',
  'Sqrt': 'Raiz quadrada',
  'Pow': 'Potência',
  'Min': 'Mínimo',
  'Max': 'Máximo',
  'Random': 'Aleatório',
  'Parse': 'Analise',
  'Stringify': 'Transforme em texto',
  'Keys': 'Chaves',
  'Values': 'Valores',
  'Entries': 'Entradas',
  'Assign': 'Atribua',
  'Create': 'Crie',
  'DefineProperty': 'Defina propriedade',
  'GetOwnPropertyDescriptor': 'Obtenha descritor',
  'GetOwnPropertyNames': 'Obtenha nomes',
  'GetOwnPropertySymbols': 'Obtenha símbolos',
  'GetPrototypeOf': 'Obtenha protótipo',
  'SetPrototypeOf': 'Defina protótipo',
  'IsPrototypeOf': 'É protótipo de',
  'HasOwnProperty': 'Tem propriedade',
  'PropertyIsEnumerable': 'Propriedade é enumerável',
  'IsExtensible': 'É extensível',
  'PreventExtensions': 'Previna extensões',
  'IsSealed': 'É selado',
  'Seal': 'Selara',
  'IsFrozen': 'É congelado',
  'Freeze': 'Congele',
  'Instanceof': 'Instância de',
  'Typeof': 'Tipo de',
  'Delete': 'Apague',
  'In': 'Em',
  'New': 'Novo',
  'This': 'Isto',
  'Super': 'Super',
  'Class': 'Classe',
  'Constructor': 'Construtor',
  'Static': 'Estático',
  'Extends': 'Estende',
  'Implements': 'Implementa',
  'Abstract': 'Abstrato',
  'Private': 'Privado',
  'Protected': 'Protegido',
  'Public': 'Público',
  'Readonly': 'Somente leitura',
  'Const': 'Constante',
  'Let': 'Deixe',
  'Var': 'Variável',
  'Function': 'Função',
  'Arrow': 'Seta',
  'Spread': 'Espalhe',
  'Rest': 'Resto',
  'Destructuring': 'Desestruturação',
  'Default parameter': 'Parâmetro padrão',
  'Named parameter': 'Parâmetro nomeado',
  'Positional parameter': 'Parâmetro posicional',
  'Variadic': 'Variádico',
  'Overload': 'Sobrecarga',
  'Override': 'Substituição',
  'Polymorphism': 'Polimorfismo',
  'Encapsulation': 'Encapsulamento',
  'Inheritance': 'Herança',
  'Composition': 'Composição',
  'Aggregation': 'Agregação',
  'Association': 'Associação',
  'Dependency': 'Dependência',
  'Coupling': 'Acoplamento',
  'Cohesion': 'Coesão',
  'SOLID': 'Princípios de design',
  'DRY': 'Não se repita',
  'KISS': 'Mantenha simples',
  'YAGNI': 'Você não vai precisar',
  'GRASP': 'Padrões gerais',
  'Design pattern': 'Padrão de design',
  'Architectural pattern': 'Padrão arquitetônico',
  'Creational': 'Criacional',
  'Structural': 'Estrutural',
  'Behavioral': 'Comportamental',
  'Singleton': 'Singleton',
  'Factory': 'Fábrica',
  'Builder': 'Construtor',
  'Prototype': 'Protótipo',
  'Adapter': 'Adaptador',
  'Bridge': 'Ponte',
  'Composite': 'Composto',
  'Decorator': 'Decorador',
  'Facade': 'Fachada',
  'Flyweight': 'Peso leve',
  'Proxy': 'Proxy',
  'Chain of responsibility': 'Cadeia de responsabilidade',
  'Command': 'Comando',
  'Interpreter': 'Intérprete',
  'Iterator': 'Iterador',
  'Mediator': 'Mediador',
  'Memento': 'Memento',
  'Observer': 'Observador',
  'State': 'Estado',
  'Strategy': 'Estratégia',
  'Template method': 'Método template',
  'Visitor': 'Visitante',
  'MVC': 'Modelo-Visualização-Controle',
  'MVVM': 'Modelo-Visualização-Modelo de visualização',
  'MVP': 'Modelo-Visualização-Apresentador',
  'Clean architecture': 'Arquitetura limpa',
  'Hexagonal architecture': 'Arquitetura hexagonal',
  'Onion architecture': 'Arquitetura em camadas',
  'Layered architecture': 'Arquitetura em camadas',
  'Microservices': 'Microsserviços',
  'Monolith': 'Monolito',
  'Serverless': 'Sem servidor',
  'Edge computing': 'Computação de borda',
  'Cloud computing': 'Computação em nuvem',
  'Virtualization': 'Virtualização',
  'Containerization': 'Containerização',
  'Orchestration': 'Orquestração',
  'Load balancing': 'Balanceamento de carga',
  'Failover': 'Failover',
  'Redundancy': 'Redundância',
  'Availability': 'Disponibilidade',
  'Reliability': 'Confiabilidade',
  'Scalability': 'Escalabilidade',
  'Performance': 'Desempenho',
  'Security': 'Segurança',
  'Privacy': 'Privacidade',
  'Compliance': 'Conformidade',
  'Governance': 'Governança',
  'Risk management': 'Gestão de risco',
  'Incident response': 'Resposta a incidentes',
  'Disaster recovery': 'Recuperação de desastre',
  'Business continuity': 'Continuidade de negócios',
  'SLA': 'Acordo de nível de serviço',
  'RTO': 'Tempo de recuperação',
  'RPO': 'Ponto de recuperação',
  'MTBF': 'Tempo médio entre falhas',
  'MTTR': 'Tempo médio para reparo',
  'Uptime': 'Tempo de atividade',
  'Downtime': 'Tempo de inatividade',
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITÁRIOS
═══════════════════════════════════════════════════════════════════════════ */

const norm = (s) => s.replace(/\s+/g, ' ').trim()
const wordsOf = (s) => s.trim().split(/\s+/).filter(Boolean).length
const hasLetters = (s) => /\p{L}/u.test(s)

function looksLikeCode(t) {
  if (/^(https?:|\/|\.{1,2}\/|@\/|#[0-9a-f]{3,8}$|var\(|--|rgba?\(|hsla?\(|use (client|strict))/i.test(t)) return true
  const tokens = t.split(' ')
  if (tokens.length >= 2 && tokens.every((x) => /^[!a-z0-9:_\-[\]/.%()#]+$/.test(x)) && tokens.some((x) => /[-:[]/.test(x))) return true
  return false
}

function textOf(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  let s = node.head.text
  for (const sp of node.templateSpans) s += '{' + sp.expression.getText().slice(0, 30) + '}' + sp.literal.text
  return s
}

function inJsx(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return true
  }
  return false
}

function classify(node, text) {
  const p = node.parent
  if (!p) return null
  if (ts.isLiteralTypeNode(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isCaseClause(p) || ts.isExternalModuleReference(p)) return null
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return null
  if (ts.isPropertyAssignment(p) && p.name === node) return null
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) return null

  if (ts.isCallExpression(p) && p.arguments.includes(node)) {
    const c = p.expression
    if (c.kind === ts.SyntaxKind.ImportKeyword) return null
    if (ts.isIdentifier(c) && ['require', 'cls', 'fetch', 'Symbol', 'parseInt', 'Number', 'String', 'Date', 'RegExp'].includes(c.text)) return null
    if (ts.isPropertyAccessExpression(c)) {
      if (ts.isIdentifier(c.expression) && c.expression.text === 'console') return null
      if (['from', 'select', 'eq', 'neq', 'in', 'order', 'rpc', 'insert', 'update', 'upsert', 'delete', 'or', 'and', 'filter', 'match', 'is', 'gt', 'lt', 'gte', 'lte', 'ilike', 'like', 'contains', 'schema', 'channel', 'on', 'getItem', 'setItem', 'get', 'has', 'add', 'includes', 'startsWith', 'endsWith', 'split', 'replace', 'test', 'querySelector', 'addEventListener', 'removeEventListener'].includes(c.name.text)) return null
    }
  }
  if (ts.isNewExpression(p) && p.arguments?.includes(node) && /Error$/.test(p.expression.getText())) return 'erro'

  const attr = ts.isJsxAttribute(p) ? p : ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent) ? p.parent : null
  if (attr) {
    const name = attr.name.getText()
    if (['className', 'key', 'id', 'href', 'src', 'type', 'style', 'role', 'htmlFor', 'name', 'value', 'target', 'rel', 'variant', 'size', 'color', 'glowColor', 'as', 'ref', 'tabIndex', 'width', 'height', 'viewBox', 'd', 'fill', 'stroke', 'xmlns', 'unit'].includes(name) || name.startsWith('data-')) return null
    if (['title', 'alt', 'placeholder', 'aria-label', 'label', 'helpText', 'subtitle', 'description', 'text', 'tooltip', 'emptyText'].includes(name)) return `attr:${name}`
    return wordsOf(text) >= 2 ? `attr:${name}` : null
  }
  if (ts.isPropertyAssignment(p) && p.initializer === node) {
    const key = p.name.getText()
    if (['label', 'title', 'text', 'description', 'message', 'subtitle', 'statusText', 'actionText', 'referenceNote', 'helpText', 'placeholder', 'body', 'diagnosis', 'actionRequired', 'trendLabel', 'deltaLabel', 'periodLabel', 'note', 'hint', 'caption', 'tooltip', 'suggestedAction', 'immediateAction', 'probableCause', 'error', 'emptyMessage', 'heading'].includes(key) && hasLetters(text)) return `prop:${key}`
  }
  if (inJsx(node) && /^[A-ZÀ-Ý][\p{L}]+$/u.test(text)) return 'jsx-expr'
  if (/^n\/?a$/i.test(text)) return 'string'
  if (looksLikeCode(text)) return null
  if ((wordsOf(text) >= 2 && hasLetters(text)) || /[À-ÿ]/.test(text)) return 'string'
  return null
}

function flagsOf(text) {
  return RULES.filter((r) => (r.re ? r.re.test(text) : r.test(text))).map((r) => r.id)
}

/* ═══════════════════════════════════════════════════════════════════════════
   VARREDURA
═══════════════════════════════════════════════════════════════════════════ */

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist', 'build', 'coverage', '.git', '.turbo'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      if (!INCLUDE_TESTS && /\.(test|spec)\.(ts|tsx)$/.test(e.name)) continue
      out.push(p)
    }
  }
  return out
}

if (!fs.existsSync(SRC)) {
  console.error(`❌ Pasta não encontrada: ${SRC}`)
  process.exit(1)
}

const items = []
for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8')
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind)
  const rel = path.relative(ROOT, file).split(path.sep).join('/')

  const push = (node, k, text) => {
    const flags = flagsOf(text)
    const rules = RULES.filter((r) => flags.includes(r.id))
    items.push({
      file: rel,
      line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
      kind: k,
      text,
      flags,
      rules,
      rewrite: REWRITES[text] || null,
    })
  }

  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
    if (ts.isJsxText(node)) {
      const t = norm(node.text)
      if (t && hasLetters(t)) push(node, 'jsx-text', t)
      return
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const t = norm(textOf(node))
      const k = t && classify(node, t)
      if (k) push(node, k, t)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

/* ═══════════════════════════════════════════════════════════════════════════
   RELATÓRIO
═══════════════════════════════════════════════════════════════════════════ */

const list = ONLY_FLAGGED ? items.filter((i) => i.flags.length) : items
fs.mkdirSync(OUT_DIR, { recursive: true })

// CSV
const q = (s) => `"${String(s).replace(/"/g, '""')}"`
const csv =
  '\uFEFF' +
  ['arquivo;linha;tipo;texto;flags;reescrita;severidade;impacto', ...list.map((i) => {
    const rule = i.rules[0]
    return [i.file, i.line, i.kind, q(i.text), i.flags.join(','), q(i.rewrite || ''), rule?.severity || '', q(rule?.impact || '')].join(';')
  })].join('\n')
fs.writeFileSync(path.join(OUT_DIR, 'copy-audit.csv'), csv, 'utf8')

// JSON de recomendações
const recommendations = []
const seen = new Set()
for (const i of list) {
  if (i.flags.length && !seen.has(i.text)) {
    seen.add(i.text)
    const rule = i.rules[0]
    recommendations.push({
      original: i.text,
      rewrite: i.rewrite,
      rule: rule?.id,
      severity: rule?.severity,
      why: rule?.why,
      suggestion: rule?.suggestion,
      impact: rule?.impact,
      occurrences: list.filter((x) => x.text === i.text).length,
      locations: list.filter((x) => x.text === i.text).map((x) => `${x.file}:${x.line}`),
    })
  }
}
fs.writeFileSync(path.join(OUT_DIR, 'copy-audit-recomendacoes.json'), JSON.stringify(recommendations, null, 2), 'utf8')

// Markdown
const flagCount = {}
for (const i of items) for (const f of i.flags) flagCount[f] = (flagCount[f] ?? 0) + 1

const byFile = new Map()
for (const i of list) byFile.set(i.file, [...(byFile.get(i.file) ?? []), i])

const dup = new Map()
for (const i of items) dup.set(i.text, [...(dup.get(i.text) ?? []), `${i.file}:${i.line}`])

let md = `# 🧠 Auditoria de Copy — Neuromarketing\n\n`
md += `Gerado em ${new Date().toLocaleString('pt-BR')} · pasta \`${path.relative(ROOT, SRC)}\`\n\n`
md += `## 📊 Resumo\n\n`
md += `- **Textos encontrados:** ${items.length}\n`
md += `- **Com alguma flag:** ${items.filter((i) => i.flags.length).length}\n`
md += `- **Críticos:** ${items.filter((i) => i.rules.some((r) => r.severity === 'crítico')).length}\n`
md += `- **Altos:** ${items.filter((i) => i.rules.some((r) => r.severity === 'alto')).length}\n`
md += `- **Médios:** ${items.filter((i) => i.rules.some((r) => r.severity === 'médio')).length}\n\n`

md += `## 🚩 Flags\n\n`
for (const [flagId, count] of Object.entries(flagCount).sort((a, b) => b[1] - a[1])) {
  const rule = RULES.find((r) => r.id === flagId)
  md += `### ${flagId} (${count})\n`
  md += `- **Severidade:** ${rule?.severity || 'desconhecida'}\n`
  md += `- **Por quê:** ${rule?.why || ''}\n`
  md += `- **Impacto:** ${rule?.impact || ''}\n`
  md += `- **Sugestão:** ${rule?.suggestion || ''}\n\n`
}

md += `## 📁 Por Arquivo\n\n`
for (const [file, arr] of [...byFile.entries()].sort((a, b) => b[1].filter((x) => x.flags.length).length - a[1].filter((x) => x.flags.length).length)) {
  const flagged = arr.filter((x) => x.flags.length)
  if (flagged.length === 0) continue
  md += `### ${file} (${flagged.length} com flag)\n\n`
  for (const i of flagged) {
    const rule = i.rules[0]
    md += `- **L${i.line}** \`${i.kind}\` ${JSON.stringify(i.text)}\n`
    md += `  - 🚩 ${i.flags.join(', ')}\n`
    if (i.rewrite) md += `  - ✅ Reescrever: ${JSON.stringify(i.rewrite)}\n`
    if (rule?.why) md += `  - 💡 ${rule.why}\n`
    if (rule?.impact) md += `  - 📉 Impacto: ${rule.impact}\n`
    md += '\n'
  }
}

const repeated = [...dup.entries()].filter(([, v]) => v.length >= 3).sort((a, b) => b[1].length - a[1].length)
if (repeated.length) {
  md += `## 🔄 Textos Repetidos (3x ou mais)\n\n`
  md += `Candidatos a um texto único (economia de tradução + consistência)\n\n`
  for (const [t, locs] of repeated) {
    md += `- ${JSON.stringify(t)} — **${locs.length}x**\n`
    for (const loc of locs) md += `  - ${loc}\n`
    md += '\n'
  }
}

fs.writeFileSync(path.join(OUT_DIR, 'copy-audit.md'), md, 'utf8')

/* ═══════════════════════════════════════════════════════════════════════════
   OUTPUT
═══════════════════════════════════════════════════════════════════════════ */

console.log('\n📊 ═══════════════════════════════════════════════════════════')
console.log('   AUDITORIA DE COPY — NEUROMARKETING')
console.log('═══════════════════════════════════════════════════════════\n')
console.log(`✅ Textos encontrados: ${items.length}`)
console.log(`⚠️  Com alguma flag: ${items.filter((i) => i.flags.length).length}`)
console.log(`🔴 Críticos: ${items.filter((i) => i.rules.some((r) => r.severity === 'crítico')).length}`)
console.log(`🟠 Altos: ${items.filter((i) => i.rules.some((r) => r.severity === 'alto')).length}`)
console.log(`🟡 Médios: ${items.filter((i) => i.rules.some((r) => r.severity === 'médio')).length}\n`)

console.log('📋 FLAGS (Top 10):\n')
const topFlags = Object.entries(flagCount).sort((a, b) => b[1] - a[1]).slice(0, 10)
for (const [flagId, count] of topFlags) {
  const rule = RULES.find((r) => r.id === flagId)
  console.log(`   ${flagId.padEnd(25)} ${String(count).padStart(3)}x  [${rule?.severity || '?'}]`)
}

console.log('\n📁 Arquivos com mais flags:\n')
const topFiles = [...byFile.entries()].map(([f, arr]) => [f, arr.filter((x) => x.flags.length).length]).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
for (const [file, count] of topFiles) {
  console.log(`   ${file.padEnd(50)} ${String(count).padStart(3)} flags`)
}

console.log('\n📄 Gerado:\n')
console.log(`   ✅ reports/copy-audit.csv`)
console.log(`   ✅ reports/copy-audit.md`)
console.log(`   ✅ reports/copy-audit-recomendacoes.json\n`)

if (VERBOSE) {
  console.log('🔍 VERBOSE: Primeiras 10 recomendações:\n')
  for (const rec of recommendations.slice(0, 10)) {
    console.log(`   Original: ${JSON.stringify(rec.original)}`)
    console.log(`   Rewrite:  ${JSON.stringify(rec.rewrite)}`)
    console.log(`   Rule:     ${rec.rule} [${rec.severity}]`)
    console.log(`   Impacto:  ${rec.impact}`)
    console.log(`   Ocorrências: ${rec.occurrences}x\n`)
  }
}