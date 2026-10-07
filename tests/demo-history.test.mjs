import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/domain.mjs';
const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
let sequence = 0;
const historyApp = () => createApp({ connectionString, schema: `test_history_${process.pid}_${sequence++}` });

test('two-month demo history is additive, coherent and idempotent', async () => {
  const app = await historyApp();
  const before = app.snapshot();
  const marker = await app.saveCreative({ name: 'Evento existente', url: '/uploads/existing.png', approved: true });
  const result = await app.seedHistory({ months: 2 });
  const after = app.snapshot();

  assert.deepEqual(result.range, { from: '2026-08-01', to: '2026-09-30', months: 2 });
  assert.equal(after.clock, before.clock);
  assert.equal(after.students.length, 20);
  assert.ok(result.communicationCount >= 20);
  assert.ok(result.eventCount > 0);
  assert.ok(Object.keys(result.outcomeCounts).includes('failed'));
  assert.ok(Object.keys(result.outcomeCounts).includes('unknown'));
  assert.ok(after.creatives.some((item) => item.id === marker.id));
  assert.ok(after.communications.filter((item) => item.id.startsWith('hist-comm-')).every((item) => item.text === item.payload.text && item.payload.request.body.text === item.text));
  assert.ok(after.communications.filter((item) => item.id.startsWith('hist-comm-')).every((item) => item.creativeUrl?.startsWith('/assets/campaigns/')));
  assert.ok(after.obligations.flatMap((item) => item.paymentAttributions ?? []).some((item) => item.synthetic));
  for (const communication of after.communications.filter((item) => item.id.startsWith('hist-comm-') && item.obligationIds.length)) {
    const obligation = after.obligations.find((item) => item.id === communication.obligationIds[0]);
    assert.ok(communication.date <= obligation.paidAt);
    if (communication.type === 'collection') assert.ok(obligation.paidAt >= communication.date);
    if (communication.status === 'converted') assert.equal(communication.convertedAt.slice(0, 10), obligation.paidAt);
  }
  assert.ok(after.offers.filter((item) => item.id.startsWith('hist-offer-')).every((item) => item.endDate <= after.clock.slice(0, 10)));
  assert.ok(after.offers.some((item) => item.id.startsWith('hist-offer-') && item.continuation));
  assert.ok(after.metrics.every((metric) => metric.variants.length === 6));
  assert.ok(after.communications.filter((item) => item.id.startsWith('hist-comm-')).every((item) => ['individual', 'family', 'corporate'].includes(item.group) && ['A', 'B'].includes(item.variant)));

  const counts = { communications: after.communications.length, events: after.demoHistoryEvents.length, offers: after.offers.length };
  const repeated = await app.seedHistory({ months: 2 });
  const final = app.snapshot();
  assert.equal(repeated.alreadySeeded, true);
  assert.deepEqual({ communications: final.communications.length, events: final.demoHistoryEvents.length, offers: final.offers.length }, counts);
  await app.close();
});

test('historical attribution never changes paid balance or duplicates real money', async () => {
  const app = await historyApp();
  const balances = new Map(app.snapshot().obligations.map((item) => [item.id, [item.paidCents, item.balanceCents]]));
  await app.seedHistory({ months: 2 });
  const state = app.snapshot();
  for (const obligation of state.obligations.filter((item) => balances.has(item.id))) assert.deepEqual([obligation.paidCents, obligation.balanceCents], balances.get(obligation.id));
  assert.equal(state.obligations.find((item) => item.id === 'hist-obl-acme-2026-08').amountCents, 20_000);
  assert.equal(state.obligations.find((item) => item.id === 'hist-obl-edu-2026-08').amountCents, 10_000);
  for (const obligation of state.obligations) {
    const ids = (obligation.paymentAttributions ?? []).map((item) => item.communicationId);
    assert.equal(new Set(ids).size, ids.length);
  }
  assert.ok(state.metrics.some((item) => item.recoveredCents > 0));
  await app.close();
});
