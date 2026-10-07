import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createImageService } from '../src/images.mjs';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

async function fixture(t,options){
  const connectionString=process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const schema=`test_img_${randomUUID().replaceAll('-','')}`;
  const pool=new Pool({connectionString});await pool.query(`CREATE SCHEMA "${schema}"`);
  const service=await createImageService({...options,connectionString,schema});
  t.after(async()=>{await service.close();await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool.end();});
  return service;
}

test('Image service: no startup calls; explicit generation, approval, cache and cap (mock only)',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'snaqfit-images-'));
  let calls=0,stored;
  const service=await fixture(t,{uploadDirectory:join(dir,'uploads'),
    env:{OPENROUTER_API_KEY:'fake-test-key',OPENROUTER_IMAGE_MODEL:'fake-model',OPENROUTER_MAX_GENERATIONS:'1'},
    fetchImpl:async (url,options)=>{
      calls++;
      assert.equal(url,'https://openrouter.ai/api/v1/images');
      const payload=JSON.parse(options.body);
      assert.equal(payload.n,1);
      assert.ok(!JSON.stringify(payload).includes('fake-test-key'));
      return {ok:true,json:async()=>({data:[{b64_json:'iVBORw0KGgo=',media_type:'image/png'}],usage:{cost:0.02}})};
    },composeSvg:async(type,bg)=>`<svg>${type}:${bg}</svg>`,
    saveCreative:payload=>(stored={id:'creative-test',...payload})});
  assert.equal(calls,0);
  await assert.rejects(()=>service.generate({campaignType:'offer',confirmed:false},'2026-10-09'),/Confirme/);
  assert.equal(calls,0);
  const result=await service.generate({campaignType:'offer',confirmed:true},'2026-10-09');
  assert.equal(result.costUsd,0.02);
  assert.equal(stored.approved,false);
  assert.ok(readFileSync(join(dir,stored.url),'utf8').includes('offer'));
  assert.equal((await service.config()).remaining,0);
  const cached=await service.generate({campaignType:'offer',confirmed:true},'2026-10-09');
  assert.equal(cached.cached,true);
  assert.equal(calls,1);
  await assert.rejects(()=>service.generate({campaignType:'return',confirmed:true},'2026-10-09'),/Limite/);
  assert.equal(calls,1);
});

test('Image service: unknown generation is retained; never silently retries (mock only)',async t=>{
  let calls=0;
  const service=await fixture(t,{env:{OPENROUTER_API_KEY:'fake',OPENROUTER_IMAGE_MODEL:'fake'},
    fetchImpl:async()=>{calls++;throw new Error('Timeout');},composeSvg:()=>'',saveCreative:()=>({})});
  await assert.rejects(()=>service.generate({campaignType:'return',confirmed:true},'2026-10-09'),/Timeout/);
  assert.equal((await service.config()).unknownCosts,1);
  await assert.rejects(()=>service.generate({campaignType:'return',confirmed:true},'2026-10-09'),/Já houve/);
  assert.equal(calls,1);
});
