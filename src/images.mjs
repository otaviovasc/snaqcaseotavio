import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Contract: https://openrouter.ai/docs/guides/overview/multimodal/image-generation
// Generation occurs only after an explicit action by the owner.
export async function createImageService({connectionString=process.env.DATABASE_URL,schema='public',uploadDirectory='./data/uploads',env=process.env,fetchImpl=fetch,composeSvg,saveCreative}={}) {
  if(!/^[a-z_][a-z0-9_]*$/.test(schema))throw new Error('Schema de imagem inválido.');
  const db=new Pool({connectionString,max:1,options:`-c search_path=${schema}`});
  await db.query(`CREATE TABLE IF NOT EXISTS image_generations (
    id TEXT PRIMARY KEY, cache_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
    model TEXT NOT NULL, campaign_type TEXT NOT NULL, cost_usd REAL,
    creative_id TEXT, creative_url TEXT, created_at TEXT NOT NULL
  )`);
  let busy=false;
  const max=()=>Math.min(20,Math.max(0,Number.parseInt(env.OPENROUTER_MAX_GENERATIONS || '3',10)||0));
  async function config() {
    const {rows}=await db.query('SELECT status,cost_usd FROM image_generations');
    return {configured:Boolean(env.OPENROUTER_API_KEY&&env.OPENROUTER_IMAGE_MODEL),
      model:env.OPENROUTER_IMAGE_MODEL || null,maxGenerations:max(),usedGenerations:rows.length,
      remaining:Math.max(0,max()-rows.length),billedUsd:rows.reduce((n,r)=>n+(r.cost_usd ?? 0),0),
      unknownCosts:rows.filter(r=>r.status!=='failed'&&r.cost_usd===null).length,
      realTested:rows.some(r=>r.status==='completed'),enabled:env.OPENROUTER_ENABLED!=='false'};
  }
  async function generate({campaignType,confirmed},clock) {
    if(!confirmed)throw new Error('Confirme a geração que pode consumir créditos.');
    if(!['reminder','collection','return','offer'].includes(campaignType))throw new Error('Escolha uma campanha-base.');
    const cfg=await config();
    if(!cfg.configured||!cfg.enabled)throw new Error('OpenRouter não configurado ou desabilitado no .env. Use uma arte local.');
    const cacheKey=`${env.OPENROUTER_IMAGE_MODEL}:${campaignType}:${String(clock).slice(0,7)}`;
    const cached=(await db.query('SELECT * FROM image_generations WHERE cache_key=$1',[cacheKey])).rows[0];
    if(cached?.status==='completed')return {cached:true,costUsd:cached.cost_usd,creative:{id:cached.creative_id,url:cached.creative_url}};
    if(cached)throw new Error('Já houve uma tentativa para esta campanha/modelo/mês. Confira o provedor antes de tentar novamente. As artes locais continuam disponíveis.');
    if(busy)throw new Error('Uma geração já está em andamento.');
    if(!cfg.remaining)throw new Error('Limite local de gerações atingido. Use uma arte local.');
    const id=randomUUID();
    await db.query('INSERT INTO image_generations(id,cache_key,status,model,campaign_type,created_at) VALUES ($1,$2,$3,$4,$5,$6)',[id,cacheKey,'pending',env.OPENROUTER_IMAGE_MODEL,campaignType,new Date().toISOString()]);
    busy=true;
    let providerCompleted=false, confirmedFailure=false;
    try {
      const scene=campaignType==='offer'?'An inviting modern gym with premium training equipment':campaignType==='return'?'A sunlit welcoming gym entrance and training floor':'Abstract minimalist flowing shapes suggesting movement and care';
      const prompt=`${scene}. Editorial background for a Brazilian fitness brand. Emerald green #009b59, warm off-white, charcoal. Calm, elegant, optimistic. Keep left half clear for typography added later. No text, no letters, no logo, no personal data, no identifiable people. Landscape 4:3 composition.`;
      const response=await fetchImpl('https://openrouter.ai/api/v1/images',{
        method:'POST',headers:{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`,'Content-Type':'application/json'},
        body:JSON.stringify({model:env.OPENROUTER_IMAGE_MODEL,prompt,n:1}),signal:AbortSignal.timeout(180000)
      });
      if(!response.ok){confirmedFailure=true;throw new Error(`OpenRouter respondeu HTTP ${response.status}. Use arte local e confira o modelo no provedor.`);}
      const result=await response.json();
      providerCompleted=true;
      const cost=typeof result.usage?.cost==='number'&&result.usage.cost>=0?result.usage.cost:null;
      await db.query('UPDATE image_generations SET cost_usd=$1 WHERE id=$2',[cost,id]);
      const image=result.data?.[0];
      if(!image?.b64_json||!['image/png','image/jpeg','image/webp'].includes(image.media_type || 'image/png'))throw new Error('Provedor não retornou uma imagem raster compatível.');
      const buffer=Buffer.from(image.b64_json,'base64');
      if(buffer.length>15*1024*1024||buffer.length<8)throw new Error('Imagem retornada fora do limite local.');
      const type=image.media_type || 'image/png';
      const signature=type==='image/png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?buffer[0]===255&&buffer[1]===216:buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP';
      if(!signature)throw new Error('Conteúdo de imagem inválido.');
      const svg=await composeSvg(campaignType,`data:${type};base64,${image.b64_json}`);
      const directory=resolve(uploadDirectory);
      await mkdir(directory,{recursive:true});
      const filename=`generated-${id}.svg`;
      await writeFile(resolve(directory,filename),svg,{flag:'wx'});
      const creative=await saveCreative({name:`IA · ${campaignType} · ${String(clock).slice(0,7)}`,url:`/uploads/${filename}`,approved:false});
      await db.query('UPDATE image_generations SET status=$1,creative_id=$2,creative_url=$3 WHERE id=$4',['completed',creative.id,creative.url,id]);
      return {creative,cached:false,costUsd:cost,status:'completed'};
    } catch(error) {
      await db.query('UPDATE image_generations SET status=$1 WHERE id=$2',[confirmedFailure&&!providerCompleted?'failed':'unknown',id]);
      throw new Error(error.message || 'Falha na geração. Use uma arte local.');
    } finally {busy=false;}
  }
  return {config,generate,close:()=>db.end()};
}
