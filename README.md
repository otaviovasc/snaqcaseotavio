# SnaqFit — régua de CRM

Quem recebe mensagem hoje, qual mensagem e o que aconteceu depois?

Quatro ações a partir de cadastro, mensalidade e presença: lembrete, regularização, retomada e oferta Ouro. Dados fictícios e envio simulado, como o case permite.

## Como rodar

Na pasta do projeto, com Docker Desktop aberto e portas `3087` e `55487` disponíveis:

```sh
# Cria .env sem substituir um arquivo existente.
cp -n .env.example .env
docker compose up --build -d
docker compose ps
```

Quando os serviços estiverem saudáveis, abra [localhost:3087](http://localhost:3087). Não precisa instalar Node ou PostgreSQL na máquina nem preencher chaves externas.

**O seed faz parte do setup:** na primeira inicialização de uma base nova, o app cria 20 alunos (11 individuais, duas famílias com seis integrantes e três corporativos), cobranças e presenças; quatro campanhas com mensagens A/B e imagens; 21 comunicações históricas, 16 eventos e três experiências Ouro de agosto/setembro. Também programa dez ações para 09/10/2026, sem enviá-las. Os exemplos são definidos em `src/domain.mjs` e `src/demo-history.mjs`; não há arquivo de dados externo para importar.

O banco fica em um volume persistente. Reiniciar **não reaplica o seed nem apaga eventos**. Se você já usou a demonstração, seus totais podem ter mudado.

<details>
<summary>Restaurar os mesmos dados iniciais da demonstração</summary>

**Atenção: isso apaga as alterações atuais do case.** Faça backup se precisar preservá-las. Com o app rodando, execute nesta ordem:

```sh
curl --fail -X POST http://localhost:3087/api/case-demo \
  -H 'Content-Type: application/json' -d '{}'
curl --fail -X POST http://localhost:3087/api/demo-history \
  -H 'Content-Type: application/json' -d '{}'
curl --fail -X POST http://localhost:3087/api/schedule \
  -H 'Content-Type: application/json' -d '{"date":"2026-10-09"}'
```

Atualize a página. Os comandos restauram cadastros, histórico e programação; não enviam WhatsApp.

</details>

## O que mostrar

1. [Alunos](http://localhost:3087/#students): quem treina, quem paga, presenças, saldo vencido e ações programadas.
2. [Campanhas](http://localhost:3087/#campaigns): mensagem e imagem de cada campanha; textos A/B editáveis por vínculo.
3. [Operação](http://localhost:3087/#schedule): escolha uma data e confira quem recebe o quê. Abrir a tela não envia nada.
4. [Histórico](http://localhost:3087/#history) e [Resultados](http://localhost:3087/#metrics): confira o que aconteceu após cada comunicação.

## Decisões que resolvem o case

| Questão | Escolha e motivo |
| --- | --- |
| Planos | Prata R$ 200; Ouro R$ 300; vencimento nominal dia 7, conforme o case |
| Família | Carlos paga R$ 700: Ouro + dois Prata. [Bia](http://localhost:3087/#students?student=stu-bia) tem presenças próprias; cobrança vai só ao titular |
| Corporativo | No [Eduardo](http://localhost:3087/#students?student=stu-edu), empresa paga R$ 200; aluno, R$ 100. Não transferimos dívida entre eles |
| Dia 7 no domingo | Vencimento no próximo dia útil; feriados apenas quando cadastrados |
| Evitar excesso | Até duas mensagens em sete dias por telefone, mínimo 48h, uma por dia; dias úteis, 10h–18h, São Paulo |
| Ouro | Um ciclo sem o adicional de R$ 100; Prata continua pago. Começa no próximo ciclo após aceite. Sem confirmação de continuidade, volta ao Prata |

### Quando agir

| Campanha | Regra utilizada |
| --- | --- |
| Lembrete | Saldo aberto, dois dias úteis antes do vencimento efetivo |
| Regularização | Saldo vencido após um dia útil completo de tolerância; segunda tentativa sete dias depois da primeira aceita; após duas, atendimento humano |
| Retomada | Contrato ativo, presença anterior e 14 dias sem treino; fonte atualizada em até três dias |
| Oferta Ouro | Prata há 90 dias, seis dias de treino nos últimos 30 e último há menos de sete dias, sem saldo vencido, três últimas competências vencidas pagas pontualmente e autorização promocional |

Prioridade por telefone: regularização → lembrete → retomada → oferta. Pagamento integral cancela cobrança pendente; presença cancela retomada. Contestação, “já paguei” e pedido para não receber interrompem a ação pertinente. Repetir uma programação não duplica mensagens.

O convite Ouro vale 14 dias, com um benefício por aluno e limite inicial de cinco concessões. Quem assumirá o adicional autoriza: aluno individual, titular familiar ou funcionário pelo adicional corporativo.

Prazos e promoção são propostas, não políticas confirmadas. Priorizamos cobrança correta, retomada e depois expansão. O foco é resolver as histórias do case com clareza, sem automações ilimitadas.

## Padrão de comunicação

Profissional, amigável e com uma ação principal: conferir/pagar, voltar ao treino ou conhecer o Ouro. Cobrança oferece ajuda sem constranger; retomada acolhe sem culpa; upgrade explica valor, condição e escolha de quem paga. Não misturamos cobrança com promoção nem anunciamos “academia grátis”. Links `snaq.co` são ilustrativos; benefícios reais do Ouro ainda precisam de aprovação.

Cada campanha tem uma arte reutilizável e textos A/B para individual, família e corporativo. O mesmo telefone mantém sua versão, evitando comunicação contraditória na família. Editar a campanha não reescreve mensagens já registradas.

## Como saber se funcionou

Medimos pagamento até o vencimento, regularização em sete dias, presença em sete dias e aceite/uso/continuidade do Ouro. Resposta não é presença; aceite e confirmação não são receita recebida. Sem custos conhecidos, não calculamos retorno financeiro.

O A/B mostra quantidades e taxas por vínculo: quem está à frente **nesta amostra**, sem vencedor declarado. Dados fictícios não provam eficácia ou causalidade.

## Por que Uazapi

Escolhida pela proposta de baixo custo e integração simples; preço depende do plano. O adaptador prepara destinatário, texto e identificação, com credenciais no `.env`. Na prévia, abra “Como seria enviada pelo WhatsApp?” para conferir o pedido preparado.

**Envio real está bloqueado e não foi testado.** Ainda falta conectar o adaptador à execução e validar imagens, entrega e respostas. A demonstração funciona sem isso.

## O que ficou de fora

Envio automático em segundo plano, pagamento bancário, catraca real, login de equipe e publicação. O foco é demonstrar a régua, não entregar um produto de produção.

Node.js e PostgreSQL rodam no Docker. Para validar:

```sh
docker compose exec app npm run validate
```

IA apoiou implementação e artes. Os testes verificam vínculos, régua, eventos e persistência.
