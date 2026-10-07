import { createStore } from './store.mjs';
import { seedDemoHistory } from './demo-history.mjs';

const TZ_SUFFIX = 'T11:00:00-03:00';
const DAY = 86_400_000;
const money = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateOnly = (value) => String(value).slice(0, 10);
const addDays = (date, days) => {
  const value = new Date(`${dateOnly(date)}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const deepCopy = (value) => structuredClone(value);
const byId = (items, id) => items.find((item) => item.id === id);
const isoAt = (date, hour = 11) => `${dateOnly(date)}T${String(hour).padStart(2, '0')}:00:00-03:00`;
const daysBetween = (a, b) => Math.floor((new Date(`${dateOnly(b)}T12:00:00Z`) - new Date(`${dateOnly(a)}T12:00:00Z`)) / DAY);
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value;
const nextMonth = (period) => { const value=new Date(`${period}-01T12:00:00Z`); value.setUTCMonth(value.getUTCMonth()+1); return value.toISOString().slice(0,7); };
const monthRange = (after, through) => { const result=[]; for(let month=nextMonth(after);month<=through;month=nextMonth(month))result.push(month); return result; };

export function defaultMessageGroups(type) {
  const messages = {
    reminder: {
      individual: { A:'Olá, {{nome}}! Seu próximo treino merece espaço na agenda. Para ajudar na organização, {{contexto}}, no valor de {{valor}}, vence em {{vencimento}}. Confira os detalhes: https://snaq.co/mensalidade. Se já pagou, desconsidere. Conte com a SnaqFit!', B:'Oi, {{nome}}! Um lembrete rápido para você se organizar: o vencimento de {{contexto}} é {{vencimento}}, no valor de {{valor}}. Veja os detalhes em https://snaq.co/mensalidade. Se já estiver tudo certo, até o próximo treino!' },
      family: { A:'Olá, {{nome}}! Passando para facilitar a organização dos treinos da família: o total dos planos, {{valor}}, vence em {{vencimento}}. Os detalhes estão reunidos em https://snaq.co/mensalidade. Se já pagou, desconsidere. Conte com a gente!', B:'Oi, {{nome}}! Para deixar a rotina da família mais tranquila, lembramos que a mensalidade dos planos soma {{valor}} e vence em {{vencimento}}. Confira tudo em um só lugar: https://snaq.co/mensalidade. Se já estiver pago, pode desconsiderar.' },
      corporate: { A:'Olá, {{nome}}! Este é um lembrete da SnaqFit sobre {{contexto}}: {{valor}}, com vencimento em {{vencimento}}. Confira a composição e os detalhes em https://snaq.co/mensalidade. Caso já tenha pago, desconsidere. Estamos à disposição.', B:'Olá, {{nome}}! Para apoiar sua organização financeira, {{contexto}} vence em {{vencimento}}, no valor de {{valor}}. Consulte os detalhes em https://snaq.co/mensalidade. Esta cobrança corresponde somente ao componente informado. Se já pagou, desconsidere.' },
    },
    collection: {
      individual: { A:'Olá, {{nome}}! Consta um saldo de {{valor}} em aberto sobre {{contexto}}, com vencimento em {{vencimento}}. Vamos conferir juntos? Veja os detalhes em https://snaq.co/mensalidade. Se já pagou ou encontrou alguma divergência, responda aqui para nossa equipe verificar.', B:'Oi, {{nome}}! Queremos ajudar a resolver uma pendência de {{valor}} sobre {{contexto}}, vencida em {{vencimento}}. Consulte em https://snaq.co/mensalidade. Se precisar de apoio ou já tiver pago, pode nos responder por aqui. Vamos cuidar disso com você.' },
      family: { A:'Olá, {{nome}}! Identificamos um saldo total de {{valor}} em aberto nos planos da família, com vencimento em {{vencimento}}. Reunimos os detalhes em https://snaq.co/mensalidade para facilitar a conferência. Se já pagou ou precisar de ajuda, responda aqui: nossa equipe acompanha com você.', B:'Oi, {{nome}}! Podemos ajudar a conferir a mensalidade da família? O saldo em aberto é {{valor}}, referente ao vencimento de {{vencimento}}. Veja a composição em https://snaq.co/mensalidade. Se houver uma divergência ou o pagamento já tiver sido feito, nos avise por aqui.' },
      corporate: { A:'Olá, {{nome}}! Consta um saldo de {{valor}} sobre {{contexto}}, vencido em {{vencimento}}. A composição está em https://snaq.co/mensalidade. Se o pagamento já foi feito ou houver uma divergência, responda a esta mensagem para conferirmos. Conte com o atendimento SnaqFit.', B:'Olá, {{nome}}! Vamos conferir uma pendência sobre {{contexto}}? O saldo é {{valor}}, com vencimento em {{vencimento}}. Consulte os detalhes em https://snaq.co/mensalidade. Podemos apoiar a regularização ou verificar um pagamento informado, sem misturar os componentes do contrato.' },
    },
    return: {
      individual: { A:'Oi, {{nome}}! Que tal reservar um momento da semana para você? A SnaqFit está de portas abertas para sua volta, um treino de cada vez. Combine o próximo passo com nossa equipe: https://snaq.co/voltar. Vamos no seu ritmo!', B:'Olá, {{nome}}! Voltar à rotina pode começar com um treino. Nossa equipe pode ajudar você a organizar esse recomeço, sem pressão. Quer combinar sua próxima visita? https://snaq.co/voltar. Vai ser bom ter você por aqui!' },
      family: { A:'Oi, {{nome}}! Que tal encaixar os treinos na rotina da família de novo? A gente ajuda a combinar uma retomada que faça sentido, respeitando o ritmo de cada pessoa. Fale com nossa equipe em https://snaq.co/voltar. Um passo de cada vez!', B:'Olá, {{nome}}! Estamos por aqui para apoiar a volta aos treinos. Pode ser uma visita para reorganizar a rotina e escolher o próximo passo, com tranquilidade. Combine com nossa equipe: https://snaq.co/voltar. Conte com a SnaqFit!' },
      corporate: { A:'Oi, {{nome}}! Entre os compromissos da semana, que tal abrir um espaço para o seu treino? A gente ajuda você a retomar no seu ritmo. Combine sua próxima visita em https://snaq.co/voltar. Vai ser bom ter você de volta!', B:'Olá, {{nome}}! Seu próximo treino pode ser um recomeço simples. Se quiser apoio para voltar à rotina, nossa equipe está por aqui. Combine o primeiro passo: https://snaq.co/voltar. Sem pressão, no seu tempo.' },
    },
    offer: {
      individual: { A:'Oi, {{nome}}! Você já fez do treino parte da rotina. Que tal descobrir se o Ouro combina com seu próximo passo? Experimente por um ciclo sem pagar o adicional de R$ 100. Seu Prata de R$ 200 continua pago. Após o aceite, a experiência começa no próximo ciclo; depois, você volta ao Prata, a menos que confirme o Ouro por R$ 300/mês. Convite válido por 14 dias. Conheça as condições e escolha: https://snaq.co/ouro', B:'Olá, {{nome}}! Conheça o Ouro antes de decidir. Você tem um convite para experimentar um ciclo com o adicional de R$ 100 por nossa conta, mantendo o Prata de R$ 200 pago. Ativação no próximo ciclo após seu aceite. Ao final, volta ao Prata; só segue no Ouro por R$ 300/mês se você confirmar. Veja o que muda entre os planos e escolha em até 14 dias: https://snaq.co/ouro' },
      family: { A:'Oi, {{nome}}! Que tal conhecer o Ouro e descobrir se ele combina com a rotina de treinos? Há um convite para experimentar um ciclo sem o adicional de R$ 100 para o aluno elegível, mantendo o Prata pago pela família. A ativação começa no próximo ciclo, com autorização do responsável financeiro. Depois, volta ao Prata; continuar no Ouro exige confirmar o adicional de R$ 100/mês por aluno. Convite válido por 14 dias. Veja as condições: https://snaq.co/ouro', B:'Olá, {{nome}}! Experimentar antes de escolher pode facilitar a decisão. O aluno elegível da família pode conhecer o Ouro por um ciclo sem o adicional de R$ 100. O Prata segue pago, e o responsável financeiro autoriza o início no próximo ciclo. Ao final, volta ao Prata, salvo confirmação do adicional de R$ 100/mês por aluno. Compare os planos e decida em até 14 dias: https://snaq.co/ouro' },
      corporate: { A:'Oi, {{nome}}! Que tal dar o próximo passo na sua experiência de treino? Conheça o Ouro por um ciclo sem o adicional de R$ 100. A empresa mantém a base Prata de R$ 200, e a ativação começa no próximo ciclo após seu aceite. Depois, você volta ao Prata; só continua no Ouro se confirmar o adicional particular de R$ 100/mês, pago por você. Convite válido por 14 dias. Confira e escolha: https://snaq.co/ouro', B:'Olá, {{nome}}! Você pode experimentar o Ouro antes de assumir um novo valor. No primeiro ciclo, o adicional de R$ 100 fica por nossa conta; a empresa segue pagando a base Prata de R$ 200. Após seu aceite, o benefício começa no próximo ciclo. Ao final, volta ao Prata: continuar exige sua confirmação para pagar o adicional particular de R$ 100/mês. Compare os planos e decida em até 14 dias: https://snaq.co/ouro' },
    },
  };
  return structuredClone(messages[type]);
}

function validateMessageGroups(value) {
  if(!value||typeof value!=='object')throw new Error('messageGroups deve conter individual, family e corporate');
  for(const group of ['individual','family','corporate'])for(const variant of ['A','B']){
    const text=value[group]?.[variant];
    if(typeof text!=='string'||text.trim().length<20||text.length>800)throw new Error(`messageGroups.${group}.${variant} deve ter entre 20 e 800 caracteres`);
  }
}

function nextBusinessDay(date, holidays) {
  let result = dateOnly(date);
  while ([0, 6].includes(new Date(`${result}T12:00:00Z`).getUTCDay()) || holidays.includes(result)) result = addDays(result, 1);
  return result;
}

function addBusinessDays(date, amount, holidays) {
  let result = dateOnly(date);
  for (let remaining = amount; remaining > 0;) {
    result = addDays(result, 1);
    if (![0, 6].includes(new Date(`${result}T12:00:00Z`).getUTCDay()) && !holidays.includes(result)) remaining--;
  }
  return result;
}

function subtractBusinessDays(date, amount, holidays) {
  let result = dateOnly(date);
  for (let remaining = amount; remaining > 0;) {
    result = addDays(result, -1);
    if (![0, 6].includes(new Date(`${result}T12:00:00Z`).getUTCDay()) && !holidays.includes(result)) remaining--;
  }
  return result;
}

function seedState() {
  const contacts = [
    ['ct-ana', 'Ana Lima', '5511990000001'], ['ct-carlos', 'Carlos Nunes', '5511990000002'],
    ['ct-empresa', 'Financeiro Acme', '5511990000003'], ['ct-edu', 'Eduardo Reis', '5511990000004'],
    ['ct-fer', 'Fernanda Luz', '5511990000005'], ['ct-gui', 'Guilherme Alves', '5511990000006'],
    ['ct-igor', 'Igor Dias', '5511990000007'], ['ct-julia', 'Julia Paz', '5511990000008'],
    ['ct-karen', 'Karen Melo', '5511990000009'], ['ct-leo', 'Leo Vaz', '5511990000010'],
    ['ct-marina', 'Marina Reis', '5511990000011'],
  ].map(([id, name, phone]) => ({ id, name, phone, financialAllowed: true, promotionalAllowed: id !== 'ct-igor', automationBlocked: false }));
  const payers = [
    ['pay-ana', 'Ana Lima', 'person', 'ct-ana'], ['pay-family', 'Carlos Nunes', 'person', 'ct-carlos'],
    ['pay-acme', 'Acme Ltda.', 'company', 'ct-empresa'], ['pay-edu', 'Eduardo Reis', 'person', 'ct-edu'],
    ['pay-fer', 'Fernanda Luz', 'person', 'ct-fer'], ['pay-gui', 'Guilherme Alves', 'person', 'ct-gui'],
    ['pay-igor', 'Igor Dias', 'person', 'ct-igor'], ['pay-julia', 'Julia Paz', 'person', 'ct-julia'],
    ['pay-karen', 'Karen Melo', 'person', 'ct-karen'], ['pay-leo', 'Leo Vaz', 'person', 'ct-leo'],
    ['pay-marina', 'Marina Reis', 'person', 'ct-marina'],
  ].map(([id, name, kind, contactId]) => ({ id, name, kind, contactId }));
  const students = [
    ['stu-ana', 'Ana Lima', 'Centro', 'silver', 'pay-ana', 'individual', 'ct-ana', '2026-01-10', ['2026-10-08','2026-10-05','2026-10-02','2026-09-29','2026-09-25','2026-09-21']],
    ['stu-carlos', 'Carlos Nunes', 'Centro', 'gold', 'pay-family', 'family', 'ct-carlos', '2025-01-01', ['2026-10-06','2026-10-01']],
    ['stu-bia', 'Bia Nunes', 'Centro', 'silver', 'pay-family', 'family', 'ct-carlos', '2026-02-01', ['2026-10-08','2026-10-06','2026-10-03','2026-10-01','2026-09-29','2026-09-27']],
    ['stu-davi', 'Davi Nunes', 'Centro', 'silver', 'pay-family', 'family', 'ct-carlos', '2026-03-01', ['2026-09-20']],
    ['stu-edu', 'Eduardo Reis', 'Paulista', 'gold', 'pay-edu', 'corporate', 'ct-edu', '2025-10-01', ['2026-10-08','2026-10-05','2026-10-02']],
    ['stu-fer', 'Fernanda Luz', 'Paulista', 'silver', 'pay-fer', 'individual', 'ct-fer', '2025-01-01', ['2026-09-20','2026-09-15']],
    ['stu-gui', 'Guilherme Alves', 'Centro', 'silver', 'pay-gui', 'individual', 'ct-gui', '2025-01-01', ['2026-10-08','2026-10-06','2026-10-04','2026-10-02','2026-09-30','2026-09-28','2026-09-25']],
    ['stu-igor', 'Igor Dias', 'Centro', 'silver', 'pay-igor', 'individual', 'ct-igor', '2025-02-01', ['2026-10-08','2026-10-04','2026-10-01','2026-09-29','2026-09-27','2026-09-25']],
    ['stu-julia', 'Julia Paz', 'Centro', 'silver', 'pay-julia', 'individual', 'ct-julia', '2026-09-01', ['2026-10-07','2026-10-03']],
    ['stu-karen', 'Karen Melo', 'Paulista', 'silver', 'pay-karen', 'individual', 'ct-karen', '2025-01-01', ['2026-10-07']],
    ['stu-leo', 'Leo Vaz', 'Paulista', 'silver', 'pay-leo', 'individual', 'ct-leo', '2025-01-01', ['2026-09-18']],
    ['stu-marina', 'Marina Reis', 'Centro', 'silver', 'pay-marina', 'individual', 'ct-marina', '2025-01-01', ['2026-09-01']],
  ].map(([id,name,unit,plan,payerId,kind,contactId,planSince,attendance]) => ({ id,name,unit,plan,status:'active',payerId,payerName:byId(payers,payerId)?.name,kind,contactId,planSince,attendance,lastAttendance:attendance[0] ?? null,isMinor:id==='stu-davi',presenceSourceUpdatedAt:id==='stu-marina'?'2026-09-05':'2026-10-09',corporateBasePayerId:id==='stu-edu'?'pay-acme':null,corporateUpgradeAllowed:id==='stu-edu' }));
  const obligations = [];
  const addObligation = (id,payerId,studentIds,period,dueDate,amountCents,paidCents,paidAt,items,status) => obligations.push({ id,payerId,payerName:byId(payers,payerId).name,studentIds,period,dueDate,nominalDue:`${period}-07`,amountCents,paidCents,balanceCents:amountCents-paidCents,status:status ?? (paidCents>=amountCents?'paid':dueDate<'2026-10-09'?'overdue':'open'),paidAt,items });
  const histories = [
    ['pay-ana','stu-ana',20000,['2026-07-07','2026-08-07','2026-09-07']],
    ['pay-family','stu-carlos',70000,['2026-07-07','2026-08-10','2026-09-09']],
    ['pay-fer','stu-fer',20000,['2026-07-07','2026-08-07','2026-09-07']],
    ['pay-gui','stu-gui',20000,['2026-07-07','2026-08-07','2026-09-07']],
    ['pay-igor','stu-igor',20000,['2026-07-07','2026-08-07','2026-09-07']],
    ['pay-karen','stu-karen',20000,['2026-07-12','2026-08-13','2026-09-07']],
    ['pay-leo','stu-leo',20000,['2026-07-07','2026-08-07','2026-09-07']],
    ['pay-marina','stu-marina',20000,['2026-07-07','2026-08-07','2026-09-07']],
  ];
  for (const [payerId, studentId, amount, paidDates] of histories) paidDates.forEach((paidAt, index) => {
    const month = String(index + 7).padStart(2,'0');
    const studentIds=payerId==='pay-family'?['stu-carlos','stu-bia','stu-davi']:[studentId];
    const items=payerId==='pay-family'?[{studentId:'stu-carlos',component:'gold',amountCents:30000},{studentId:'stu-bia',component:'base',amountCents:20000},{studentId:'stu-davi',component:'base',amountCents:20000}]:[{studentId,component:'base',amountCents:amount}];
    addObligation(`obl-${payerId}-${month}`,payerId,studentIds,`2026-${month}`,`2026-${month}-07`,amount,amount,paidAt,items);
  });
  addObligation('obl-ana-oct','pay-ana',['stu-ana'],'2026-10','2026-10-07',20000,0,null,[{studentId:'stu-ana',component:'base',amountCents:20000}]);
  addObligation('obl-family-oct','pay-family',['stu-carlos','stu-bia','stu-davi'],'2026-10','2026-10-07',70000,0,null,[{studentId:'stu-carlos',component:'gold',amountCents:30000},{studentId:'stu-bia',component:'base',amountCents:20000},{studentId:'stu-davi',component:'base',amountCents:20000}]);
  addObligation('obl-acme-oct','pay-acme',['stu-edu'],'2026-10','2026-10-07',20000,0,null,[{studentId:'stu-edu',component:'corporate-base',amountCents:20000}]);
  addObligation('obl-edu-oct','pay-edu',['stu-edu'],'2026-10','2026-10-07',10000,0,null,[{studentId:'stu-edu',component:'gold-additional',amountCents:10000}]);
  addObligation('obl-fer-oct','pay-fer',['stu-fer'],'2026-10','2026-10-07',20000,20000,'2026-10-06',[{studentId:'stu-fer',component:'base',amountCents:20000}]);
  addObligation('obl-gui-oct','pay-gui',['stu-gui'],'2026-10','2026-10-07',20000,20000,'2026-10-07',[{studentId:'stu-gui',component:'base',amountCents:20000}]);
  addObligation('obl-igor-oct','pay-igor',['stu-igor'],'2026-10','2026-10-07',20000,20000,'2026-10-07',[{studentId:'stu-igor',component:'base',amountCents:20000}]);
  addObligation('obl-julia-oct','pay-julia',['stu-julia'],'2026-10','2026-10-07',20000,0,null,[{studentId:'stu-julia',component:'base',amountCents:20000}]);
  addObligation('obl-karen-oct','pay-karen',['stu-karen'],'2026-10','2026-10-07',20000,10000,'2026-10-07',[{studentId:'stu-karen',component:'base',amountCents:20000}]);
  addObligation('obl-leo-oct','pay-leo',['stu-leo'],'2026-10','2026-10-07',20000,0,null,[{studentId:'stu-leo',component:'base',amountCents:20000}],'disputed');
  const creativeNames={reminder:'Mensalidade em dia',collection:'Vamos resolver juntos',return:'Seu próximo treino',offer:'Experimente o Ouro'};
  const creatives = ['reminder','collection','return','offer'].map((type,index)=>({ id:`creative-${type}`,name:creativeNames[type],url:`/assets/campaigns/${type}.png`,approved:true,version:1,index }));
  const campaigns = [
    {id:'cmp-reminder',name:'Lembrete de vencimento',type:'reminder',status:'active',version:1,priority:80,template:'Olá, {{nome}}. Sua mensalidade SnaqFit de {{valor}} vence em {{vencimento}}. Se já pagou, desconsidere.',include:['individual','family','corporate'],require:[],exclude:['critical-review'],approved:true,creativeId:'creative-reminder'},
    {id:'cmp-collection',name:'Regularização de pagamento',type:'collection',status:'active',version:1,priority:100,template:'Olá, {{nome}}. Identificamos saldo de {{valor}} com vencimento em {{vencimento}}. Posso ajudar com a regularização?',templateB:'Olá, {{nome}}. O saldo de {{valor}} segue em aberto. Se houver divergência, responda por aqui para conferirmos.',include:['overdue'],require:[],exclude:['critical-review'],approved:true,creativeId:'creative-collection'},
    {id:'cmp-return',name:'Retomada de frequência',type:'return',status:'active',version:1,priority:60,template:'Oi, {{nome}}! Sentimos sua falta na SnaqFit. Quer ajuda para retomar sua rotina?',include:['absent'],require:[],exclude:['overdue','critical-review'],approved:true,creativeId:'creative-return'},
    {id:'cmp-offer',name:'Experimentação Ouro',type:'offer',status:'active',version:1,priority:40,template:'Oi, {{nome}}! Você pode experimentar o plano Ouro por um ciclo sem o adicional de R$ 100, mantendo seu Prata pago. Convite válido por 14 dias.',include:['long-silver'],require:['frequent','good-history','current'],exclude:['promo-blocked','critical-review','gold'],approved:true,creativeId:'creative-offer'},
  ];
  for(const campaign of campaigns){campaign.messageGroups=defaultMessageGroups(campaign.type);campaign.abEnabled=true;}
  const state={ seedVersion:1,clock:`2026-10-09${TZ_SUFFIX}`,contacts,payers,students,obligations,campaigns,communications:[],offers:[],tasks:[],creatives,settings:{holidays:[],offerCap:5,contactCap7Days:2,minContactHours:48,sourceFreshDays:3},sequences:{communication:1,offer:1,task:1,campaign:1,creative:5} };
  ensureCase20(state);
  return state;
}

function ensureCase20(state){
  const contact=(id,name,phone,promotionalAllowed=true)=>state.contacts.push({id,name,phone,financialAllowed:true,promotionalAllowed,automationBlocked:false});
  const payer=(id,name,kind,contactId)=>state.payers.push({id,name,kind,contactId});
  const student=(item)=>state.students.push(item);
  const obligation=(id,payerId,studentIds,period,amountCents,paidCents,paidAt,items,status)=>{const dueDate=`${period}-07`;state.obligations.push({id,payerId,payerName:byId(state.payers,payerId).name,studentIds,period,dueDate,nominalDue:dueDate,amountCents,paidCents,balanceCents:amountCents-paidCents,status:status??(paidCents===amountCents?'paid':'overdue'),paidAt,items});};
  const frequent=['2026-10-08','2026-10-06','2026-10-04','2026-10-02','2026-09-30','2026-09-28','2026-09-25'];
  const addHistory=(prefix,payerId,studentIds,amountCents,items,paidDates=['2026-07-07','2026-08-07','2026-09-07'])=>['07','08','09'].forEach((month,index)=>obligation(`${prefix}-${month}`,payerId,studentIds,`2026-${month}`,amountCents,amountCents,paidDates[index],items));
  const cases={
    'stu-ana':'Individual frequente com mensalidade atual vencida', 'stu-carlos':'Titular da família Ouro + dois Prata, total R$ 700',
    'stu-bia':'Dependente familiar Prata frequente', 'stu-davi':'Dependente menor; contato no titular',
    'stu-edu':'Corporativo Ouro: empresa paga R$ 200 e aluno responde por R$ 100', 'stu-fer':'Ausente com bom histórico e contrato ativo',
    'stu-gui':'Prata antigo, frequente, bom histórico e elegível ao Ouro', 'stu-igor':'Elegível financeiramente, mas opt-out promocional',
    'stu-julia':'Histórico insuficiente', 'stu-karen':'Pagamento parcial e atraso recorrente',
    'stu-leo':'Contestação financeira', 'stu-marina':'Fonte de presença desatualizada',
  };
  for(const item of state.students)item.demoCase=cases[item.id];

  contact('ct-rosa','Rosa Oliveira','5511941000101');payer('pay-family2','Rosa Oliveira','person','ct-rosa');
  const family2=[['stu-rosa','Rosa Oliveira','gold',false],['stu-luan','Luan Oliveira','silver',false],['stu-nina','Nina Oliveira','silver',true]];
  for(const [id,name,plan,isMinor] of family2)student({id,name,unit:'Moema',plan,status:'active',payerId:'pay-family2',payerName:'Rosa Oliveira',kind:'family',contactId:'ct-rosa',planSince:'2025-04-01',attendance:frequent,lastAttendance:frequent[0],isMinor,demoCase:isMinor?'Dependente menor da segunda família':'Segunda família com cobrança consolidada',presenceSourceUpdatedAt:'2026-10-09',corporateBasePayerId:null,corporateUpgradeAllowed:false});
  const familyItems=[{studentId:'stu-rosa',component:'gold',amountCents:30000},{studentId:'stu-luan',component:'base',amountCents:20000},{studentId:'stu-nina',component:'base',amountCents:20000}];
  addHistory('obl-family2','pay-family2',family2.map(([id])=>id),70000,familyItems);obligation('obl-family2-oct','pay-family2',family2.map(([id])=>id),'2026-10',70000,70000,'2026-10-07',familyItems);

  contact('ct-nexo','Financeiro Nexo','5511941000201',false);payer('pay-nexo','Nexo Tecnologia','company','ct-nexo');
  contact('ct-livia','Lívia Prado','5511941000202');payer('pay-livia','Lívia Prado','person','ct-livia');
  student({id:'stu-livia',name:'Lívia Prado',unit:'Paulista',plan:'silver',status:'active',payerId:'pay-livia',payerName:'Lívia Prado',kind:'corporate',contactId:'ct-livia',planSince:'2025-01-01',attendance:frequent,lastAttendance:frequent[0],isMinor:false,demoCase:'Corporativo Prata elegível ao Ouro; empresa mantém base e aluna aceita adicional',presenceSourceUpdatedAt:'2026-10-09',corporateBasePayerId:'pay-nexo',corporateUpgradeAllowed:true});
  const liviaBase=[{studentId:'stu-livia',component:'corporate-base',amountCents:20000}];addHistory('obl-nexo','pay-nexo',['stu-livia'],20000,liviaBase);obligation('obl-nexo-oct','pay-nexo',['stu-livia'],'2026-10',20000,20000,'2026-10-07',liviaBase);

  contact('ct-orbita','Financeiro Órbita','5511941000301',false);payer('pay-orbita','Órbita Serviços','company','ct-orbita');
  contact('ct-mauro','Mauro Teles','5511941000302');payer('pay-mauro','Mauro Teles','person','ct-mauro');
  student({id:'stu-mauro',name:'Mauro Teles',unit:'Centro',plan:'gold',status:'active',payerId:'pay-mauro',payerName:'Mauro Teles',kind:'corporate',contactId:'ct-mauro',planSince:'2025-02-01',attendance:frequent,lastAttendance:frequent[0],isMinor:false,demoCase:'Corporativo Ouro com base da empresa e adicional particular separados',presenceSourceUpdatedAt:'2026-10-09',corporateBasePayerId:'pay-orbita',corporateUpgradeAllowed:true});
  const mauroBase=[{studentId:'stu-mauro',component:'corporate-base',amountCents:20000}],mauroAdd=[{studentId:'stu-mauro',component:'gold-additional',amountCents:10000}];addHistory('obl-orbita','pay-orbita',['stu-mauro'],20000,mauroBase);addHistory('obl-mauro','pay-mauro',['stu-mauro'],10000,mauroAdd);obligation('obl-orbita-oct','pay-orbita',['stu-mauro'],'2026-10',20000,20000,'2026-10-07',mauroBase);obligation('obl-mauro-oct','pay-mauro',['stu-mauro'],'2026-10',10000,0,null,mauroAdd);

  const individuals=[['paulo','Paulo Rocha','5511941000401','Atraso recorrente e ausência'],['renata','Renata Alves','5511941000402','Individual Ouro de R$ 300, bom histórico e rotina frequente'],['sofia','Sofia Martins','5511941000403','Nunca frequentou; onboarding fora da retomada']];
  for(const [slug,name,phone,demoCase] of individuals){const contactId=`ct-${slug}`,payerId=`pay-${slug}`,studentId=`stu-${slug}`;contact(contactId,name,phone);payer(payerId,name,'person',contactId);const never=slug==='sofia',absent=slug==='paulo',plan=slug==='renata'?'gold':'silver',amountCents=plan==='gold'?30000:20000;student({id:studentId,name,unit:slug==='renata'?'Moema':'Centro',plan,status:'active',payerId,payerName:name,kind:'individual',contactId,planSince:never?'2026-09-01':'2025-01-01',attendance:never?[]:absent?['2026-09-15']:frequent,lastAttendance:never?null:absent?'2026-09-15':frequent[0],isMinor:false,demoCase,presenceSourceUpdatedAt:'2026-10-09',corporateBasePayerId:null,corporateUpgradeAllowed:false});const items=[{studentId,component:plan==='gold'?'gold':'base',amountCents}];if(!never)addHistory(`obl-${slug}`,payerId,[studentId],amountCents,items,absent?['2026-07-11','2026-08-12','2026-09-07']:undefined);obligation(`obl-${slug}-oct`,payerId,[studentId],'2026-10',amountCents,slug==='renata'?amountCents:0,slug==='renata'?'2026-10-07':null,items);}
  // Keep today's queue focused: these pupils demonstrate normal, paid contracts.
  // The overdue examples remain Ana, Carlos, Acme/Eduardo, Karen and Paulo.
  for(const id of ['obl-julia-oct','obl-sofia-oct','obl-mauro-oct']){
    const paid=byId(state.obligations,id);
    Object.assign(paid,{paidCents:paid.amountCents,balanceCents:0,paidAt:'2026-10-07',status:'paid'});
  }
  state.seedVersion=4;
  state.caseProfile={id:'snaqfit-canonical-20',people:20,individual:11,family:6,corporate:3,description:'Case enxuto cobrindo responsabilidades individual, familiar e corporativa.'};
}

function historiesFor(state, student, onDate) {
  const responsiblePayerId=student.kind==='corporate'&&student.plan==='silver'?student.corporateBasePayerId:student.payerId;
  return state.obligations.filter((o) => o.payerId === responsiblePayerId && o.dueDate < onDate).sort((a,b)=>b.dueDate.localeCompare(a.dueDate)).slice(0,3);
}

function calculateTags(state, student, onDate = dateOnly(state.clock)) {
  const tags = new Map();
  const history = historiesFor(state, student, onDate);
  const coveragePayerId=student.kind==='corporate'&&student.plan==='silver'?student.corporateBasePayerId:null;
  const payerCurrent = state.obligations.filter((o)=>o.payerId===student.payerId && o.dueDate < onDate && o.balanceCents>0);
  const coverageCurrent=coveragePayerId?state.obligations.filter((o)=>o.payerId===coveragePayerId&&o.dueDate<onDate&&o.balanceCents>0):[];
  const late = history.filter((o)=>o.paidCents<o.amountCents||!o.paidAt||o.paidAt>o.dueDate).length;
  const historyScope=student.kind==='corporate'&&student.plan==='silver'?' da cobertura corporativa':'';
  if (history.length === 3 && late === 0 && history.every((o)=>o.paidCents===o.amountCents)) tags.set('good-history',`3 últimas competências${historyScope} pagas integralmente no prazo`);
  else if (history.length === 3 && late >= 2 && !coveragePayerId) tags.set('recurring-late',`${late} das 3 últimas competências pagas após o vencimento`);
  else tags.set('insufficient-history',history.length<3?`somente ${history.length} competências observáveis`:'histórico misto');
  tags.set(payerCurrent.length?'overdue':'current',payerCurrent.length?`saldo vencido de ${money(payerCurrent.reduce((s,o)=>s+o.balanceCents,0))}`:'sem saldo vencido do pagador');
  const uniqueRecent = new Set(student.attendance.filter((d)=>daysBetween(d,onDate)>=0&&daysBetween(d,onDate)<30));
  if (uniqueRecent.size >= 6 && student.lastAttendance && daysBetween(student.lastAttendance,onDate)<7) tags.set('frequent',`${uniqueRecent.size} dias de presença nos últimos 30 dias`);
  const sourceFresh = daysBetween(student.presenceSourceUpdatedAt,onDate)<=state.settings.sourceFreshDays;
  if (student.status==='active' && student.lastAttendance && daysBetween(student.lastAttendance,onDate)>=14 && sourceFresh) tags.set('absent',`${daysBetween(student.lastAttendance,onDate)} dias desde a última presença`);
  if (student.plan==='silver' && daysBetween(student.planSince,onDate)>=90) tags.set('long-silver',`Prata há ${daysBetween(student.planSince,onDate)} dias`);
  if (student.plan==='gold') tags.set('gold','plano Ouro vigente');
  tags.set(student.kind,student.kind==='family'?'mensalidade consolidada no titular':student.kind==='corporate'?'contrato corporativo':'pagamento individual');
  const contact = byId(state.contacts,student.contactId);
  if (!contact?.promotionalAllowed || contact?.automationBlocked) tags.set('promo-blocked',!contact?.promotionalAllowed?'contato promocional bloqueado':'automação bloqueada');
  if(coverageCurrent.length)tags.set('critical-review',`cobertura corporativa com ${money(coverageCurrent.reduce((sum,item)=>sum+item.balanceCents,0))} pendente; não atribuído ao aluno`);
  if (!sourceFresh && student.lastAttendance && daysBetween(student.lastAttendance,onDate)>=14) tags.set('critical-review','fonte de presença desatualizada');
  return tags;
}

const audienceDefinitions = [
  ['good-history','Bom histórico de pagamento'],['recurring-late','Atraso recorrente'],['insufficient-history','Histórico insuficiente/misto'],
  ['current','Em dia'],['overdue','Com pagamento em atraso'],['frequent','Frequente'],['absent','Ausente'],['long-silver','Prata de longa permanência'],
  ['gold','Ouro'],['individual','Individual'],['family','Família'],['corporate','Corporativo'],['promo-blocked','Contato promocional bloqueado'],['critical-review','Revisão necessária'],
];

function decorate(state) {
  const students = state.students.map((student)=>{ const tagMap=calculateTags(state,student); return {...student,tags:[...tagMap.keys()],reasons:Object.fromEntries(tagMap)}; });
  const audiences = audienceDefinitions.map(([id,name])=>{ const members=students.filter((s)=>s.tags.includes(id)).map((s)=>({id:s.id,name:s.name,reason:s.reasons[id]})); return {id,name,description:members[0]?.reason??'Nenhum membro no cenário atual',members,count:members.length}; });
  return {...deepCopy(state),students,audiences,metrics:metrics(state)};
}

function matchesCampaign(student,campaign,tags) {
  const included=!campaign.include?.length || campaign.include.some((id)=>tags.has(id));
  const required=(campaign.require??[]).every((id)=>tags.has(id));
  const excluded=(campaign.exclude??[]).some((id)=>tags.has(id));
  return included && required && !excluded;
}

function interpolate(template,data) { return template.replaceAll('{{nome}}',data.name).replaceAll('{{valor}}',money(data.amountCents??0)).replaceAll('{{vencimento}}',new Date(`${data.dueDate}T12:00:00Z`).toLocaleDateString('pt-BR')).replaceAll('{{contexto}}',data.context).replaceAll('{{responsavel}}',data.responsible); }

function candidateBase(state,campaign,date,{student=null,payer=null,obligations=[]}={}) {
  const responsible=student?.isMinor?byId(state.payers,student.payerId):(payer??student);
  const contact=byId(state.contacts,responsible.contactId);
  const memberIds=student?[student.id]:[...new Set(obligations.flatMap(o=>o.studentIds))];
  const rawMembers=memberIds.map((id)=>byId(state.students,id)).filter(Boolean);
  const group=payer?.kind==='company'||rawMembers.some((member)=>member.kind==='corporate')?'corporate':rawMembers.some((member)=>member.kind==='family')?'family':'individual';
  const phoneDigit=Number(String(contact?.phone??'0').at(-1));
  const variant=campaign.abEnabled&&campaign.messageGroups?.[group]?.B?.trim()&&phoneDigit%2===1?'B':'A';
  const template=campaign.messageGroups?.[group]?.[variant]??(variant==='B'&&campaign.templateB?campaign.templateB:campaign.template);
  const amountCents=obligations.reduce((sum,o)=>sum+o.balanceCents,0);
  const dueDate=obligations[0]?.dueDate??date;
  const components=new Set(obligations.flatMap((obligation)=>obligation.items.map((item)=>item.component)));
  const context=components.size===1&&components.has('corporate-base')?'a cobertura corporativa':components.size===1&&components.has('gold-additional')?'o adicional particular do Ouro':campaign.type==='offer'?'a experimentação do Ouro':'a mensalidade SnaqFit';
  const renderedText=interpolate(template,{name:responsible.name,amountCents,dueDate,context,responsible:responsible.name});
  const creative=campaign.creativeId?byId(state.creatives,campaign.creativeId):null;
  const members=rawMembers.map((member)=>{const tags=calculateTags(state,member,date);return {id:member.id,name:member.name,tags:[...tags.keys()],reasons:Object.fromEntries(tags),payerId:member.payerId,contactId:member.contactId,lastAttendance:member.lastAttendance};});
  return {campaignId:campaign.id,campaignName:campaign.name,type:campaign.type,group,recipientName:responsible.name,contactId:contact?.id,phone:contact?.phone,studentIds:memberIds,obligationIds:obligations.map(o=>o.id),text:renderedText,date,scheduledAt:isoAt(date),status:'eligible',reason:'Critérios atendidos',amountCents,variant,payload:{provider:'simulation',endpoint:'/send/text',number:contact?.phone,text:renderedText,media:creative?.url??null,request:{method:'POST',path:'/send/text',headers:{'content-type':'application/json'},body:{number:contact?.phone,text:renderedText,track_source:'snaqfit'}}},criteriaSnapshot:{include:[...(campaign.include??[])],require:[...(campaign.require??[])],exclude:[...(campaign.exclude??[])],campaignVersion:campaign.version,group,variant,members,responsible:{payerId:payer?.id??student?.payerId,contactId:contact?.id,recipientName:responsible.name}},creativeId:campaign.creativeId??null,creativeUrl:creative?.url??null,creativeName:creative?.name??null,creativeVersion:creative?.version??null,priority:campaign.priority};
}

function previewCampaign(state,campaign,date) {
  if (campaign.status!=='active'||!campaign.approved) return [];
  if (campaign.type==='reminder'||campaign.type==='collection') {
    const groups=new Map();
    for(const obligation of state.obligations){
      const payer=byId(state.payers,obligation.payerId);
      const relevant=campaign.type==='reminder'?obligation.balanceCents>0&&date===addBusinessDays(obligation.dueDate,-0,state.settings.holidays):false;
      const reminderDate=subtractBusinessDays(obligation.dueDate,2,state.settings.holidays);
      const collectionDate=addBusinessDays(obligation.dueDate,2,state.settings.holidays);
      const qualifies=campaign.type==='reminder'?obligation.balanceCents>0&&obligation.status!=='disputed'&&date===reminderDate:obligation.balanceCents>0&&obligation.status!=='disputed'&&date>=collectionDate;
      if(!qualifies) continue;
      const key=payer.id; if(!groups.has(key)) groups.set(key,{payer,obligations:[]}); groups.get(key).obligations.push(obligation);
    }
    return [...groups.values()].map(({payer,obligations})=>{
      const candidate=candidateBase(state,campaign,date,{payer,obligations});
      const tagUnion=new Set(candidate.criteriaSnapshot.members.flatMap((member)=>member.tags.filter((tag)=>!(tag==='critical-review'&&member.reasons[tag]?.startsWith('fonte de presença')))));
      const included=!campaign.include?.length||campaign.include.some((id)=>tagUnion.has(id));
      const required=(campaign.require??[]).every((id)=>tagUnion.has(id));
      const blocked=(campaign.exclude??[]).filter((id)=>tagUnion.has(id));
      if(!included||!required||blocked.length){candidate.status='excluded';candidate.reason=blocked.length?`Impedimento: ${blocked.join(', ')}`:'Critérios financeiros da campanha não atendidos';}
      if(campaign.type==='collection'&&candidate.status==='eligible'){
        const attempts=state.communications.filter((item)=>item.type==='collection'&&item.obligationIds.some((id)=>candidate.obligationIds.includes(id))&&['accepted','delivered','responded','converted'].includes(item.status)).sort((a,b)=>b.date.localeCompare(a.date));
        if(attempts.length>=2){candidate.status='excluded';candidate.reason='Duas tentativas realizadas; encaminhado para atendimento humano';}
        else if(attempts.length===1&&date<addDays(attempts[0].date,7)){candidate.status='deferred';candidate.reason=`Segunda tentativa disponível em ${addDays(attempts[0].date,7)}`;}
      }
      return candidate;
    });
  }
  return state.students.map((student)=>({student,tags:calculateTags(state,student,date)})).map(({student,tags})=>{
    const candidate=candidateBase(state,campaign,date,{student});
    if(student.status!=='active'){candidate.status='excluded';candidate.reason=`Contrato ${student.status==='paused'?'pausado':'cancelado'}`;return candidate;}
    if(!matchesCampaign(student,campaign,tags)){
      const missing=(campaign.require??[]).filter((id)=>!tags.has(id));
      const blocked=(campaign.exclude??[]).filter((id)=>tags.has(id));
      const hasIncluded=!campaign.include?.length||campaign.include.some((id)=>tags.has(id));
      candidate.status='excluded';candidate.reason=blocked.length?`Impedimento: ${blocked.join(', ')}`:missing.length?`Faltam condições: ${missing.join(', ')}`:!hasIncluded?'Fora dos públicos incluídos':'Critérios não atendidos';
      return candidate;
    }
    if(campaign.type==='return'&&state.communications.some((item)=>item.type==='return'&&item.studentIds.includes(student.id)&&['accepted','delivered','responded','converted'].includes(item.status)&&item.date>=student.lastAttendance)){candidate.status='excluded';candidate.reason='Mensagem de retomada já enviada neste episódio de ausência';}
    if(campaign.type==='offer'&&state.offers.some((item)=>item.studentId===student.id)){candidate.status='excluded';candidate.reason='Convite ou benefício já registrado para o aluno';}
    return candidate;
  });
}

function applyPreviewConflicts(state,candidates,date) {
  const selected=[]; const seen=new Set();
  for(const candidate of candidates.sort((a,b)=>b.priority-a.priority)){
    if (candidate.status !== 'eligible') continue;
    const weekday=new Date(`${date}T12:00:00Z`).getUTCDay();
    if([0,6].includes(weekday)||state.settings.holidays.includes(date)){candidate.status='deferred';candidate.reason='Fora de dia útil';continue;}
    const signature=`${candidate.campaignId}:${candidate.date}:${candidate.contactId}:${candidate.studentIds.join(',')}:${candidate.obligationIds.join(',')}:${candidate.amountCents}`;
    if(state.communications.some((c)=>c.signature===signature)){ candidate.status='excluded';candidate.reason='Já programada para este contexto';continue; }
    const contact=byId(state.contacts,candidate.contactId);
    if(!contact||!candidate.phone){candidate.status='excluded';candidate.reason='Contato sem telefone válido';continue;}
    if(contact.automationBlocked){candidate.status='excluded';candidate.reason='Automação bloqueada para o contato';continue;}
    if(['reminder','collection'].includes(candidate.type)&&!contact.financialAllowed){candidate.status='excluded';candidate.reason='Contato não autorizado para mensagens financeiras';continue;}
    if(candidate.type==='offer'&&!contact.promotionalAllowed){candidate.status='excluded';candidate.reason='Contato não autorizado para promoção';continue;}
    if(seen.has(candidate.phone)){candidate.status='deferred';candidate.reason='Outra campanha de maior prioridade usa este telefone na data';continue;}
    const recent=state.communications.filter((c)=>c.phone===candidate.phone&&['accepted','delivered','responded','converted','unknown'].includes(c.status)&&daysBetween(c.date,date)>=0&&daysBetween(c.date,date)<7);
    if(recent.length>=state.settings.contactCap7Days){candidate.status='deferred';candidate.reason='Limite de 2 contatos em 7 dias';continue;}
    const last=recent.sort((a,b)=>b.date.localeCompare(a.date))[0];
    if(last&&daysBetween(last.date,date)<2){candidate.status='deferred';candidate.reason='Intervalo mínimo de 48 horas';continue;}
    seen.add(candidate.phone); selected.push(candidate);
  }
  return candidates;
}

function metrics(state) {
  return state.campaigns.map((campaign)=>{
    const comms=state.communications.filter((c)=>c.campaignId===campaign.id);
    const converted=comms.filter((c)=>c.status==='converted'||c.convertedAt).length;
    const delivered=comms.filter((c)=>['delivered','responded','converted'].includes(c.status)).length;
    const responded=comms.filter((c)=>['responded','converted'].includes(c.status)||c.respondedAt).length;
    const accepted=comms.filter((c)=>['accepted','delivered','responded','converted'].includes(c.status)).length;
    const unit=['reminder','collection'].includes(campaign.type)?'pagador':'aluno';
    const eligible=new Set(comms.map((communication)=>unit==='pagador'?communication.contactId:communication.studentIds[0])).size;
    const recoveredCents=state.obligations.flatMap((o)=>o.paymentAttributions??[]).filter((item)=>item.campaignId===campaign.id).reduce((sum,item)=>sum+item.amountCents,0);
    const pending=comms.filter((c)=>['delivered','responded'].includes(c.status)&&daysBetween(c.date,dateOnly(state.clock))<=7).length;
    const relatedOffers=state.offers.filter((offer)=>comms.some((communication)=>communication.id===offer.communicationId));
    const freeCycleUses=relatedOffers.filter((offer)=>offer.startDate&&state.students.some((student)=>student.id===offer.studentId&&student.attendance.some((date)=>date>=offer.startDate&&date<offer.endDate))).length;
    const variants=['individual','family','corporate'].flatMap((group)=>['A','B'].map((variant)=>{const subset=comms.filter((item)=>(item.group??'individual')===group&&item.variant===variant);const ids=new Set(subset.map((item)=>item.id));const offers=state.offers.filter((offer)=>ids.has(offer.communicationId));return {group,variant,accepted:subset.filter((item)=>['accepted','delivered','responded','converted'].includes(item.status)).length,delivered:subset.filter((item)=>['delivered','responded','converted'].includes(item.status)).length,responded:subset.filter((item)=>item.status==='responded'||item.respondedAt).length,converted:subset.filter((item)=>item.status==='converted'||item.convertedAt).length,denominator:subset.length,recoveredCents:state.obligations.flatMap((item)=>item.paymentAttributions??[]).filter((item)=>ids.has(item.communicationId)).reduce((sum,item)=>sum+item.amountCents,0),trialAcceptances:offers.filter((offer)=>['accepted','active','continued','completed'].includes(offer.status)).length,paidContinuations:offers.filter((offer)=>offer.continuation).length};}));
    return {campaignId:campaign.id,name:campaign.name,unit,eligible,scheduled:comms.length,accepted,delivered,responded,converted,pending,denominator:delivered,rate:delivered?converted/delivered:0,recoveredCents,trialAcceptances:relatedOffers.filter((offer)=>['accepted','active','continued','completed'].includes(offer.status)).length,freeCycleUses,paidContinuations:relatedOffers.filter((offer)=>offer.continuation).length,knownCost:null,variants,windowLabel:campaign.type==='reminder'?'até o vencimento':campaign.type==='offer'?'aceite em 14 dias; uso no ciclo e continuidade posterior':'7 dias após comunicação'};
  });
}

export async function createApp({connectionString=process.env.DATABASE_URL,initialState,pool,schema}={}) {
  const store=await createStore(connectionString,seedState,{initialState,pool,schema});
  await store.mutate((state)=>{for(const campaign of state.campaigns){campaign.messageGroups??=defaultMessageGroups(campaign.type);campaign.abEnabled??=true;}});
  const get=()=>store.get();
  function snapshot(){ return decorate(get()); }
  function preview({date=dateOnly(get().clock),campaignId}={}){
    if(!validDate(date))throw new Error('date deve estar no formato YYYY-MM-DD e ser uma data real');
    if(campaignId&&!byId(get().campaigns,campaignId))throw new Error('Campanha não encontrada');
    const globalCandidates=applyPreviewConflicts(get(),get().campaigns.flatMap((c)=>previewCampaign(get(),c,date)),date);
    const candidates=campaignId?globalCandidates.filter((candidate)=>candidate.campaignId===campaignId):globalCandidates;
    return {date,candidates:deepCopy(candidates),summary:{eligible:candidates.filter(c=>c.status==='eligible').length,excluded:candidates.filter(c=>c.status==='excluded').length,deferred:candidates.filter(c=>c.status==='deferred').length}};
  }
  async function schedule(options={}){
    const result=preview(options); const scheduled=[];
    await store.mutate((state)=>{ for(const candidate of result.candidates.filter(c=>c.status==='eligible')){ const id=`com-${String(state.sequences.communication++).padStart(4,'0')}`; const signature=`${candidate.campaignId}:${candidate.date}:${candidate.contactId}:${candidate.studentIds.join(',')}:${candidate.obligationIds.join(',')}:${candidate.amountCents}`; const communication={...deepCopy(candidate),id,signature,status:'scheduled',createdAt:state.clock}; state.communications.push(communication); scheduled.push(deepCopy(communication)); }});
    return {date:result.date,scheduled,count:scheduled.length,excluded:result.summary.excluded,deferred:result.summary.deferred};
  }
  function revalidate(state,communication,date){
    const campaign=byId(state.campaigns,communication.campaignId);if(!campaign||campaign.status!=='active'||!campaign.approved)return'Campanha pausada ou sem aprovação';
    const contact=byId(state.contacts,communication.contactId); if(!contact||contact.automationBlocked)return'Contato bloqueado antes da execução';
    if(['reminder','collection'].includes(communication.type)&&!contact.financialAllowed)return'Contato financeiro não autorizado';
    if(communication.type==='offer'&&!contact.promotionalAllowed)return'Contato promocional não autorizado';
    if(communication.type==='collection'||communication.type==='reminder'){const obligations=communication.obligationIds.map((id)=>byId(state.obligations,id)).filter(Boolean);const open=obligations.some((item)=>item.balanceCents>0);if(!open)return'Obrigação quitada antes da execução';if(obligations.some((item)=>item.status==='disputed'))return'Obrigação entrou em contestação';if(obligations.reduce((sum,item)=>sum+item.balanceCents,0)!==communication.amountCents)return'Saldo mudou; gere uma nova prévia antes de enviar';}
    if(communication.type==='reminder'&&communication.obligationIds.some(id=>byId(state.obligations,id)?.dueDate<date))return'Lembrete expirou após o vencimento';
    if(communication.type==='return'){const student=byId(state.students,communication.studentIds[0]);const tags=calculateTags(state,student,date);if(student.status!=='active'||!tags.has('absent')||tags.has('overdue')||tags.has('critical-review'))return'Presença, contrato, dívida ou revisão alterou a elegibilidade';}
    if(communication.type==='offer'){const student=byId(state.students,communication.studentIds[0]);const tags=calculateTags(state,student,date);const critical=student.status==='active'&&student.plan==='silver'&&tags.has('long-silver')&&tags.has('frequent')&&tags.has('good-history')&&tags.has('current')&&!tags.has('promo-blocked')&&!tags.has('critical-review');if(!critical)return'Elegibilidade crítica da oferta mudou';if(state.offers.some(o=>o.studentId===student.id))return'Benefício já concedido ou convidado'; const granted=state.offers.filter(o=>['accepted','active','continued','completed'].includes(o.status)).length; if(granted>=state.settings.offerCap)return'Capacidade de benefícios atingida'; }
    return null;
  }
  async function execute({date=dateOnly(get().clock),outcome='delivered',campaignId}={}){
    if(!validDate(date))throw new Error('date deve estar no formato YYYY-MM-DD e ser uma data real');
    if(!['accepted','delivered','failed','unknown'].includes(outcome))throw new Error('outcome inválido');
    if(campaignId&&!byId(get().campaigns,campaignId))throw new Error('Campanha não encontrada');
    const sent=[],cancelled=[],deferred=[];
    await store.mutate((state)=>{ const queue=state.communications.filter(c=>c.status==='scheduled'&&c.date<=date&&(!campaignId||c.campaignId===campaignId)).sort((a,b)=>b.priority-a.priority); const used=new Set(); for(const communication of queue){ const reason=revalidate(state,communication,date); if(reason){communication.status='cancelled';communication.reason=reason;cancelled.push(deepCopy(communication));continue;} if(used.has(communication.phone)){communication.status='deferred';communication.reason='Telefone usado por prioridade maior nesta execução';deferred.push(deepCopy(communication));continue;} used.add(communication.phone); communication.status=outcome;communication.sentAt=isoAt(date);communication.reason=outcome==='failed'?'Falha simulada; revisão manual necessária':outcome==='unknown'?'Resultado desconhecido; não reenviar automaticamente':'Aceito pelo mock de WhatsApp';sent.push(deepCopy(communication)); if(communication.type==='offer'&&['accepted','delivered'].includes(outcome)){const student=byId(state.students,communication.studentIds[0]); const id=`offer-${String(state.sequences.offer++).padStart(3,'0')}`;state.offers.push({id,studentId:student.id,studentName:student.name,status:'invited',invitedAt:date,expiresAt:addDays(date,14),startDate:null,endDate:null,acceptedBy:null,payerId:student.kind==='family'?student.payerId:student.id==='stu-edu'?'pay-edu':student.payerId,continuation:null,communicationId:communication.id});} if(communication.type==='collection'&&['accepted','delivered'].includes(outcome)){const attempts=state.communications.filter((item)=>item.id!==communication.id&&item.type==='collection'&&item.obligationIds.some((id)=>communication.obligationIds.includes(id))&&['accepted','delivered','responded','converted'].includes(item.status)).length;if(attempts>=1&&!state.tasks.some((item)=>item.type==='collection_followup'&&item.communicationId===communication.id)){state.tasks.push({id:`task-${String(state.sequences.task++).padStart(3,'0')}`,type:'collection_followup',status:'open',communicationId:communication.id,contactId:communication.contactId,createdAt:state.clock,description:'Duas tentativas automáticas realizadas; atendimento humano necessário'});}} }});
    return {date,sent,count:sent.length,cancelled,deferred,outcome};
  }
  function event(payload){
    if(!payload?.type) throw new Error('event.type é obrigatório');
    if(!['payment','attendance','response','accept_offer','continuation','resolve_task','student_status'].includes(payload.type))throw new Error(`Tipo de evento desconhecido: ${payload.type}`);
    return store.mutate((state)=>{
      if(payload.type==='payment'){const o=byId(state.obligations,payload.obligationId);if(!o)throw new Error('Obrigação não encontrada');if(!Number.isSafeInteger(payload.amountCents)||payload.amountCents<=0||payload.amountCents>o.balanceCents)throw new Error('amountCents deve ser inteiro positivo e não superar o saldo');const paid=payload.amountCents;o.paidCents+=paid;o.balanceCents-=paid;o.paidAt=dateOnly(state.clock);o.status=o.balanceCents===0?'paid':o.dueDate<dateOnly(state.clock)?'overdue':'open';const linked=state.communications.filter(c=>c.obligationIds.includes(o.id)&&['delivered','responded','accepted'].includes(c.status)&&daysBetween(c.date,dateOnly(state.clock))>=0&&daysBetween(c.date,dateOnly(state.clock))<=7).sort((a,b)=>b.date.localeCompare(a.date))[0];if(linked){o.attributedCampaignIds=[...new Set([...(o.attributedCampaignIds??[]),linked.campaignId])];o.attributedPaidCents=(o.attributedPaidCents??0)+paid;o.paymentAttributions=[...(o.paymentAttributions??[]),{campaignId:linked.campaignId,communicationId:linked.id,amountCents:paid,paidAt:state.clock}];if(o.balanceCents===0&&(linked.type!=='reminder'||dateOnly(state.clock)<=o.dueDate)){linked.status='converted';linked.convertedAt=state.clock;}}for(const c of state.communications.filter(c=>c.status==='scheduled'&&c.obligationIds.includes(o.id))){c.status='cancelled';c.reason=o.balanceCents===0?'Pagamento integral registrado':'Saldo alterado por pagamento parcial; gere nova prévia';}return {type:payload.type,obligation:deepCopy(o),appliedCents:paid};}
      if(payload.type==='attendance'){const s=byId(state.students,payload.studentId);if(!s)throw new Error('Aluno não encontrado');const d=dateOnly(state.clock);if(!s.attendance.includes(d))s.attendance.unshift(d);s.lastAttendance=d;s.presenceSourceUpdatedAt=d;for(const c of state.communications.filter(c=>c.type==='return'&&c.studentIds.includes(s.id)&&c.status==='scheduled')){c.status='cancelled';c.reason='Presença registrada';}const sent=state.communications.filter(c=>c.type==='return'&&c.studentIds.includes(s.id)&&['delivered','responded'].includes(c.status)&&daysBetween(c.date,d)>=0&&daysBetween(c.date,d)<=7).sort((a,b)=>b.date.localeCompare(a.date))[0];if(sent){sent.status='converted';sent.convertedAt=state.clock;}return {type:payload.type,student:deepCopy(s)};}
      if(payload.type==='response'){if(!['paid_claim','dispute','optout','reply'].includes(payload.kind))throw new Error('kind de resposta inválido');const c=byId(state.communications,payload.communicationId);if(!c)throw new Error('Comunicação não encontrada');if(!['accepted','delivered','converted'].includes(c.status))throw new Error('Comunicação sem entrega confirmada não pode receber resposta');c.respondedAt=state.clock;c.status='responded';if(payload.kind==='optout'){const contact=byId(state.contacts,c.contactId);contact.automationBlocked=true;contact.promotionalAllowed=false;}if(['paid_claim','dispute'].includes(payload.kind)){for(const id of c.obligationIds){const o=byId(state.obligations,id);if(o&&payload.kind==='dispute')o.status='disputed';}const id=`task-${String(state.sequences.task++).padStart(3,'0')}`;state.tasks.push({id,type:payload.kind,status:'open',communicationId:c.id,contactId:c.contactId,createdAt:state.clock,description:payload.kind==='paid_claim'?'Conferir pagamento informado':'Analisar contestação'});}return {type:payload.type,communication:deepCopy(c)};}
      if(payload.type==='accept_offer'){const o=byId(state.offers,payload.offerId);if(!o)throw new Error('Oferta não encontrada');if(o.status!=='invited'||dateOnly(state.clock)>o.expiresAt)throw new Error('Oferta não está disponível');if(payload.acceptedBy!==o.payerId)throw new Error('Aceite deve ser feito pelo responsável financeiro');const granted=state.offers.filter(x=>['accepted','active','continued','completed'].includes(x.status)).length;if(granted>=state.settings.offerCap)throw new Error('Capacidade de benefícios atingida');o.status='accepted';o.acceptedBy=payload.acceptedBy;o.acceptedAt=state.clock;const startPeriod=nextMonth(dateOnly(state.clock).slice(0,7));o.startDate=`${startPeriod}-01`;o.endDate=`${nextMonth(startPeriod)}-01`;const communication=byId(state.communications,o.communicationId);if(communication){communication.status='converted';communication.convertedAt=state.clock;}return {type:payload.type,offer:deepCopy(o)};}
      if(payload.type==='continuation'){const o=byId(state.offers,payload.offerId);if(!o||!['accepted','active'].includes(o.status))throw new Error('Oferta sem continuidade disponível');if(payload.acceptedBy!==o.payerId)throw new Error('Continuidade exige aceite do responsável financeiro');o.continuation={acceptedBy:payload.acceptedBy,acceptedAt:state.clock,amountCents:10000};return {type:payload.type,offer:deepCopy(o)};}
      if(payload.type==='resolve_task'){const t=byId(state.tasks,payload.taskId);if(!t)throw new Error('Tarefa não encontrada');t.status='resolved';t.resolvedAt=state.clock;return {type:payload.type,task:deepCopy(t)};}
      if(payload.type==='student_status'){if(!['active','paused','cancelled'].includes(payload.status))throw new Error('status de aluno inválido');const s=byId(state.students,payload.studentId);if(!s)throw new Error('Aluno não encontrado');s.status=payload.status;return {type:payload.type,student:deepCopy(s)};}
    });
  }
  function saveCampaign(payload){
    if(!payload?.type&&!payload?.id)throw new Error('type é obrigatório para nova campanha');
    if('messageGroups'in payload)validateMessageGroups(payload.messageGroups);if('abEnabled'in payload&&typeof payload.abEnabled!=='boolean')throw new Error('abEnabled deve ser booleano');
    return store.mutate((state)=>{const existing=payload.id?byId(state.campaigns,payload.id):null;if(payload.id&&!existing)throw new Error('Campanha não encontrada');if(payload.type&&!['reminder','collection','return','offer'].includes(payload.type))throw new Error('type de campanha inválido');if(payload.status&&!['active','paused','draft'].includes(payload.status))throw new Error('status de campanha inválido');const allowed=['name','type','status','priority','template','templateB','messageGroups','abEnabled','include','require','exclude','creativeId','approved'];if(existing){const next={...existing,id:existing.id,version:existing.version+1};for(const key of allowed)if(key in payload)next[key]=deepCopy(payload[key]);state.campaigns[state.campaigns.indexOf(existing)]=next;return deepCopy(next);}const id=`cmp-custom-${state.sequences.campaign++}`;const campaign={id,name:payload.name??'Nova campanha',type:payload.type,status:payload.status??'draft',version:1,priority:payload.priority??50,template:payload.template??'Olá, {{nome}}.',messageGroups:payload.messageGroups??defaultMessageGroups(payload.type),abEnabled:payload.abEnabled??true,include:payload.include??[],require:payload.require??[],exclude:payload.exclude??[],creativeId:payload.creativeId??null,approved:payload.approved??false};state.campaigns.push(campaign);return deepCopy(campaign);});
  }
  function saveCreative(payload){return store.mutate((state)=>{const existing=payload.id?byId(state.creatives,payload.id):null;if(existing){const next={...existing,...deepCopy(payload),id:existing.id,version:(existing.version??1)+1};state.creatives[state.creatives.indexOf(existing)]=next;return deepCopy(next);}const creative={id:`creative-${state.sequences.creative++}`,name:payload.name??'Novo criativo',url:payload.url??'/assets/creative-brand.svg',approved:payload.approved??false,version:1};state.creatives.push(creative);return deepCopy(creative);});}
  function seedHistory(options={}){return store.mutate((state)=>seedDemoHistory(state,options));}
  function resetCaseDemo(){return store.mutate((state)=>{const fresh=seedState();for(const key of Object.keys(state))delete state[key];Object.assign(state,fresh);return {reset:true,people:state.students.length,payers:state.payers.length,obligations:state.obligations.length,profile:deepCopy(state.caseProfile)};});}
  function advance({date}={}){
    if(!validDate(date))throw new Error('date deve estar no formato YYYY-MM-DD e ser uma data real');
    if(date<dateOnly(get().clock))throw new Error('O relógio só pode avançar');
    return store.mutate((state)=>{
      const periods=monthRange(dateOnly(state.clock).slice(0,7),date.slice(0,7));
      const issued=[];
      for(const period of periods){
        for(const student of state.students.filter((item)=>item.status==='active')){
          const offer=state.offers.find((item)=>item.studentId===student.id&&['accepted','active','continued'].includes(item.status));
          const offerStart=offer?.startDate?.slice(0,7);
          let freeGoldCycle=false;
          if(offer&&period===offerStart){student.plan='gold';offer.status='active';freeGoldCycle=true;}
          else if(offer&&period>offerStart&&offer.status==='active'){
            if(offer.continuation){student.plan='gold';offer.status='continued';}
            else {student.plan='silver';offer.status='completed';}
          }
          const parts=student.kind==='corporate'
            ? [{payerId:student.corporateBasePayerId,component:'corporate-base',amountCents:20000},...(student.plan==='gold'&&!freeGoldCycle?[{payerId:student.payerId,component:'gold-additional',amountCents:10000}]:[])]
            : [{payerId:student.payerId,component:student.plan==='gold'&&!freeGoldCycle?'gold':'base',amountCents:student.plan==='gold'&&!freeGoldCycle?30000:20000}];
          for(const part of parts){
            let obligation=state.obligations.find((item)=>item.period===period&&item.payerId===part.payerId);
            if(!obligation){
              const nominal=`${period}-07`;
              obligation={id:`obl-${part.payerId}-${period}`,payerId:part.payerId,payerName:byId(state.payers,part.payerId).name,studentIds:[],period,dueDate:nextBusinessDay(nominal,state.settings.holidays),nominalDue:nominal,amountCents:0,paidCents:0,balanceCents:0,status:'open',paidAt:null,items:[]};
              state.obligations.push(obligation);issued.push(obligation.id);
            }
            if(!obligation.studentIds.includes(student.id))obligation.studentIds.push(student.id);
            if(!obligation.items.some((item)=>item.studentId===student.id&&item.component===part.component)){
              obligation.items.push({studentId:student.id,component:part.component,amountCents:part.amountCents});
              obligation.amountCents+=part.amountCents;obligation.balanceCents+=part.amountCents;
            }
          }
        }
      }
      state.clock=`${date}${TZ_SUFFIX}`;
      return {clock:state.clock,issued:[...new Set(issued)].map((id)=>deepCopy(byId(state.obligations,id))),offers:deepCopy(state.offers)};
    });
  }
  return {snapshot,preview,schedule,execute,event,saveCampaign,advance,saveCreative,seedHistory,resetCaseDemo,close:async()=>{await store.close();return {closed:true};}};
}
