import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const schemaSql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const DELETE_ORDER = [
  'tasks', 'offers', 'payments', 'communications', 'campaigns', 'creatives',
  'presences', 'obligation_items', 'obligations', 'students', 'payers', 'contacts',
];

function identifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`Schema PostgreSQL inválido: ${value}`);
  return `"${value}"`;
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function rows(state) {
  const contacts = (state.contacts ?? []).map((item) => [
    item.id, item.name, item.phone, item.financialAllowed ?? true,
    item.promotionalAllowed ?? true, item.automationBlocked ?? false, json(item),
  ]);
  const payers = (state.payers ?? []).map((item) => [item.id, item.name, item.kind, item.contactId, json(item)]);
  const students = (state.students ?? []).map((item) => [
    item.id, item.name, item.unit ?? null, item.plan, item.status, item.kind,
    item.payerId, item.contactId, item.planSince ?? null, item.lastAttendance ?? null,
    item.presenceSourceUpdatedAt ?? null, item.isMinor ?? false,
    item.corporateBasePayerId ?? null, json(item),
  ]);
  const obligations = (state.obligations ?? []).map((item) => [
    item.id, item.payerId, item.period, item.dueDate, item.nominalDue ?? null,
    item.amountCents, item.paidCents, item.balanceCents ?? item.amountCents - item.paidCents,
    item.status, item.paidAt ?? null, json(item),
  ]);
  const obligationItems = (state.obligations ?? []).flatMap((obligation) =>
    (obligation.items ?? []).map((item) => [
      obligation.id, item.studentId, item.component, item.amountCents,
      json({ ...item, obligationId: obligation.id }),
    ]));
  const presences = (state.students ?? []).flatMap((student) =>
    [...new Set(student.attendance ?? [])].map((occurredOn) => [
      student.id, occurredOn, json({ studentId: student.id, occurredOn }),
    ]));
  const creatives = (state.creatives ?? []).map((item) => [
    item.id, item.name, item.url, item.approved ?? false, item.version ?? 1, json(item),
  ]);
  const campaigns = (state.campaigns ?? []).map((item) => [
    item.id, item.name, item.type, item.status, item.version, item.priority ?? null,
    item.approved ?? false, item.creativeId ?? null, json(item),
  ]);
  const communications = (state.communications ?? []).map((item) => [
    item.id, item.campaignId, item.contactId, item.scheduledAt ?? null, item.sentAt ?? null,
    item.respondedAt ?? null, item.convertedAt ?? null, item.status, item.type ?? null,
    item.signature, item.amountCents ?? 0, item.recipientName ?? null, item.phone ?? null,
    item.text ?? null, item.creativeId ?? null, item.creativeUrl ?? null, json(item),
  ]);
  const payments = [];
  for (const obligation of state.obligations ?? []) {
    let attributedCents = 0;
    for (const [index, payment] of (obligation.paymentAttributions ?? []).entries()) {
      attributedCents += payment.amountCents;
      payments.push([
        `payment:${obligation.id}:attribution:${index + 1}`, obligation.id,
        payment.campaignId ?? null, payment.communicationId ?? null, payment.amountCents,
        payment.paidAt ?? obligation.paidAt ?? null, 'campaign_attribution',
        json({ ...payment, obligationId: obligation.id }),
      ]);
    }
    const unattributedCents = Math.max(0, (obligation.paidCents ?? 0) - attributedCents);
    if (unattributedCents > 0) {
      payments.push([
        `payment:${obligation.id}:unattributed`, obligation.id, null, null,
        unattributedCents, obligation.paidAt ?? null, 'unattributed_balance',
        json({ obligationId: obligation.id, amountCents: unattributedCents, paidAt: obligation.paidAt ?? null }),
      ]);
    }
  }
  const offers = (state.offers ?? []).map((item) => [
    item.id, item.studentId, item.payerId, item.communicationId ?? null, item.status,
    item.invitedAt ?? null, item.expiresAt, item.acceptedAt ?? null, item.startDate ?? null,
    item.endDate ?? null, item.continuation?.amountCents ?? null, json(item),
  ]);
  const tasks = (state.tasks ?? []).map((item) => [
    item.id, item.type, item.status, item.communicationId ?? null, item.contactId ?? null,
    item.createdAt ?? null, item.description ?? null, json(item),
  ]);

  return { contacts, payers, students, obligations, obligationItems, presences, creatives, campaigns, communications, payments, offers, tasks };
}

export function materializeState(state) {
  return rows(structuredClone(state));
}

