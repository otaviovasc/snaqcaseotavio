import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/domain.mjs';

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
let schemaSequence = 0;
const memoryApp = () => createApp({ connectionString, schema: `test_domain_${process.pid}_${schemaSequence++}` });

test('seed preserves financial responsibility and calculated audiences', async () => {
  const app = await memoryApp();
  assert.equal(app.snapshot().students.length, 20);
  const state = app.snapshot();
  assert.ok(state.campaigns.every((campaign) => campaign.abEnabled && ['individual', 'family', 'corporate'].every((group) => campaign.messageGroups[group].A && campaign.messageGroups[group].B)));
  assert.equal(state.clock, '2026-10-09T11:00:00-03:00');
  const family = state.obligations.find((item) => item.id === 'obl-family-oct');
  assert.equal(family.amountCents, 70_000);
  assert.equal(family.payerName, 'Carlos Nunes');
  assert.deepEqual(family.items.map((item) => item.amountCents), [30_000, 20_000, 20_000]);

  const company = state.obligations.find((item) => item.id === 'obl-acme-oct');
  const employee = state.obligations.find((item) => item.id === 'obl-edu-oct');
  assert.equal(company.payerName, 'Acme Ltda.');
  assert.equal(company.amountCents, 20_000);
  assert.equal(employee.payerName, 'Eduardo Reis');
  assert.equal(employee.amountCents, 10_000);

  const gui = state.students.find((item) => item.id === 'stu-gui');
  assert.ok(['good-history', 'current', 'frequent', 'long-silver', 'individual'].every((tag) => gui.tags.includes(tag)));
  assert.equal(state.audiences.find((item) => item.id === 'good-history').members.some((member) => member.id === gui.id), true);
  const individualGold = state.students.find((item) => item.kind === 'individual' && item.plan === 'gold');
  assert.equal(individualGold.id, 'stu-renata');
  assert.equal(state.obligations.find((item) => item.id === 'obl-renata-oct').amountCents, 30_000);
  assert.equal(state.obligations.find((item) => item.id === 'obl-renata-oct').items[0].component, 'gold');
  await app.close();
});

test('reminder consolidates a family and scheduling is idempotent with immutable content', async () => {
  const app = await memoryApp();
  const before = app.preview({ date: '2026-10-05', campaignId: 'cmp-reminder' });
  const family = before.candidates.find((item) => item.obligationIds.includes('obl-family-oct'));
  assert.equal(family.group, 'family');
  assert.equal(family.criteriaSnapshot.group, 'family');
  assert.equal(family.amountCents, 70_000);
  assert.deepEqual(family.studentIds.sort(), ['stu-bia', 'stu-carlos', 'stu-davi']);
  const first = await app.schedule({ date: '2026-10-05', campaignId: 'cmp-reminder' });
  assert.ok(first.count > 0);
  const exactText = first.scheduled[0].text;
  await app.saveCampaign({ id: 'cmp-reminder', template: 'CONTEÚDO NOVO {{nome}}' });
  assert.equal(app.snapshot().communications[0].text, exactText);
  assert.equal((await app.schedule({ date: '2026-10-05', campaignId: 'cmp-reminder' })).count, 0);
  await app.close();
});

test('A/B variant is stable by phone and message group edits are validated', async () => {
  const app = await memoryApp();
  const first = app.preview({ date: '2026-10-05', campaignId: 'cmp-reminder' }).candidates.find((item) => item.status === 'eligible');
  const second = app.preview({ date: '2026-10-05', campaignId: 'cmp-reminder' }).candidates.find((item) => item.contactId === first.contactId);
  assert.equal(second.variant, first.variant);
  assert.throws(() => app.saveCampaign({ id: 'cmp-reminder', messageGroups: { individual: { A: 'curta', B: 'curta' } } }), /messageGroups/);
  await app.close();
});

test('payment before execution cancels collection and partial payment preserves balance', async () => {
  const app = await memoryApp();
  const scheduled = await app.schedule({ date: '2026-10-09', campaignId: 'cmp-collection' });
  assert.ok(scheduled.scheduled.some((item) => item.obligationIds.includes('obl-ana-oct')));
  await app.event({ type: 'payment', obligationId: 'obl-ana-oct', amountCents: 20_000 });
  await app.execute({ date: '2026-10-09' });
  assert.equal(app.snapshot().communications.find((item) => item.obligationIds.includes('obl-ana-oct')).status, 'cancelled');
  const partial = await app.event({ type: 'payment', obligationId: 'obl-karen-oct', amountCents: 5_000 });
  assert.equal(partial.obligation.balanceCents, 5_000);
  assert.equal(partial.obligation.status, 'overdue');
  await app.close();
});

