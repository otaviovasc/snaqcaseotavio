import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../src/server.mjs';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

async function fixture(t) {
  const connectionString=process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const schema=`test_http_${randomUUID().replaceAll('-','')}`;
  const {server,app,closeStores} = await createServer({connectionString,schema,uploadDirectory:mkdtempSync(join(tmpdir(),'snaqfit-http-'))});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{
    await new Promise(resolve=>server.close(resolve));await closeStores();
    const pool=new Pool({connectionString});
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool.end();
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  const get = path=>fetch(url+path);
  const post = (path,data)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  return {app,url,get,post};
}

test('HTTP: preview → schedule → simulation → payment → history and CSV reconcile',async t=>{
  const {get,post} = await fixture(t);
  const preview = await (await post('/api/preview',{date:'2026-10-09',campaignId:'cmp-collection'})).json();
  assert.ok(preview.summary.eligible>0);
  assert.equal((await (await get('/api/state')).json()).communications.length,0,'preview is read only');
  const scheduled = await (await post('/api/schedule',{date:'2026-10-09',campaignId:'cmp-collection'})).json();
  assert.ok(scheduled.count>0);
  assert.equal((await (await post('/api/schedule',{date:'2026-10-09',campaignId:'cmp-collection'})).json()).count,0);
  const execution = await (await post('/api/execute',{date:'2026-10-09'})).json();
  assert.ok(execution.count>0);
  assert.equal((await post('/api/events',{type:'payment',obligationId:'obl-ana-oct',amountCents:20000})).status,200);
  const state = await (await get('/api/state')).json();
  assert.equal(state.obligations.find(o=>o.id==='obl-ana-oct').balanceCents,0);
  assert.ok(state.communications.some(c=>c.status==='converted'));
  const report = await (await get('/api/export.csv')).text();
  assert.ok(report.includes('converted'));
  assert.equal((await post('/api/execute',{date:'2026-10-09',mode:'real'})).status,409);
});

test('HTTP: local branding, integration configuration and origin protection',async t=>{
  const {get,url} = await fixture(t);
  const integration = await (await get('/api/integration')).json();
  assert.equal(integration.realSendEnabled,false);
  assert.equal(integration.mode,'simulation');
  assert.equal('token' in integration,false);
  assert.equal('connectedNumber' in integration,false);
  assert.equal((await get('/assets/logo-snaqfit.png')).status,200);
  const creative = await get('/creative/offer.svg');
  assert.equal(creative.status,200);
  assert.ok((await creative.text()).includes('Prata continua pago'));
  assert.equal((await get('/.env')).status,404);
  const blocked = await fetch(url+'/api/schedule',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:'{}'});
  assert.equal(blocked.status,403);
});

test('HTTP: sending a selected campaign preserves other scheduled messages',async t=>{
  const {get,post}=await fixture(t);
  await post('/api/schedule',{date:'2026-10-09'});
  const sent=await (await post('/api/execute',{date:'2026-10-09',campaignId:'cmp-offer'})).json();
  assert.ok(sent.count>0);
  assert.ok(sent.sent.every(c=>c.campaignId==='cmp-offer'));
  const state=await (await get('/api/state')).json();
  assert.ok(state.communications.some(c=>c.campaignId==='cmp-collection'&&c.status==='scheduled'));
});

test('HTTP: malformed payment cannot modify balance; upload validates actual image',async t=>{
  const {get,post} = await fixture(t);
  const before = await (await get('/api/state')).json();
  assert.equal((await post('/api/events',{type:'payment',obligationId:'obl-ana-oct',amountCents:-500})).status,400);
  const after = await (await get('/api/state')).json();
  assert.equal(after.obligations.find(o=>o.id==='obl-ana-oct').balanceCents,before.obligations.find(o=>o.id==='obl-ana-oct').balanceCents);
  assert.equal((await post('/api/upload',{name:'bad',dataUrl:'data:image/png;base64,YmFk'})).status,400);
});