async function insertRows(client, table, columns, values) {
  if (!values.length) return;
  const chunkSize = Math.max(1, Math.floor(10_000 / columns.length));
  for (let offset = 0; offset < values.length; offset += chunkSize) {
    const chunk = values.slice(offset, offset + chunkSize);
    const parameters = [];
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value) => {
        parameters.push(value);
        return `$${parameters.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`, parameters);
  }
}

async function persist(client, state) {
  const data = rows(state);
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('snaqfit:app_state'))");
    await client.query(
      `INSERT INTO app_state (id, document, updated_at) VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET document = EXCLUDED.document, updated_at = EXCLUDED.updated_at`,
      [json(state)],
    );
    for (const table of DELETE_ORDER) await client.query(`DELETE FROM ${table}`);
    await insertRows(client, 'contacts', ['id','name','phone','financial_allowed','promotional_allowed','automation_blocked','data'], data.contacts);
    await insertRows(client, 'payers', ['id','name','kind','contact_id','data'], data.payers);
    await insertRows(client, 'students', ['id','name','unit','plan','status','kind','payer_id','contact_id','plan_since','last_attendance','presence_source_updated_at','is_minor','corporate_base_payer_id','data'], data.students);
    await insertRows(client, 'obligations', ['id','payer_id','period','due_date','nominal_due','amount_cents','paid_cents','balance_cents','status','paid_at','data'], data.obligations);
    await insertRows(client, 'obligation_items', ['obligation_id','student_id','component','amount_cents','data'], data.obligationItems);
    await insertRows(client, 'presences', ['student_id','occurred_on','data'], data.presences);
    await insertRows(client, 'creatives', ['id','name','url','approved','version','data'], data.creatives);
    await insertRows(client, 'campaigns', ['id','name','type','status','version','priority','approved','creative_id','data'], data.campaigns);
    await insertRows(client, 'communications', ['id','campaign_id','contact_id','scheduled_at','sent_at','responded_at','converted_at','status','type','signature','amount_cents','recipient_name','phone','message_text','creative_id','creative_url','data'], data.communications);
    await insertRows(client, 'payments', ['id','obligation_id','campaign_id','communication_id','amount_cents','paid_at','attribution_kind','data'], data.payments);
    await insertRows(client, 'offers', ['id','student_id','payer_id','communication_id','status','invited_at','expires_at','accepted_at','start_date','end_date','continuation_amount_cents','data'], data.offers);
    await insertRows(client, 'tasks', ['id','type','status','communication_id','contact_id','created_at','description','data'], data.tasks);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function createStore(connectionString, seed, { initialState, pool: suppliedPool, schema = 'public' } = {}) {
  if (!connectionString && !suppliedPool) throw new Error('DATABASE_URL é obrigatória para iniciar o PostgreSQL');
  if (typeof seed !== 'function') throw new Error('createStore requer uma função seed');
  const schemaName = identifier(schema);
  const pool = suppliedPool ?? new Pool({ connectionString, max: 1, application_name: 'snaqfit' });
  const ownsPool = !suppliedPool;
  let state;
  let client;
  try {
    client = await pool.connect();
    if (schema !== 'public') await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    await client.query(`SET search_path TO ${schemaName}`);
    await client.query(schemaSql);
    const result = await client.query('SELECT document FROM app_state WHERE id = 1');
    if (result.rows[0]) {
      state = typeof result.rows[0].document === 'string' ? JSON.parse(result.rows[0].document) : result.rows[0].document;
    } else {
      state = structuredClone(initialState ?? seed());
      await persist(client, state);
    }
  } catch (error) {
    client?.release();
    client = null;
    if (ownsPool) await pool.end().catch(() => {});
    throw error;
  } finally {
    client?.release();
  }

  let queue = Promise.resolve();
  let closed = false;

  return {
    get: () => state,
    mutate(fn) {
      if (closed) return Promise.reject(new Error('Store PostgreSQL já foi fechado'));
      const operation = queue.then(async () => {
        const draft = structuredClone(state);
        const result = await fn(draft);
        const transactionClient = await pool.connect();
        try {
          await transactionClient.query(`SET search_path TO ${schemaName}`);
          await persist(transactionClient, draft);
          state = draft;
          return result;
        } finally {
          transactionClient.release();
        }
      });
      queue = operation.catch(() => {});
      return operation;
    },
    async close() {
      closed = true;
      await queue;
      if (ownsPool) await pool.end();
    },
  };
}