test('attendance removes absence and cancels a pending return contact', async () => {
  const app = await memoryApp();
  const scheduled = await app.schedule({ date: '2026-10-09', campaignId: 'cmp-return' });
  assert.ok(scheduled.scheduled.some((item) => item.studentIds.includes('stu-fer')));
  await app.event({ type: 'attendance', studentId: 'stu-fer' });
  assert.equal(app.snapshot().students.find((item) => item.id === 'stu-fer').tags.includes('absent'), false);
  const communication = app.snapshot().communications.find((item) => item.studentIds.includes('stu-fer'));
  assert.equal(communication.status, 'cancelled');
  await app.close();
});

test('priority selects one campaign per shared contact and records deferral', async () => {
  const app = await memoryApp();
  await app.saveCampaign({ type: 'return', name: 'Contato geral', status: 'active', approved: true, priority: 1, template: 'Olá, {{nome}}', include: ['individual'], exclude: [] });
  const result = app.preview({ date: '2026-10-09' });
  const ana = result.candidates.filter((item) => item.contactId === 'ct-ana');
  assert.equal(ana.find((item) => item.campaignId === 'cmp-collection').status, 'eligible');
  assert.equal(ana.some((item) => item.status === 'deferred'), true);
  await app.close();
});

test('offer needs payer acceptance, grants only additional, then reverts without silence billing', async () => {
  const app = await memoryApp();
  assert.ok(app.preview({ date: '2026-10-09', campaignId: 'cmp-offer' }).summary.eligible >= 1);
  await app.schedule({ date: '2026-10-09', campaignId: 'cmp-offer' });
  await app.execute({ date: '2026-10-09' });
  const offer = app.snapshot().offers[0];
  assert.equal(offer.studentId, 'stu-gui');
  await assert.rejects(app.event({ type: 'accept_offer', offerId: offer.id, acceptedBy: 'pay-ana' }), /responsável financeiro/);
  await app.event({ type: 'accept_offer', offerId: offer.id, acceptedBy: 'pay-gui' });
  await app.advance({ date: '2026-11-01' });
  let state = app.snapshot();
  assert.equal(state.students.find((item) => item.id === 'stu-gui').plan, 'gold');
  const november = state.obligations.find((item) => item.id === 'obl-pay-gui-2026-11');
  assert.equal(november.amountCents, 20_000, 'Prata segue devido; só adicional é dispensado');
  await app.advance({ date: '2026-12-01' });
  state = app.snapshot();
  assert.equal(state.students.find((item) => item.id === 'stu-gui').plan, 'silver');
  assert.equal(state.obligations.find((item) => item.id === 'obl-pay-gui-2026-12').amountCents, 20_000);
  await app.close();
});

test('explicit continuation preserves free cycle and charges only the following cycle', async () => {
  const app = await memoryApp();
  await app.schedule({ date: '2026-10-09', campaignId: 'cmp-offer' });
  await app.execute({ date: '2026-10-09' });
  const offer = app.snapshot().offers[0];
  await app.event({ type: 'accept_offer', offerId: offer.id, acceptedBy: 'pay-gui' });
  await app.event({ type: 'continuation', offerId: offer.id, acceptedBy: 'pay-gui' });
  await app.advance({ date: '2026-11-01' });
  assert.equal(app.snapshot().obligations.find((item) => item.id === 'obl-pay-gui-2026-11').amountCents, 20_000);
  await app.advance({ date: '2026-12-01' });
  assert.equal(app.snapshot().obligations.find((item) => item.id === 'obl-pay-gui-2026-12').amountCents, 30_000);
  await app.close();
});

test('unknown provider result is persisted and never blindly retried', async () => {
  const app = await memoryApp();
  await app.schedule({ date: '2026-10-09', campaignId: 'cmp-collection' });
  const first = await app.execute({ date: '2026-10-09', outcome: 'unknown' });
  assert.ok(first.count > 0);
  assert.equal((await app.execute({ date: '2026-10-09', outcome: 'delivered' })).count, 0);
  assert.ok(app.snapshot().communications.every((item) => item.status === 'unknown'));
  await app.close();
});

test('PostgreSQL state survives close and reopen', async () => {
  const schema = `test_persistence_${process.pid}_${schemaSequence++}`;
  const first = await createApp({ connectionString, schema });
  await first.saveCreative({ name: 'Arte persistente', url: '/assets/persist.svg', approved: true });
  await first.close();
  const second = await createApp({ connectionString, schema });
  assert.ok(second.snapshot().creatives.some((item) => item.name === 'Arte persistente'));
  await second.close();
});

