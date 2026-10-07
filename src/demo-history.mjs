const clone = (value) => structuredClone(value);
const byId = (items, id) => items.find((item) => item.id === id);
const addDays = (date, days) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.floor((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86_400_000);
const money = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ptDate = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR');
function shiftBusinessDays(date, amount) {
  let result = date;
  const direction = Math.sign(amount);
  for (let remaining = Math.abs(amount); remaining > 0;) {
    result = addDays(result, direction);
    const weekday = new Date(`${result}T12:00:00Z`).getUTCDay();
    if (![0, 6].includes(weekday)) remaining--;
  }
  return result;
}

function exactText(campaign, recipientName, amountCents, dueDate, variant, group, context) {
  const source = campaign.messageGroups?.[group]?.[variant] ?? (variant === 'B' && campaign.templateB ? campaign.templateB : campaign.template);
  return source.replaceAll('{{nome}}', recipientName).replaceAll('{{valor}}', money(amountCents)).replaceAll('{{vencimento}}', ptDate(dueDate)).replaceAll('{{contexto}}', context).replaceAll('{{responsavel}}', recipientName);
}

function canUsePhone(state, phone, date) {
  const sent = state.communications.filter((item) => item.phone === phone && ['accepted', 'delivered', 'responded', 'converted', 'unknown'].includes(item.status));
  return !sent.some((item) => Math.abs(daysBetween(item.date, date)) < 2)
    && sent.filter((item) => daysBetween(item.date, date) >= 0 && daysBetween(item.date, date) < 7).length < 2;
}

function communication(state, { id, campaign, contact, recipientName, studentIds, obligationIds = [], amountCents = 0, date, status, reason, eventKind = null, convertedAt = null, group = 'individual', context = 'a mensalidade SnaqFit' }) {
  if (!canUsePhone(state, contact.phone, date)) return null;
  const variant = campaign.abEnabled && Number(contact.phone.at(-1)) % 2 === 1 ? 'B' : 'A';
  const obligation = obligationIds.length ? byId(state.obligations, obligationIds[0]) : null;
  const text = exactText(campaign, recipientName, amountCents, obligation?.dueDate ?? date, variant, group, context);
  const creative = byId(state.creatives, campaign.creativeId);
  const item = {
    id, campaignId: campaign.id, campaignName: campaign.name, type: campaign.type,
    recipientName, contactId: contact.id, phone: contact.phone, studentIds: [...studentIds], obligationIds: [...obligationIds], group,
    text, date, scheduledAt: `${date}T11:00:00-03:00`, sentAt: `${date}T11:00:00-03:00`, status, reason,
    amountCents, variant, priority: campaign.priority,
    signature: `${campaign.id}:${date}:${contact.id}:${studentIds.join(',')}:${obligationIds.join(',')}:${amountCents}:history-v1`,
    payload: { provider: 'simulation', endpoint: '/send/text', number: contact.phone, text, media: creative?.url ?? null, request: { method: 'POST', path: '/send/text', headers: { 'content-type': 'application/json' }, body: { number: contact.phone, text, track_source: 'snaqfit' } } },
    criteriaSnapshot: { campaignVersion: campaign.version, synthetic: true, source: 'demo-history-v1', group, variant, members: studentIds.map((studentId) => ({ id: studentId, name: byId(state.students, studentId)?.name })) },
    creativeId: creative?.id ?? null, creativeUrl: creative?.url ?? null, creativeName: creative?.name ?? null, creativeVersion: creative?.version ?? null,
    createdAt: `${date}T10:30:00-03:00`, respondedAt: ['responded', 'converted'].includes(status) && eventKind === 'response' ? `${addDays(date, 1)}T11:00:00-03:00` : null,
    convertedAt: status === 'converted' ? (convertedAt ?? `${addDays(date, eventKind === 'attendance' ? 3 : 2)}T11:00:00-03:00`) : null,
  };
  state.communications.push(item);
  return item;
}

export function seedDemoHistory(state, { months = 2 } = {}) {
  if (months !== 2) throw new Error('A primeira versão do histórico demo suporta exatamente 2 meses');
  if (state.demoHistory?.version === 1) return { ...clone(state.demoHistory), alreadySeeded: true };

  const events = [];
  const outcomeCounts = {};
  const campaigns = Object.fromEntries(state.campaigns.map((item) => [item.type, item]));
  for (const type of ['reminder', 'collection', 'return', 'offer']) {
    const creative = byId(state.creatives, campaigns[type].creativeId);
    if (creative) { creative.url = `/assets/campaigns/${type}.png`; creative.approved = true; }
  }

  // Keep the case's R$ 200 company base and R$ 100 employee additional as
  // separate historical responsibilities, just like the current competence.
  for (const period of ['2026-08', '2026-09']) {
    const dueDate = `${period}-07`;
    const parts = [
      { id: `hist-obl-acme-${period}`, payerId: 'pay-acme', amountCents: 20000, component: 'corporate-base' },
      { id: `hist-obl-edu-${period}`, payerId: 'pay-edu', amountCents: 10000, component: 'gold-additional' },
    ];
    for (const part of parts) if (!byId(state.obligations, part.id) && !state.obligations.some((item) => item.payerId === part.payerId && item.period === period)) {
      state.obligations.push({ id: part.id, payerId: part.payerId, payerName: byId(state.payers, part.payerId).name, studentIds: ['stu-edu'], period, dueDate, nominalDue: dueDate, amountCents: part.amountCents, paidCents: part.amountCents, balanceCents: 0, status: 'paid', paidAt: dueDate, items: [{ studentId: 'stu-edu', component: part.component, amountCents: part.amountCents }], synthetic: true });
    }
  }

  const financial = state.obligations
    .filter((item) => ['2026-08', '2026-09'].includes(item.period) && item.paidCents === item.amountCents)
    .sort((a, b) => {const priority=['pay-family','pay-acme','pay-edu','pay-family2','pay-nexo','pay-orbita','pay-mauro'];const rank=(id)=>{const value=priority.indexOf(id);return value<0?99:value;};return rank(a.payerId)-rank(b.payerId)||`${a.period}:${a.payerId}`.localeCompare(`${b.period}:${b.payerId}`);})
    .slice(0,12);
  let commIndex = 1;
  for (const [index, obligation] of financial.entries()) {
    const payer = byId(state.payers, obligation.payerId);
    const contact = byId(state.contacts, payer.contactId);
    const collectionDate = shiftBusinessDays(obligation.dueDate, 2);
    const collectionEligible = obligation.paidAt >= collectionDate;
    const campaign = collectionEligible ? campaigns.collection : campaigns.reminder;
    const date = collectionEligible ? collectionDate : shiftBusinessDays(obligation.dueDate, -2);
    const pattern = ['converted', 'converted', 'delivered', 'responded', 'converted', 'failed', 'unknown'];
    const desiredStatus = pattern[index % pattern.length];
    const convertedInWindow = obligation.paidAt >= date && (collectionEligible ? daysBetween(date, obligation.paidAt) <= 7 : obligation.paidAt <= obligation.dueDate);
    const status = desiredStatus === 'converted' && !convertedInWindow ? 'delivered' : desiredStatus;
    const students=obligation.studentIds.map((id)=>byId(state.students,id)).filter(Boolean);const group=payer.kind==='company'||students.some((item)=>item.kind==='corporate')?'corporate':students.some((item)=>item.kind==='family')?'family':'individual';const components=new Set(obligation.items.map((item)=>item.component));const context=components.has('corporate-base')?'a cobertura corporativa':components.has('gold-additional')?'o adicional particular do Ouro':'a mensalidade SnaqFit';
    const comm = communication(state, { id: `hist-comm-${String(commIndex++).padStart(3, '0')}`, campaign, contact, recipientName: payer.name, studentIds: obligation.studentIds, obligationIds: [obligation.id], amountCents: obligation.amountCents, date, status, group, context, convertedAt: status === 'converted' ? `${obligation.paidAt}T11:00:00-03:00` : null, reason: status === 'failed' ? 'Falha sintética registrada, sem reenvio cego' : status === 'unknown' ? 'Resultado sintético desconhecido' : convertedInWindow ? 'Histórico sintético do mock' : 'Pagamento orgânico fora da janela de atribuição' });
    if (!comm) continue;
    outcomeCounts[status] = (outcomeCounts[status] ?? 0) + 1;
    if (status === 'converted' && !(obligation.paymentAttributions ?? []).some((item) => item.communicationId === comm.id)) {
      obligation.paymentAttributions = [...(obligation.paymentAttributions ?? []), { campaignId: campaign.id, communicationId: comm.id, amountCents: obligation.amountCents, paidAt: `${obligation.paidAt}T11:00:00-03:00`, synthetic: true }];
      obligation.attributedCampaignIds = [...new Set([...(obligation.attributedCampaignIds ?? []), campaign.id])];
      events.push({ id: `hist-event-payment-${obligation.id}`, type: 'payment_attribution', date: obligation.paidAt, obligationId: obligation.id, communicationId: comm.id, amountCents: obligation.amountCents });
    } else if (status === 'responded') events.push({ id: `hist-event-response-${comm.id}`, type: 'response', date: addDays(date, 1), communicationId: comm.id, kind: 'reply' });
  }

  const returnStudents = ['stu-fer','stu-paulo','stu-ana','stu-bia','stu-edu','stu-karen'].map((id)=>byId(state.students,id)).filter(Boolean);
  for (const [index, student] of returnStudents.entries()) {
    const date = index < 6 ? '2026-08-17' : '2026-09-21';
    const contact = byId(state.contacts, student.contactId);
    const status = index % 4 === 3 ? 'responded' : index % 5 === 4 ? 'delivered' : 'converted';
    const comm = communication(state, { id: `hist-comm-${String(commIndex++).padStart(3, '0')}`, campaign: campaigns.return, contact, recipientName: student.name, studentIds: [student.id], date, status, group: student.kind==='corporate'?'corporate':student.kind==='family'?'family':'individual', eventKind: status === 'converted' ? 'attendance' : 'response', reason: 'Episódio sintético de retomada' });
    if (!comm) continue;
    outcomeCounts[status] = (outcomeCounts[status] ?? 0) + 1;
    if (status === 'converted') {
      const attendedOn = addDays(date, 3);
      if (!student.attendance.includes(attendedOn)) student.attendance.push(attendedOn);
      events.push({ id: `hist-event-attendance-${student.id}-${attendedOn}`, type: 'attendance', date: attendedOn, studentId: student.id, communicationId: comm.id });
    } else if (status === 'responded') events.push({ id: `hist-event-response-${comm.id}`, type: 'response', date: addDays(date, 1), communicationId: comm.id, kind: 'reply' });
  }

  const offerStudents = ['stu-mauro','stu-fer','stu-marina'].map((id)=>byId(state.students,id)).filter((item)=>item&&!state.offers.some((offer)=>offer.studentId===item.id));
  for (const [index, student] of offerStudents.entries()) {
    const date = ['2026-08-19', '2026-08-24', '2026-08-27'][index];
    const payer = byId(state.payers, student.payerId);
    const contact = byId(state.contacts, student.contactId);
    const comm = communication(state, { id: `hist-comm-${String(commIndex++).padStart(3, '0')}`, campaign: campaigns.offer, contact, recipientName: student.name, studentIds: [student.id], date, status: 'converted', group: student.kind==='corporate'?'corporate':student.kind==='family'?'family':'individual', context:'a experimentação do Ouro', eventKind: 'response', reason: 'Aceite sintético da experimentação Ouro' });
    if (!comm) continue;
    outcomeCounts.converted = (outcomeCounts.converted ?? 0) + 1;
    const continued = index === 0;
    const offer = { id: `hist-offer-${String(index + 1).padStart(2, '0')}`, studentId: student.id, studentName: student.name, status: continued ? 'continued' : 'completed', invitedAt: date, expiresAt: addDays(date, 14), startDate: '2026-09-01', endDate: '2026-10-01', acceptedBy: payer.id, acceptedAt: `${addDays(date, 1)}T11:00:00-03:00`, payerId: payer.id, continuation: continued ? { acceptedBy: payer.id, acceptedAt: '2026-09-28T11:00:00-03:00', amountCents: 10000 } : null, communicationId: comm.id, synthetic: true, priorPlan: 'silver' };
    state.offers.push(offer);
    events.push({ id: `hist-event-offer-${index + 1}`, type: 'accept_offer', date: addDays(date, 1), offerId: offer.id, studentId: student.id });
    if (continued) events.push({ id: `hist-event-continuation-${index + 1}`, type: 'continuation', date: '2026-09-28', offerId: offer.id, amountCents: 10000 });
  }

  state.demoHistoryEvents = [...(state.demoHistoryEvents ?? []), ...events];
  state.demoHistory = {
    version: 1, synthetic: true, range: { from: '2026-08-01', to: '2026-09-30', months: 2 },
    seededAt: state.clock, communicationCount: state.communications.filter((item) => item.id.startsWith('hist-comm-')).length,
    eventCount: events.length, offerCount: state.offers.filter((item) => item.id.startsWith('hist-offer-')).length,
    outcomeCounts,
  };
  return clone(state.demoHistory);
}
