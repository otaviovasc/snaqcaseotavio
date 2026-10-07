import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createApp } from './domain.mjs';
import { uazapiStatus, textPayload } from './uazapi.mjs';
import { createImageService } from './images.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const xml = s => String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function deliveryPreview(communication){
  return {method:'POST',path:'/send/text',payload:textPayload({...communication,id:communication.id||'Gerado ao programar'}),realSendEnabled:false};
}
const creativeCopy = {
  reminder: ['Sua rotina em dia.', 'Conte com a SnaqFit para seguir em movimento.', 'Um lembrete simples. Mais tranquilidade para treinar.'],
  collection: ['Vamos conversar?', 'Nosso time está aqui para ajudar você.', 'Atendimento próximo. Soluções com clareza.'],
  return: ['Seu próximo treino', 'pode começar hoje.', 'Retome no seu ritmo. A gente ajuda no primeiro passo.'],
  offer: ['Um novo ritmo.', 'Experimente o Ouro por um ciclo.', 'Adicional de R$ 100 dispensado no primeiro ciclo. Prata continua pago.']
};
function creativeSvg(type, logo, background = '') {
  const copy = creativeCopy[type] || creativeCopy.return;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#f4f6f2"/><circle cx="1060" cy="560" r="370" fill="#009b59"/><circle cx="1080" cy="560" r="270" fill="none" stroke="#3bc886" stroke-width="2"/><path d="M820 770L1030 380M950 850L1150 460" stroke="#83e5ab" stroke-width="25"/><image href="data:image/png;base64,${logo}" x="64" y="40" width="310" height="105"/><text x="70" y="205" font-family="Arial,sans-serif" font-size="18" letter-spacing="4" fill="#008b50">SNAQFIT · ${type==='offer'?'EXPERIÊNCIA OURO':'CUIDADO COM VOCÊ'}</text><text x="70" y="320" font-family="Arial,sans-serif" font-size="65" font-weight="700" fill="#161a18">${xml(copy[0])}</text><text x="70" y="405" font-family="Arial,sans-serif" font-size="34" fill="#161a18">${xml(copy[1])}</text><rect x="70" y="485" width="210" height="62" rx="31" fill="#009b59"/><text x="99" y="525" font-family="Arial,sans-serif" font-size="22" fill="white">Vamos juntos →</text><rect x="0" y="790" width="1200" height="110" fill="#fff"/><text x="70" y="834" font-family="Arial,sans-serif" font-size="20" fill="#35403a">${xml(copy[2])}</text><text x="70" y="870" font-family="Arial,sans-serif" font-size="16" fill="#69746e">Criativo demonstrativo · condições e benefícios sujeitos à aprovação do dono.</text></svg>`;
}