test('advance emits every skipped competence and invalid mutations roll back', async () => {
  const app = await memoryApp();
  await assert.rejects(app.event({ type: 'payment', obligationId: 'obl-ana-oct', amountCents: -1 }), /inteiro positivo/);
  assert.equal(app.snapshot().obligations.find((item) => item.id === 'obl-ana-oct').balanceCents, 20_000);
  const result = await app.advance({ date: '2027-01-01' });
  assert.ok(['2026-11', '2026-12', '2027-01'].every((period) => result.issued.some((item) => item.period === period)));
  assert.equal(app.snapshot().clock, '2027-01-01T11:00:00-03:00');
  await app.close();
});

test('corporate base history enables upgrade without assigning company debt to employee', async () => {
  const app = await memoryApp();
  const eligibleCorporate = app.preview({ date: '2026-10-09', campaignId: 'cmp-offer' }).candidates.filter((item) => item.status === 'eligible' && item.group === 'corporate');
  assert.ok(eligibleCorporate.length > 0);
  assert.ok(eligibleCorporate.some((item) => item.studentIds.includes('stu-livia')));
  await app.close();
});

test('a late payment does not count as an on-time reminder result', async () => {
  const app=await memoryApp();
  await app.schedule({date:'2026-10-05',campaignId:'cmp-reminder'});
  await app.execute({date:'2026-10-05'});
  await app.event({type:'payment',obligationId:'obl-ana-oct',amountCents:20000});
  const reminder=app.snapshot().communications.find(c=>c.obligationIds.includes('obl-ana-oct'));
  assert.notEqual(reminder.status,'converted');
  await app.close();
});

test('attendance after the seven-day window is not a campaign conversion', async () => {
  const app=await memoryApp();
  await app.schedule({date:'2026-10-09',campaignId:'cmp-return'});
  await app.execute({date:'2026-10-09'});
  await app.advance({date:'2026-10-19'});
  await app.event({type:'attendance',studentId:'stu-fer'});
  assert.notEqual(app.snapshot().communications.find(c=>c.type==='return'&&c.studentIds.includes('stu-fer')).status,'converted');
  await app.close();
});

test('focused demo has ten actions and keeps normal paid examples out of collections', async () => {
  const app = await memoryApp();
  const state=app.snapshot();
  for(const id of ['obl-julia-oct','obl-sofia-oct','obl-mauro-oct'])assert.equal(state.obligations.find(o=>o.id===id).balanceCents,0);
  const preview=app.preview({date:'2026-10-09'});
  assert.equal(preview.summary.eligible,10);
  await app.close();
});

test('explicit case reset replaces a larger state with the canonical 20-person case', async () => {
  const app = await memoryApp();
  await app.saveCreative({ name: 'Mutação anterior', url: '/uploads/old.png', approved: true });
  const result = await app.resetCaseDemo();
  assert.equal(result.people, 20);
  assert.deepEqual(result.profile, { id:'snaqfit-canonical-20',people:20,individual:11,family:6,corporate:3,description:'Case enxuto cobrindo responsabilidades individual, familiar e corporativa.' });
  assert.equal(app.snapshot().students.length, 20);
  assert.equal(app.snapshot().creatives.some((item) => item.name === 'Mutação anterior'), false);
  await app.close();
});

test('collection waits seven days, stops after two attempts, and creates human task', async () => {
  const app = await memoryApp();
  await app.schedule({ date: '2026-10-09', campaignId: 'cmp-collection' });
  await app.execute({ date: '2026-10-09' });
  let ana = app.preview({ date: '2026-10-13', campaignId: 'cmp-collection' }).candidates.find((item) => item.obligationIds.includes('obl-ana-oct'));
  assert.equal(ana.status, 'deferred');
  await app.schedule({ date: '2026-10-16', campaignId: 'cmp-collection' });
  await app.execute({ date: '2026-10-16' });
  ana = app.preview({ date: '2026-10-23', campaignId: 'cmp-collection' }).candidates.find((item) => item.obligationIds.includes('obl-ana-oct'));
  assert.equal(ana.status, 'excluded');
  assert.match(ana.reason, /Duas tentativas/);
  assert.ok(app.snapshot().tasks.some((item) => item.type === 'collection_followup' && item.status === 'open'));
  await app.close();
});

test('snapshot preserves reasons and metrics state their business unit', async () => {
  const app = await memoryApp();
  const result = await app.schedule({ date: '2026-10-05', campaignId: 'cmp-reminder' });
  assert.ok(result.scheduled[0].criteriaSnapshot.members[0].reasons);
  const metric = app.snapshot().metrics.find((item) => item.campaignId === 'cmp-reminder');
  assert.equal(metric.unit, 'pagador');
  assert.equal(metric.eligible, metric.scheduled);
  await app.close();
});
