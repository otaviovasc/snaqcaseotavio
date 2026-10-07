import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, materializeState } from '../src/store.mjs';

function fixture() {
  return {
    contacts: [{ id: 'contact-1', name: 'Ana', phone: '5511999999999', financialAllowed: true, promotionalAllowed: true, automationBlocked: false }],
    payers: [{ id: 'payer-1', name: 'Ana', kind: 'person', contactId: 'contact-1' }],
    students: [{ id: 'student-1', name: 'Ana', unit: 'Centro', plan: 'silver', status: 'active', kind: 'individual', payerId: 'payer-1', contactId: 'contact-1', attendance: ['2026-09-10', '2026-09-10'], isMinor: false }],
    obligations: [{
      id: 'obligation-1', payerId: 'payer-1', period: '2026-09', dueDate: '2026-09-07',
      amountCents: 20_000, paidCents: 20_000, balanceCents: 0, status: 'paid', paidAt: '2026-09-08',
      items: [{ studentId: 'student-1', component: 'base', amountCents: 20_000 }],
      paymentAttributions: [{ campaignId: 'campaign-1', communicationId: 'communication-1', amountCents: 5_000, paidAt: '2026-09-08T12:00:00-03:00' }],
    }],
    creatives: [{ id: 'creative-1', name: 'Arte', url: '/creative.png', approved: true, version: 1 }],
    campaigns: [{ id: 'campaign-1', name: 'Cobrança', type: 'collection', status: 'active', version: 1, approved: true, creativeId: 'creative-1' }],
    communications: [{ id: 'communication-1', campaignId: 'campaign-1', contactId: 'contact-1', scheduledAt: '2026-09-08T11:00:00-03:00', status: 'delivered', signature: 'unique-1', text: 'Olá, Ana' }],
    offers: [],
    tasks: [],
    clock: '2026-10-09T11:00:00-03:00',
  };
}

class FakeClient {
  constructor(pool) {
    this.pool = pool;
  }

  async query(sql, values = []) {
    this.pool.queries.push({ sql, values });
    if (sql === 'SELECT document FROM app_state WHERE id = 1') {
      return { rows: this.pool.document ? [{ document: this.pool.document }] : [] };
    }
    if (sql.startsWith('INSERT INTO app_state')) {
      this.pool.document = JSON.parse(values[0]);
    }
    if (this.pool.failPattern && sql.includes(this.pool.failPattern)) {
      throw new Error('falha simulada no PostgreSQL');
    }
    return { rows: [] };
  }

  release() {
    this.pool.releases += 1;
  }
}

class FakePool {
  constructor(document = null) {
    this.document = document;
    this.queries = [];
    this.releases = 0;
    this.failPattern = null;
  }

  async connect() {
    return new FakeClient(this);
  }
}

test('materializes inspectable rows and preserves complete JSON metadata', () => {
  const projection = materializeState(fixture());
  assert.equal(projection.presences.length, 1);
  assert.equal(projection.obligationItems.length, 1);
  assert.equal(projection.communications[0][13], 'Olá, Ana');
  assert.equal(projection.payments.length, 2);
  assert.equal(projection.payments[0][4], 5_000);
  assert.equal(projection.payments[0][6], 'campaign_attribution');
  assert.equal(projection.payments[1][4], 15_000);
  assert.equal(projection.payments[1][6], 'unattributed_balance');
  assert.equal(JSON.parse(projection.students[0].at(-1)).attendance.length, 2);
});

test('bootstraps PostgreSQL and serializes mutations without losing updates', async () => {
  const pool = new FakePool();
  const store = await createStore(null, fixture, { pool, schema: 'test_snaqfit' });

  const first = store.mutate(async (state) => {
    await Promise.resolve();
    state.counter = (state.counter ?? 0) + 1;
    return 'first';
  });
  const second = store.mutate((state) => {
    state.counter += 1;
    return 'second';
  });

  assert.deepEqual(await Promise.all([first, second]), ['first', 'second']);
  assert.equal(store.get().counter, 2);
  assert.equal(pool.document.counter, 2);
  assert.ok(pool.queries.some(({ sql }) => sql.includes('CREATE SCHEMA IF NOT EXISTS "test_snaqfit"')));
  assert.ok(pool.queries.some(({ sql }) => sql.startsWith('INSERT INTO students')));
  await store.close();
});

test('keeps cached state unchanged when materialization transaction fails', async () => {
  const pool = new FakePool(fixture());
  const store = await createStore(null, fixture, { pool });
  pool.failPattern = 'INSERT INTO students';

  await assert.rejects(
    store.mutate((state) => { state.clock = '2026-10-10T11:00:00-03:00'; }),
    /falha simulada/,
  );
  assert.equal(store.get().clock, '2026-10-09T11:00:00-03:00');
  assert.ok(pool.queries.some(({ sql }) => sql === 'ROLLBACK'));
  await store.close();
});