async function body(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    throw Object.assign(new Error('Use Content-Type application/json.'), { statusCode: 415 });
  }
  let chunks = [], size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw Object.assign(new Error('Arquivo excede 8 MB.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
  catch { throw Object.assign(new Error('JSON inválido.'), { statusCode: 400 }); }
}

function csv(state) {
  const rows = [['Campanha','Destinatário','Data','Status','Variante','Saldo no envio (R$)','Mensagem','Motivo']];
  for (const c of state.communications) rows.push([c.campaignName,c.recipientName,c.scheduledAt || c.date,c.status,c.variant,(c.amountCents || 0)/100,c.text,c.reason || '']);
  return '\uFEFF' + rows.map(row => row.map(v => {
    let s = String(v ?? '');
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"','""') + '"';
  }).join(';')).join('\r\n');
}

export async function createServer({connectionString=process.env.DATABASE_URL,schema='public',initialState,uploadDirectory=process.env.UPLOAD_DIRECTORY || resolve(root,'data/uploads')}={}) {
  const app = await createApp({connectionString,schema,initialState});
  const images = await createImageService({connectionString,schema,uploadDirectory,saveCreative:app.saveCreative,
    composeSvg:async (type,background)=>{
      const logo=(await readFile(resolve(root,'assets/logo-snaqfit.png'))).toString('base64');
      const svg=creativeSvg(type,logo);
      return svg.replace('<circle cx="1060"',`<image href="${background}" width="1200" height="790" preserveAspectRatio="xMidYMid slice"/><rect width="1200" height="790" fill="#f4f6f2" fill-opacity="0.8"/><circle cx="1060"`);
    }});
  const server = http.createServer(async (req,res) => {
    const send = (status, data, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'" });
      res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
    };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      // App local: requests with browser origin must originate from this host.
      if (req.method === 'POST' && req.headers.origin) {
        if (new URL(req.headers.origin).host !== req.headers.host) return send(403,{error:'Origem não autorizada.'});
      }
      if (req.method === 'GET' && path === '/api/health') return send(200,{ok:true,mode:'simulation'});
      if (req.method === 'GET' && path === '/api/state') {
        const snapshot=app.snapshot();
        return send(200,{...snapshot,communications:snapshot.communications.map(c=>({...c,deliveryPreview:deliveryPreview(c)}))});
      }
      if (req.method === 'GET' && path === '/api/integration') return send(200,uazapiStatus());
      if (req.method === 'GET' && path === '/api/image-config') return send(200,await images.config());
      if (req.method === 'GET' && path === '/api/export.csv') {
        res.setHeader('Content-Disposition','attachment; filename="snaqfit-comunicacoes.csv"');
        return send(200,csv(app.snapshot()),'text/csv; charset=utf-8');
      }
      if (req.method === 'POST') {
        const data = await body(req);
        if(path==='/api/preview'){
          const preview=app.preview(data);
          return send(200,{...preview,candidates:preview.candidates.map(c=>({...c,deliveryPreview:deliveryPreview(c)}))});
        }
        if (path === '/api/images/generate') return send(200,await images.generate(data,app.snapshot().clock));
        if (path === '/api/execute' && data.mode && data.mode !== 'simulation') return send(409,{error:'Envio real bloqueado nesta versão.'});
        const routes = { '/api/preview':'preview', '/api/schedule':'schedule', '/api/execute':'execute',
          '/api/events':'event', '/api/campaigns':'saveCampaign', '/api/advance':'advance', '/api/creatives':'saveCreative', '/api/demo-history':'seedHistory', '/api/case-demo':'resetCaseDemo' };
        if (routes[path]) return send(200,await app[routes[path]](data));
        if (path === '/api/upload') {
          const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(data.dataUrl || '');
          if (!match) return send(400,{error:'Use uma imagem PNG, JPEG ou WebP.'});
          const buffer = Buffer.from(match[2], 'base64');
          const valid = match[1] === 'png' ? buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
            : match[1] === 'jpeg' ? buffer[0]===255 && buffer[1]===216
            : buffer.subarray(0,4).toString()==='RIFF' && buffer.subarray(8,12).toString()==='WEBP';
          if (!valid || buffer.length > 5*1024*1024) return send(400,{error:'Imagem inválida ou maior que 5 MB.'});
          const filename = `${randomUUID()}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`;
          const uploadDir = resolve(uploadDirectory);
          await mkdir(uploadDir,{recursive:true});
          await writeFile(resolve(uploadDir,filename),buffer,{flag:'wx'});
          return send(201,{url:`/uploads/${filename}`,name:String(data.name || 'Arte local').slice(0,100)});
        }
        return send(404,{error:'Ação não encontrada.'});
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405,{error:'Método não permitido.'});
      if (/^\/creative\/(reminder|collection|return|offer)\.svg$/.test(path)) {
        const logo = (await readFile(resolve(root,'assets/logo-snaqfit.png'))).toString('base64');
        return send(200,creativeSvg(path.split('/').pop().split('.')[0],logo),'image/svg+xml');
      }
      let base, relative;
      if (path.startsWith('/assets/')) { base = resolve(root,'assets'); relative = path.slice(8); }
      else if (path.startsWith('/uploads/')) { base = resolve(uploadDirectory); relative = path.slice(9); }
      else { base = resolve(root,'public'); relative = path === '/' ? 'index.html' : path.slice(1); }
      const file = resolve(base,decodeURIComponent(relative));
      if (!file.startsWith(base + sep) || !mime[extname(file)]) return send(404,{error:'Arquivo não encontrado.'});
      try { return send(200,await readFile(file),mime[extname(file)]); }
      catch { return send(404,{error:'Arquivo não encontrado.'}); }
    } catch (error) {
      send(error.statusCode || 400,{error: String(error.message || 'Não foi possível concluir a ação.').slice(0,350)});
    }
  });
  let closing;
  const closeStores=()=>closing??=(async()=>{await images.close();await app.close();})();
  server.on('close', () => {void closeStores();});
  return {server,app,closeStores};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {server,app,closeStores} = await createServer();
  // A fresh checkout opens a demonstrable case, without sending anything.
  if(!app.snapshot().demoHistory && app.snapshot().communications.length===0){
    await app.seedHistory();
    await app.schedule({date:'2026-10-09'});
  }
  const port = Number(process.env.PORT || 3087);
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`SnaqFit local na porta ${port} · simulação · Uazapi bloqueada`));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await closeStores();process.exit(0);}));
}
