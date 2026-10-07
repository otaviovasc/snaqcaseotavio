# SnaqFit · CRM de relacionamento

Protótipo executável para o case SnaqFit. A pergunta central do produto é simples:

> **Quem deve receber uma mensagem, qual mensagem deve receber e o que aconteceu depois?**

Esta entrega transforma as regras do case em uma operação demonstrável: separa aluno,
pagador e contato; respeita as responsabilidades de planos individual, familiar e
corporativo; permite revisar mensagens e artes antes de programar; e conecta cada
resultado à comunicação anterior, sem afirmar que ela causou o resultado.

O projeto é deliberadamente um **case local**, não um produto pronto para produção.
Os nomes, telefones, pagamentos, presenças e resultados são fictícios. Nenhuma mensagem
é enviada para WhatsApp real nesta versão.

## Comece em dois minutos

Pré-requisitos:

- Docker Desktop aberto;
- um arquivo `.env` na raiz, preenchido a partir de `.env.example`;
- portas locais disponíveis: `3087` para a aplicação e `55487` para o PostgreSQL.

Suba a aplicação:

```sh
# Apenas na primeira instalação, se .env ainda não existir:
cp .env.example .env
docker compose up --build -d
```

Abra [http://localhost:3087](http://localhost:3087).

Para validar a instalação dentro do container:

```sh
docker compose exec app npm run validate
```

Para acompanhar os logs:

```sh
docker compose logs -f app
```

Sem Docker, use Node.js 24 ou superior, PostgreSQL acessível pela `DATABASE_URL`,
depois execute:

```sh
npm ci
npm start
```

Não é preciso preencher chaves de Uazapi ou OpenRouter para demonstrar a plataforma.
No `.env`, `APP_PORT`/`POSTGRES_PORT` controlam as portas publicadas;
`POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD` configuram o banco;
`DATABASE_URL` e `TEST_DATABASE_URL` atendem à execução Node fora do Docker.
`WHATSAPP_MODE=simulation` e `UAZAPI_ALLOW_REAL_SEND=false` mantêm a configuração
de demonstração. O bloqueio de envio real também é imposto pelo código.

O `compose.yaml` inicia dois serviços: `app` e `postgres`. Os volumes nomeados
`snaqfit_data` e `snaqfit_postgres` preservam artes carregadas e o banco entre
reinicializações. O `.env` é carregado pelo Compose e não deve ser commitado.

## Roteiro rápido da demonstração

1. Abra a [Visão geral](http://localhost:3087/#overview) e explique o fluxo em três
   perguntas: quem recebe, qual mensagem e o que aconteceu.
2. Entre em [Campanhas](http://localhost:3087/#campaigns). Mostre as quatro regras,
   a imagem da campanha e as mensagens A/B por tipo de vínculo.
3. Abra [Operação de hoje](http://localhost:3087/#schedule). Escolha a data e a
   campanha, confira os destinatários e programe o lote. A tela de prévia é somente
   leitura; abrir a tela não envia nada.
4. Abra [Alunos](http://localhost:3087/#students) e mostre um caso familiar, um
   corporativo e um individual. A ficha deixa separados: quem treina, quem paga,
   quem recebe a cobrança, situação vencida e ações programadas.
5. Em [Resultados](http://localhost:3087/#metrics), explique pagamentos atribuídos,
   retornos aos treinos, adesões ao Ouro e continuidade. A comparação A/B mostra a
   diferença observada na amostra atual, sem declarar vencedor.
6. Termine no [Histórico](http://localhost:3087/#history), filtrando uma campanha
   específica e abrindo um registro para mostrar a mensagem e o resultado.

## O que está no escopo

Há quatro campanhas ativas, todas com regra, prioridade, mensagem, grupo de vínculo,
arte e comparação A/B:

| Campanha | Objetivo | Público demonstrado |
| --- | --- | --- |
| Lembrete de vencimento | lembrar a mensalidade antes do vencimento | responsáveis com cobrança próxima |
| Regularização de pagamento | orientar a resolução de saldo vencido | responsáveis com saldo em aberto |
| Retomada de frequência | convidar o aluno a voltar ao treino | aluno ativo afastado |
| Experimentação Ouro | apresentar o upgrade com risco controlado | aluno Prata frequente, antigo e adimplente |

O cenário possui **20 alunos fictícios**: 11 individuais, 6 integrantes de duas
famílias e 3 alunos corporativos. Esse número foi mantido pequeno o bastante para a
apresentação, mas cobre os três tipos de responsabilidade do case e alguns motivos
reais para uma pessoa não receber uma campanha: opt-out promocional, contestação,
histórico insuficiente, fonte de presença desatualizada, ausência de pagamento e
benefício já concedido.

Os planos seguem o PDF do case:

- Prata: R$ 200 por ciclo;
- Ouro: R$ 300 por ciclo;
- vencimento nominal no dia 7;
- upgrade promocional: um ciclo de experimentação sem cobrar o adicional de R$ 100,
  seguido de retorno ao Prata se não houver confirmação explícita.

### Responsabilidades financeiras

- **Individual:** o aluno também é o pagador e recebe a comunicação financeira.
- **Família:** um titular recebe uma cobrança consolidada. A ficha continua mostrando
  cada aluno e cada componente do total, para não confundir quem treina com quem paga.
- **Corporativo:** a empresa paga a base Prata de R$ 200; o aluno pode ser responsável
  pelo adicional Ouro de R$ 100. São obrigações separadas.

Essas distinções são o núcleo do case. Uma mensagem nunca deve atribuir a uma pessoa
uma dívida que pertence a outro responsável.

### Exemplos para apresentar sem percorrer os 20 cadastros

| Exemplo | O que comprova |
| --- | --- |
| [Ana](http://localhost:3087/#students?student=stu-ana) | Prata individual, R$ 200 vencidos |
| [Renata](http://localhost:3087/#students?student=stu-renata) | Ouro individual, R$ 300 pagos |
| [Bia](http://localhost:3087/#students?student=stu-bia) | Suas próprias presenças e Prata de R$ 200; Carlos paga a família: Ouro + dois Prata = R$ 700 |
| [Eduardo](http://localhost:3087/#students?student=stu-edu) | Empresa deve R$ 200; aluno deve somente o adicional de R$ 100 |
| [Fernanda](http://localhost:3087/#students?student=stu-fer) | Em dia, mas afastada dos treinos: mensagem de retomada |
| [Guilherme](http://localhost:3087/#students?student=stu-gui) | Prata antigo, frequente e em dia: oportunidade de upgrade |

Hoje há **10 ações programadas**: seis regularizações, uma retomada e três convites
Ouro. Julia, Sofia e Mauro estão em dia, evitando repetir cobranças desnecessárias.
Clique na ação programada de uma ficha para abrir seu registro exato, sem enviar nada.

### Regras propostas e por que adotá-las

Os preços e vínculos vêm do case. Os prazos abaixo são **premissas de negócio da
demonstração**, não políticas confirmadas pela academia.

| Regra | Decisão |
| --- | --- |
| Dia 7 no domingo ou feriado cadastrado | Próximo dia útil; preservar vencimento nominal e efetivo. Não há calendário completo de feriados nacionais |
| Lembrete | Dois dias úteis antes do vencimento efetivo, somente saldo aberto |
| Regularização | Após um dia útil completo de tolerância; segunda tentativa sete dias após a primeira aceita; depois, atendimento humano |
| Retomada | Contrato ativo, presença anterior e pelo menos 14 dias sem treinar; fonte de presença atualizada em até três dias |
| Oferta Ouro | Prata há 90 dias, seis dias de presença nos últimos 30 e última há menos de sete dias, em dia e três competências anteriores pagas pontualmente |
| Contato | Máximo de duas mensagens em sete dias corridos, intervalo mínimo de 48h e uma por dia; dias úteis, 10h–18h, horário de São Paulo |
| Prioridade | Regularização → lembrete → retomada → oferta; decisão por telefone, inclusive compartilhado |
| Permissão | Opt-out, contestação e informação de “já paguei” bloqueiam/pausam a automação pertinente para conferência |
| Experiência Ouro | Convite válido por 14 dias, um uso por aluno, limite inicial de cinco concessões; começa no próximo ciclo após aceite financeiro |

Na família, o titular autoriza o aumento. No corporativo, a empresa mantém os R$ 200
da base e o aluno autoriza os R$ 100 particulares. O benefício dispensa **somente o
adicional** no primeiro ciclo: não é academia grátis. Ao terminar, volta ao Prata
salvo confirmação explícita de continuidade. Silêncio não autoriza cobrança.

**Racional:** priorizei responsabilidade financeira e proteção do contato porque
uma cobrança errada prejudica confiança e caixa. A retomada cuida da relação antes
de oferecer um plano mais caro; o upgrade aparece para quem já percebe valor no
treino. Quatro campanhas resolvem as principais histórias do case sem um editor de
workflows. A experiência Ouro reduz o risco percebido, mas preserva a escolha do
pagador. Esses critérios devem ser validados com a operação antes de uso real.

## Como a operação funciona

O fluxo implementado é intencionalmente linear:

```text
regras da campanha
        ↓
prévia de elegibilidade
        ↓
programação idempotente
        ↓
simulação de envio
        ↓
evento observado (pagamento, presença ou resposta)
        ↓
resultado atribuído à comunicação
```

Antes de programar, o sistema aplica elegibilidade, prioridades, limite de contato,
permissões do contato, janela mínima entre mensagens e conflitos de campanhas. Quando
há telefone compartilhado, a prioridade escolhe uma comunicação; a outra fica
explicada como adiada ou fora daquela campanha. Isso reduz a sensação de “não deve
receber” e torna a decisão auditável.

A programação é idempotente: repetir a mesma prévia não cria cópias. A execução padrão
é sempre simulada. Pagamento integral cancela mensagens financeiras pendentes;
presença cancela retomada pendente; duas tentativas de regularização podem criar uma
pendência para atendimento humano. Resultado desconhecido não é reenviado
automaticamente.

## Dados simulados e observabilidade

O relógio inicial do cenário é **09/10/2026**. O histórico demonstrativo cobre agosto e
setembro de 2026 e é criado pelo módulo `src/demo-history.mjs`. Ele contém 21
comunicações históricas, eventos de pagamento, presença e resposta, além de três
experimentações do Ouro; os resultados são marcados como dados de demonstração.

Em uma base nova, o servidor prepara automaticamente o cenário compacto, o histórico
de dois meses e a fila demonstrativa de hoje. Para uma base persistente já alterada,
o reset abaixo restaura o caso antes de recarregar a demonstração:

```sh
curl -X POST http://localhost:3087/api/case-demo \
  -H 'Content-Type: application/json' -d '{}'
curl -X POST http://localhost:3087/api/demo-history \
  -H 'Content-Type: application/json' -d '{"months":2}'
curl -X POST http://localhost:3087/api/schedule \
  -H 'Content-Type: application/json' -d '{"date":"2026-10-09"}'
```

O primeiro comando é destrutivo para os dados da demonstração atual: use-o apenas para
reiniciar o case. O histórico é aditivo e idempotente. Como o banco tem volume
persistente, reiniciar o container não apaga o que já foi simulado.

## Mensagens, imagens e A/B

As mensagens são editáveis em Campanhas. Cada campanha tem versões A e B por grupo de
vínculo: individual, família e corporativo. O grupo familiar fala com o titular; o
corporativo diferencia a base paga pela empresa do adicional pago pelo aluno.

As mensagens usam os campos `{{nome}}`, `{{valor}}`, `{{vencimento}}`, `{{contexto}}` e
`{{responsavel}}`. O sistema preenche os valores a partir da obrigação correta e
registra a mensagem final na comunicação.

A variante A/B é distribuída de forma estável por contato, não muda a cada renderização
e mantém um telefone compartilhado no mesmo grupo. Resultados pequenos são exibidos
com contagens e taxas; a interface usa a linguagem “à frente nesta amostra” quando
as duas versões possuem entregas observadas, sem transformar uma amostra pequena em conclusão
comercial.

Em Resultados, cada campanha mostra seu objetivo e os registros correspondentes:
lembrete mede pagamento até o vencimento; regularização mede pagamento em sete dias;
retomada mede presença em sete dias; Ouro separa aceite, uso do benefício e confirmação
de continuidade. Confirmação não é receita: somente pagamento registrado é dinheiro
recebido. O A/B compara resultados/entregas dentro do mesmo grupo de vínculo e objetivo,
mostrando numerador e denominador. Não há controle sem mensagem, teste de significância
ou prova de causalidade. Custos não informados não são considerados zero e não há ROI.

Há uma arte local aprovada por campanha em `assets/campaigns/`. A geração externa por
OpenRouter existe como adaptador opcional e só acontece por ação explícita; não é
necessária para rodar o case e pode consumir créditos.

## Uazapi: baixo custo e integração simples para o case

Escolhemos a **Uazapi pela proposta de baixo custo e facilidade de integração**, além
de já termos uma instância de teste disponível. Para esta primeira versão, isso reduz
a barreira de experimentar o canal sem transformar a contratação do provedor no foco
do case. É a motivação da escolha, não uma comparação comprovada de preços: o custo
real depende do plano, quantidade de instâncias, limites e condições vigentes.

A [documentação da Uazapi](https://docs.uazapi.com/) descreve uma API HTTP para sessões,
mensagens e eventos. O app foi preparado para esse contrato em `src/uazapi.mjs`, sem
espalhar detalhes do provedor pelas regras de família, cobrança e upgrade.

### O que já está preparado

- `UazapiAdapter` recebe URL do servidor e token pelo backend. Os valores ficam no
  `.env` da raiz, não nos arquivos públicos ou mensagens.
- `textPayload()` traduz uma comunicação em `number`, `text`, `track_source` e
  `track_id`. O identificador da comunicação permite relacionar o envio ao histórico.
- `sendText()` prepara `POST /send/text`, autenticação pelo header `token`, URL HTTPS
  e timeout de 15 segundos, conforme o contrato adotado no adaptador.
- A resposta distingue envio **aceito** de entrega. Falha de rede ou resposta incerta
  fica como resultado desconhecido, para conferência antes de qualquer nova tentativa.
- `/api/integration` informa apenas se os campos estão configurados; não revela token
  e não consulta a instância.
- A régua, o texto final, a variante A/B, o destinatário e a imagem ficam registrados
  antes da execução. Conectar o transporte não exige refazer essas decisões de negócio.

Variáveis reservadas no `.env`: `UAZAPI_BASE_URL`, `UAZAPI_INSTANCE_NAME`,
`UAZAPI_TOKEN`, `UAZAPI_CONNECTED_NUMBER` e `UAZAPI_ALLOW_REAL_SEND=false`.
A URL deve ser a **Server URL do painel**, não o nome da instância.

### O que falta para conectar de verdade

O adaptador **ainda não está ligado à execução da fila**. Alterar uma variável não
ativa envio real: `/api/execute` aceita somente simulação e o adaptador bloqueia envio
por padrão. Respeitamos a orientação de parar antes de testar a instância.

Em uma próxima etapa autorizada, será necessário ligar o adaptador à fila, persistir
o identificador retornado pelo provedor, implementar envio da imagem e tratar webhooks
de entrega/resposta com correlação e processamento idempotente. As imagens de
`localhost` não são acessíveis ao provedor; mídia precisa de um formato ou endereço
compatível. O ngrok pode expor o webhook no teste local, mas sozinho não completa a
integração nem disponibiliza automaticamente as artes.

O primeiro teste deve usar um único destinatário autorizado, com conferência do texto,
imagem e resultado. Não fizemos chamadas reais à Uazapi nesta entrega. Facilidade e
baixo custo não dispensam avaliar termos do provedor, privacidade, disponibilidade e
risco operacional do canal antes de uso comercial.

## Arquitetura

- `src/server.mjs`: servidor HTTP, API local, arquivos estáticos e proteção de origem.
- `src/domain.mjs`: regras de elegibilidade, programação, execução simulada, eventos e
  métricas.
- `src/store.mjs`: persistência PostgreSQL e materialização transacional.
- `src/demo-history.mjs`: dados históricos determinísticos de dois meses.
- `src/uazapi.mjs`: contrato preparado para uma etapa futura de integração; bloqueia
  envio real nesta versão.
- `src/images.mjs`: configuração e geração opcional de artes, com cache e limite.
- `public/app.js`: navegação e telas operacionais.
- `public/results.js` e `public/results.css`: resultados por campanha e comparação A/B.
- `db/schema.sql`: schema relacional de inspeção.

O PostgreSQL é o único banco. O estado completo da demonstração é guardado em
`app_state.document` como JSONB e, na mesma transação, é materializado em tabelas de
contatos, pagadores, alunos, obrigações, itens de obrigação, presenças, campanhas,
comunicações, pagamentos, ofertas e tarefas. A abordagem é adequada para um case
pequeno e torna a inspeção no Postico clara; não é uma recomendação de modelagem final
para uma operação de produção.

## API local útil

| Método | Caminho | Uso |
| --- | --- | --- |
| GET | `/api/health` | verificar se a aplicação está viva |
| GET | `/api/state` | obter o snapshot da demonstração |
| GET | `/api/integration` | ver que o modo está em simulação, sem expor credenciais |
| GET | `/api/export.csv` | exportar comunicações registradas |
| POST | `/api/preview` | calcular elegibilidade sem alterar dados |
| POST | `/api/schedule` | programar os elegíveis da prévia |
| POST | `/api/execute` | registrar a execução simulada |
| POST | `/api/events` | registrar pagamento, presença ou resposta |
| POST | `/api/demo-history` | carregar o histórico fictício de dois meses |
| POST | `/api/case-demo` | restaurar o caso compacto inicial |

## Banco local

O banco é PostgreSQL 17. A porta publicada padrão é `55487`, o nome do banco e o
usuário são configurados no `.env`, e o acesso local usa a senha definida pelo
desenvolvedor nesse arquivo. Não há credenciais neste README. Para conectar pelo
Postico, use `127.0.0.1`, a porta publicada, o nome de banco e usuário do `.env`, com
SSL desativado.

Os valores de `.env.example` são exclusivamente locais: banco e usuário `snaqfit`,
porta `55487` e senha `localSnaqfitDemo2026`. Não reutilize essa senha fora do case.

As tabelas principais estão em `db/schema.sql`. Em particular, `obligation_items`
permite conferir quem treina em cada componente financeiro, `presences` permite
inspecionar frequência e `communications` mantém mensagem, variante, campanha e
resultado. Alterações de negócio devem ser feitas pela aplicação ou pelos endpoints
locais, não manualmente nas tabelas materializadas.

## Testes e verificações

```sh
npm run check      # valida sintaxe de backend e frontend
npm test           # testes de domínio, API, persistência, histórico e imagens
npm run validate   # check + test
```

Os testes usam schemas PostgreSQL isolados; parte deles mantém schemas `test_*` para
inspeção, sem alterar a demonstração no schema `public`. A
suíte verifica, entre outros pontos, responsabilidade familiar/corporativa,
idempotência, A/B estável, pagamento integral/parcial, presença, prioridade,
benefício Ouro, persistência após reabrir, histórico de dois meses, upload de imagem,
proteção de origem e bloqueio de envio real.

Na revisão desta entrega, os **29 testes passaram**. Também foi conferida a navegação
no navegador: ficha da Bia e presenças individuais, link para a ação programada,
filtros de data/campanha, histórico por campanha, comparação A/B e ficha em tela móvel.

## Fora do escopo desta entrega

Não fazem parte do case executável: envio real pela Uazapi, webhooks públicos,
autenticação, multiunidade, permissões de equipe, gateway de pagamento, integração de
catraca, chatbot, segmentação ilimitada, filas distribuídas, observabilidade de
produção, LGPD operacional, publicação em nuvem e cobrança real.

O adaptador Uazapi fica preparado, mas `UAZAPI_ALLOW_REAL_SEND=false` e o endpoint de
execução rejeita modos reais. Não é necessário ngrok ou uma Server URL para avaliar a
primeira versão. Se uma etapa posterior autorizar um teste controlado, ela deve começar
com um único número de teste e uma revisão explícita do payload e do webhook.

Não há agendador em segundo plano: a régua é calculada para uma data informada e
executada manualmente no painel. O servidor é uma única instância local, sem controle
de concorrência entre múltiplos processos. Uazapi e OpenRouter reais não foram
testados; os testes de integração externa usam respostas simuladas. Os links
`snaq.co` das mensagens são ilustrativos, não realizam pagamentos ou adesões.

A IA foi usada como apoio na implementação, revisão e criação das quatro artes.
Os briefings estão em `assets/campaigns/PROMPTS.md`; as regras permanecem verificáveis
no código e nos testes. A entrega não depende da pasta privada `docs/`, ignorada no Git.

## Decisões de negócio para discutir

1. A responsabilidade financeira é a fonte da verdade para decidir o destinatário.
2. Uma campanha tem objetivo único e uma janela de resultado explícita.
3. Mensagens financeiras são separadas de mensagens de frequência e de upgrade.
4. A experimentação Ouro é uma oferta de baixo risco: o adicional é gratuito apenas
   no primeiro ciclo e a continuidade exige confirmação.
5. O sistema prefere explicar uma exclusão ou adiamento a criar contato duplicado ou
   cobrança para a pessoa errada.
6. Métricas distinguem entrega, resposta, pagamento, retorno e continuidade; uma
   entrega não é automaticamente um pagamento.

Essas decisões mantêm o protótipo fiel ao case, deixam o raciocínio comercial visível
e formam uma base objetiva para discutir com o supervisor quais regras devem virar
política real da SnaqFit.
