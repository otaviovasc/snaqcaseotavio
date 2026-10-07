(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const app = $("#app");
  const routeNames = {
    overview: ["CENTRAL SNAQFIT", "Visão geral"], audiences: ["SEGMENTAÇÃO", "Públicos"],
    campaigns: ["RELACIONAMENTO", "Campanhas"], schedule: ["OPERAÇÃO", "Operação de hoje"],
    students: ["BASE E RESPONSABILIDADE", "Alunos e financeiro"], history: ["RASTREABILIDADE", "Histórico"],
    offers: ["EXPERIMENTAÇÃO", "Ofertas Ouro"], creatives: ["MARCA E CONTEÚDO", "Criativos"],
    metrics: ["APRENDIZADO", "Resultados"], simulation: ["ATUALIZAR CENÁRIO", "Registrar evento"]
  };
  const labels = {
    reminder: "Lembrete de vencimento", collection: "Regularização", return: "Retomada de frequência", offer: "Experimentação Ouro",
    active: "Ativo", paused: "Pausado", draft: "Rascunho", scheduled: "Programada", accepted: "Envio aceito",
    delivered: "Entrega registrada", responded: "Resposta recebida", converted: "Objetivo atingido", failed: "Envio não concluído", unknown: "Entrega ainda não confirmada", cancelled: "Cancelado",
    eligible: "Pronta para enviar", excluded: "Fora desta campanha", deferred: "Enviar depois", pending: "Pendente", paid: "Pago", overdue: "Pagamento em atraso",
    open: "Em aberto", disputed: "Em contestação", resolved: "Resolvido", done: "Concluído", blocked: "Bloqueado",
    individual: "Individual", family: "Família", corporate: "Corporativo", company: "Empresa", person: "Pessoa", silver: "Prata", gold: "Ouro",
    trial: "Benefício ativo", offered: "Oferta disponível", invited: "Convite enviado", completed: "Voltou ao Prata", expired: "Expirada", reverted: "Voltou ao Prata", continued: "Continuidade paga",
    paid_claim: "Pagamento informado", dispute: "Contestação", optout: "Contato não autorizado", reply: "Resposta recebida", collection_followup: "Acompanhamento financeiro"
  };
  const audienceNames = {
    "good-history":"Bom histórico", "recurring-late":"Atraso recorrente", "insufficient-history":"Histórico insuficiente/misto",
    current:"Em dia", overdue:"Pagamento em atraso", frequent:"Frequente", absent:"Ausente", "long-silver":"Prata de longa permanência",
    gold:"Ouro", individual:"Individual", family:"Família", corporate:"Corporativo", "promo-blocked":"Promoção bloqueada", "critical-review":"Revisão impeditiva"
  };
  const businessLabel = (value, fallback = "Situação registrada") => labels[value] || audienceNames[value] || fallback;
  const audienceLabel = value => audienceNames[value] || "Critério do cadastro";
  const creativeName = (name, type) => /\b(reminder|collection|return|offer)\b/i.test(String(name||"")) ? `Imagem · ${businessLabel(type,"Campanha")}` : (name || `Imagem · ${businessLabel(type,"Campanha")}`);
  const communicationOutcome = c => {
    if(c.status==="converted") return c.type==="return"?"Aluno voltou aos treinos":c.type==="offer"?"Oferta aceita":"Pagamento registrado";
    if(c.status==="responded") return "Pessoa respondeu à mensagem";
    if(c.status==="delivered"||c.status==="accepted") return "Entrega registrada";
    if(c.status==="failed") return "Envio não concluído";
    if(c.status==="unknown") return "Entrega ainda não confirmada";
    if(c.reason&&!/(sint[eé]tic|mock|seed|fixture)/i.test(c.reason)) return displayReason(c.reason);
    return businessLabel(c.status);
  };
  const displayReason = value => {
    const reason=String(value||"");
    if(!reason) return "Regra da campanha aplicada";
    if(/já programad|already scheduled/i.test(reason)) return "Já está na agenda desta data";
    if(/crit[eé]rios atendidos/i.test(reason)) return "Regras da campanha atendidas";
    if(/sint[eé]tic|mock|seed|fixture/i.test(reason)) return "Registro inicial do cenário";
    const translated=Object.entries(audienceNames).reduce((text,[id,label])=>text.replace(new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"gi"),label),reason);
    if(translated!==reason) return translated.replace(/^impedimento:\s*/i,"Revisão necessária: ");
    if(/^[a-z0-9_-]+$/i.test(reason)) return businessLabel(reason,"Regra operacional aplicada");
    return reason;
  };
  function locationSelection() {
    const [path, query = ""] = location.hash.slice(1).split("?");
    const route = routeNames[path] ? path : "overview";
    const params=new URLSearchParams(query);
    return {route, student:route === "students" ? params.get("student") : null, campaign:route === "history" ? params.get("campaign") : null, communication:route === "history" ? params.get("communication") : null};
  }
  const initialSelection = locationSelection();
  const state = { data: null, integration: null, imageConfig: null, route: initialSelection.route, selectedAudience: null, selectedStudent: initialSelection.student, selectedCommunication:initialSelection.communication, preview: null, filters: {historyCampaign:initialSelection.campaign}, busy: false, loadingPreview: false, previewSeq: 0 };

  const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
  const attr = esc;
  const money = cents => new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"}).format((Number(cents) || 0) / 100);
  const shortDate = value => value ? new Intl.DateTimeFormat("pt-BR", {day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)) : "—";
  const numericDate = value => value ? new Intl.DateTimeFormat("pt-BR", {day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)) : "—";
  const dateTime = value => value ? new Intl.DateTimeFormat("pt-BR", {day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)) : "—";
  const statusPill = (status, text) => `<span class="pill ${attr(status)}">${esc(text || businessLabel(status))}</span>`;
  const empty = (title, note) => `<div class="empty"><div class="empty-icon">◇</div><strong>${esc(title)}</strong><span>${esc(note)}</span></div>`;
  const pageHead = (title, note, actions = "") => `<div class="page-head"><div><h2>${esc(title)}</h2><p>${esc(note)}</p></div><div class="actions">${actions}</div></div>`;
  const campaignById = id => (state.data.campaigns || []).find(c => c.id === id);
  const today = () => String(state.data?.clock || new Date().toISOString()).slice(0, 10);
  const unique = arr => [...new Set(arr)];
  const safeUrl = value => { if (!value) return ""; try { const url = new URL(value, location.origin); return ["http:","https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };

  async function request(path, options = {}) {
    const response = await fetch(path, { headers: {"Content-Type":"application/json", ...(options.headers || {})}, ...options });
    const type = response.headers.get("content-type") || "";
    const body = type.includes("json") ? await response.json() : await response.text();
    if (!response.ok) throw new Error(body?.error || body?.message || `Erro ${response.status}`);
    return body;
  }
  async function load(showLoader = false) {
    if (showLoader) app.innerHTML = `<div class="loading"><span></span><p>Preparando a operação…</p></div>`;
    try {
      const [data, integration, imageConfig] = await Promise.all([request("/api/state"), request("/api/integration").catch(() => null), request("/api/image-config").catch(() => null)]);
      state.data = data; state.integration = integration; state.imageConfig = imageConfig; updateChrome();
      if(state.route==="schedule") await refreshPreview(true); else render();
    } catch (error) { app.innerHTML = empty("Não foi possível carregar os dados", error.message); toast(error.message, "error"); }
  }
  async function mutate(path, payload, success) {
    if (state.busy) return; state.busy = true;
    try { const result = await request(path, {method:"POST",body:JSON.stringify(payload)}); toast(success || "Alteração salva", "success"); await load(); return result; }
    catch (error) { toast(error.message, "error"); throw error; }
    finally { state.busy = false; if (state.data) render(); }
  }
  function toast(message, type = "success") {
    const el = document.createElement("div"); el.className = `toast ${type}`; el.textContent = message; $("#toasts").append(el); setTimeout(() => el.remove(), 4200);
  }
  function updateChrome() {
    const meta = routeNames[state.route] || routeNames.overview;
    $("#page-eyebrow").textContent = meta[0]; $("#page-title").textContent = meta[1];
    $("#scenario-clock").textContent = state.data?.clock ? dateTime(state.data.clock) : "—";
    const groups = {audiences:"campaigns",creatives:"campaigns",history:"schedule",offers:"students",simulation:""};
    const activeRoot = groups[state.route] || state.route;
    $$(".sidebar [data-route]").forEach(el => el.classList.toggle("active", el.dataset.route === activeRoot));
    const i = state.integration; const configured = Boolean(i?.instanceConfigured && i?.tokenConfigured && i?.serverUrlConfigured);
    $("#integration-dot").classList.toggle("ok", configured);
    $("#integration-label").textContent = configured ? "Integração preparada" : "Envio real desabilitado";
    $("#integration-detail").textContent = i?.realSendEnabled ? "Envio real habilitado" : "Envio real desabilitado";
  }
  function render() {
    if (!state.data) return;
    const pages = {overview:renderOverview,audiences:renderAudiences,campaigns:renderCampaigns,schedule:renderSchedule,students:renderStudents,history:renderHistory,offers:renderOffers,creatives:renderCreatives,metrics:renderMetrics,simulation:renderSimulation};
    app.innerHTML = secondaryTabs() + (pages[state.route] || pages.overview)();
  }
  function secondaryTabs() {
    const sets = {
      campaigns:[["campaigns","Campanhas"],["creatives","Artes"]],
      audiences:[["campaigns","Campanhas"],["creatives","Artes"]],
      creatives:[["campaigns","Campanhas"],["creatives","Artes"]],
      schedule:[["schedule","Hoje"],["history","Histórico"]], history:[["schedule","Hoje"],["history","Histórico"]],
      students:[["students","Financeiro"],["offers","Ofertas Ouro"]], offers:[["students","Financeiro"],["offers","Ofertas Ouro"]]
    };
    const tabs=sets[state.route]; if(!tabs)return "";
    return `<nav class="tabs" aria-label="Seções desta área">${tabs.map(([route,label])=>`<button class="tab ${state.route===route?"active":""}" data-route="${route}">${label}</button>`).join("")}</nav>`;
  }

  function renderOverview() {
    const d = state.data, obligations = d.obligations || [], communications = d.communications || [], tasks = d.tasks || [];
    const openBalance = obligations.filter(o => !["paid","cancelled"].includes(o.status)).reduce((sum,o) => sum + (o.balanceCents || 0), 0);
    const scenarioDate=today(), overdue = obligations.filter(o => o.status === "overdue"), scheduled = communications.filter(c => c.status === "scheduled"), todayComms=communications.filter(c=>c.date===scenarioDate);
    const delivered=communications.filter(c=>["accepted","delivered","responded","converted"].includes(c.status)), converted = (d.metrics || []).reduce((sum,m) => sum + (m.converted || 0), 0);
    const taskOpen = tasks.filter(t => !["resolved","done"].includes(t.status));
    const latest=communications.slice().sort((a,b)=>String(b.scheduledAt||b.date).localeCompare(String(a.scheduledAt||a.date))).slice(0,8);
    return `${pageHead("O que está acontecendo hoje", "Três perguntas guiam a operação: quem recebe, qual mensagem será usada e o que aconteceu depois.", `<button class="btn primary" data-route="schedule">Revisar envios de hoje →</button>`)}
      <div class="case-summary"><strong>${d.caseProfile?.people||d.students?.length||0} pessoas</strong><span>Exemplos de vínculos individual, familiar e corporativo</span></div>
      <div class="focus-grid">
        <article class="focus-card"><div class="focus-number">1</div><h3>Quem recebe?</h3><p>Contatos únicos programados para a data do cenário, depois das regras de prioridade e limite.</p><div class="focus-value">${unique(todayComms.filter(c=>c.status==="scheduled").map(c=>c.contactId)).length}</div><div class="focus-list">${esc(todayComms.filter(c=>c.status==="scheduled").slice(0,3).map(c=>c.recipientName).join(" · ")||"Nenhum contato programado")}</div><button class="btn small" data-route="schedule">Conferir pessoas</button></article>
        <article class="focus-card"><div class="focus-number">2</div><h3>Qual mensagem?</h3><p>Campanhas ativas definem texto, público, prioridade e arte antes de qualquer programação.</p><div class="focus-value">${(d.campaigns||[]).filter(c=>c.status==="active").length}</div><div class="focus-list">campanhas ativas e aprovadas</div><button class="btn small" data-route="campaigns">Revisar campanhas</button></article>
        <article class="focus-card"><div class="focus-number">3</div><h3>O que aconteceu?</h3><p>Entregas, respostas e resultados ficam ligados à comunicação original.</p><div class="focus-value">${delivered.length} <small>entregas</small></div><div class="focus-list">${converted} objetivo(s) concluído(s) · ${taskOpen.length} pendência(s)</div><button class="btn small" data-route="history">Abrir histórico</button></article>
      </div>
      <div class="kpi-grid">${kpi("Saldo em aberto",money(openBalance),`${overdue.length} obrigação(ões) vencida(s)`,"R$")}${kpi("Próximos envios",scheduled.length,`${unique(scheduled.map(c=>c.contactId)).length} contatos únicos`,"□")}${kpi("Resultados registrados",converted,"conforme objetivo da campanha","↗")}${kpi("Aguardando equipe",taskOpen.length,taskOpen.length?"precisam de decisão":"nenhuma pendência","!")}</div>
      <section class="card"><div class="card-head"><div><h3>Últimas movimentações</h3><p>Quem recebeu, qual mensagem e o resultado registrado.</p></div><button class="btn small" data-route="history">Ver tudo</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Quem</th><th>Mensagem</th><th>O que aconteceu</th></tr></thead><tbody>${latest.map(c=>`<tr><td>${dateTime(c.scheduledAt||c.date)}</td><td class="main-cell">${esc(c.recipientName)}</td><td>${esc(c.campaignName||businessLabel(c.type,"Campanha"))}</td><td>${statusPill(c.status)}<span class="sub">${esc(communicationOutcome(c))}</span></td></tr>`).join("")||`<tr><td colspan="4">${empty("Ainda sem movimentações","Revise a operação de hoje e programe o primeiro lote.")}</td></tr>`}</tbody></table></div></section>`;
  }
  function kpi(label, value, note, icon) { return `<article class="kpi"><div class="kpi-top"><span class="kpi-label">${esc(label)}</span><span class="kpi-icon">${esc(icon)}</span></div><div class="kpi-value">${esc(value)}</div><div class="kpi-note">${esc(note)}</div></article>`; }

  function renderAudiences() {
    const audiences = state.data.audiences || []; const selected = audiences.find(a=>a.id === state.selectedAudience) || audiences[0];
    return `${pageHead("Públicos reutilizáveis", "Cada público explica sua regra e seus membros. O contexto guardado na comunicação preserva o histórico.")}
      <div class="grid-2"><div class="audience-grid">${audiences.map(a=>`<button class="entity-card text-left" data-audience="${attr(a.id)}"><div class="entity-top"><div><h3>${esc(a.name)}</h3><p>${esc(a.description)}</p></div><span class="pill neutral">DINÂMICO</span></div><div class="entity-meta"><strong>${a.count ?? (a.members||[]).length}</strong><span>membros atuais<br>podem se sobrepor</span></div></button>`).join("")}</div>
      <aside class="card detail-panel"><div class="card-head"><div><h3>${esc(selected?.name || "Selecione um público")}</h3><p>Motivo de inclusão no cenário atual</p></div>${selected ? `<span class="pill green">${selected.count ?? (selected.members||[]).length}</span>` : ""}</div><div class="card-body member-list">${selected && (selected.members||[]).length ? selected.members.map(m=>`<div class="member"><div><strong>${esc(m.name)}</strong><p>${esc(displayReason(m.reason || "Atende aos critérios atuais."))}</p></div><span class="pill neutral">${esc(m.kind === "payer" ? "PAGADOR" : "ALUNO")}</span></div>`).join("") : empty("Sem membros", "Nenhuma pessoa atende à regra neste momento.")}</div></aside></div>`;
  }

  function renderCampaigns() {
    const campaigns = state.data.campaigns || [];
    const segment={reminder:"Responsáveis com mensalidade próxima do vencimento",collection:"Responsáveis com saldo vencido",return:"Alunos ativos sem treinar há 14 dias",offer:"Alunos Prata antigos, frequentes e com pagamentos em dia"};
    const objective={reminder:"Evitar atraso com um lembrete útil",collection:"Ajudar a regularizar o saldo em aberto",return:"Ajudar o aluno a retomar a rotina",offer:"Apresentar a experiência Ouro sem cobrar por silêncio"};
    return `${pageHead("Quatro campanhas essenciais", "Cada campanha tem um objetivo e um público simples. Revise a mensagem, confira a prévia e ative quando estiver pronta.")}
      <div id="campaign-editor"></div><div class="campaign-grid">${campaigns.filter(c=>["reminder","collection","return","offer"].includes(c.type)).slice(0,4).map(c=>`<article class="entity-card"><div class="entity-top"><div><span class="pill blue">${esc(businessLabel(c.type,"Campanha"))}</span><h3 class="mt-10">${esc(c.name)}</h3></div>${statusPill(c.status,c.status==="active"?"Ativa":c.status==="paused"?"Pausada":undefined)}</div><div class="section-title">Objetivo</div><p>${esc(objective[c.type])}</p><div class="section-title">Quem recebe</div><p>${esc(segment[c.type])}</p>${c.abEnabled?`<div class="criteria"><span class="criteria-chip require">Comparação A/B ativa por vínculo</span></div>`:""}<div class="entity-meta"><button class="btn small" data-action="edit-campaign" data-id="${attr(c.id)}">Mensagem e arte</button><button class="btn small ${c.status === "active" ? "danger" : "primary"}" data-action="toggle-campaign" data-id="${attr(c.id)}">${c.status === "active" ? "Pausar" : "Ativar"}</button><button class="btn small" data-action="preview-campaign" data-id="${attr(c.id)}">Ver quem recebe</button></div></article>`).join("")}</div>`;
  }
  function campaignEditor(c = {}) {
    const creatives = state.data.creatives || [];
    const groups=["individual","family","corporate"], groupLabels={individual:"Individual",family:"Família",corporate:"Corporativo"}, help={individual:"A mensagem vai ao próprio pagador do plano.",family:"A mensagem financeira vai ao titular; promoção que altera preço exige aceite do pagador.",corporate:"A empresa responde pela base e o aluno pelo adicional, conforme o contexto."};
    const currentCreative=creatives.find(x=>x.id===c.creativeId);
    return `<section class="card mb-18"><div class="card-head"><div><h3>${esc(c.name)}</h3><p>Compare duas mensagens dentro de cada tipo de vínculo, mantendo a responsabilidade financeira correta.</p></div><button class="btn small" data-action="close-editor">Fechar</button></div><form id="campaign-form" class="card-body"><input type="hidden" name="id" value="${attr(c.id||"")}"><input type="hidden" name="name" value="${attr(c.name||"")}"><input type="hidden" name="type" value="${attr(c.type||"")}"><input type="hidden" name="status" value="${attr(c.status||"paused")}"><div class="grid-even"><div><div class="field"><label>Grupo de vínculo</label><select class="select" id="message-group">${groups.map(g=>`<option value="${g}">${groupLabels[g]}</option>`).join("")}</select></div>${groups.map((g,index)=>`<div class="group-editor mt-12" data-group-panel="${g}" ${index?"hidden":""}><div class="callout">${help[g]}</div><div class="field mt-12"><label>Mensagem A</label><textarea required class="textarea" name="${g}A">${esc(c.messageGroups?.[g]?.A||c.template||"")}</textarea></div><div class="field mt-12"><label>Mensagem B</label><textarea required class="textarea" name="${g}B">${esc(c.messageGroups?.[g]?.B||c.templateB||c.template||"")}</textarea></div></div>`).join("")}<label class="check ab-toggle"><input type="checkbox" name="abEnabled" ${c.abEnabled?"checked":""}><span><strong>Ativar comparação A/B nos três grupos</strong><br>Distribuição estável; o sistema não declara vencedor automaticamente.</span></label><p class="copy-muted mt-12">Campos: {{nome}}, {{valor}}, {{vencimento}}, {{contexto}} e {{responsavel}}. O sistema preenche o destinatário e o componente financeiro corretos.</p></div><div><div class="field"><label>Arte da campanha</label><select class="select" name="creativeId" id="campaign-creative"><option value="" data-url="">Sem arte</option>${creatives.filter(x=>x.approved).map(x=>`<option value="${attr(x.id)}" data-url="${attr(x.url)}" ${c.creativeId===x.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select></div><img class="editor-art-preview" id="editor-art-preview" src="${attr(safeUrl(currentCreative?.url))}" alt="Prévia da arte" ${currentCreative?"":"hidden"}><div class="callout mt-12">A prévia mostra a mensagem e a arte exatas. Conheça a referência da marca em <a href="https://snaq.co" target="_blank" rel="noreferrer">snaq.co</a>.</div></div></div><div class="actions mt-16"><button class="btn primary" type="submit">Salvar mensagens</button><button class="btn" type="button" data-action="preview-campaign" data-id="${attr(c.id)}">Abrir prévia</button></div></form></section>`;
  }

  function renderSchedule() {
    const campaigns = (state.data.campaigns||[]).filter(c=>c.status === "active"), preview=state.preview, date=state.filters.previewDate||preview?.date||today();
    const rawRows=preview?.candidates||[], rank={eligible:0,deferred:1,excluded:2};
    const rows=rawRows.filter(c=>c.status!=="excluded"&&(!state.filters.todayType||c.type===state.filters.todayType)).slice().sort((a,b)=>(rank[a.status]??3)-(rank[b.status]??3));
    const eligible=rawRows.filter(x=>x.status==="eligible"&&(!state.filters.todayType||x.type===state.filters.todayType)), offerEligible=rawRows.filter(x=>x.status==="eligible"&&x.type==="offer");
    const messages=(state.data.communications||[]).filter(c=>(c.date||String(c.scheduledAt||"").slice(0,10))===date&&(!state.filters.previewCampaign||c.campaignId===state.filters.previewCampaign)&&(!state.filters.todayType||c.type===state.filters.todayType)).sort((a,b)=>String(b.scheduledAt||b.date).localeCompare(String(a.scheduledAt||a.date)));
    const pending=messages.filter(c=>c.status==="scheduled");
    const displayRows=eligible.length?rows:pending.length?pending:rows;
    const rules={reminder:"Lembrete: só quem tem uma mensalidade aberta perto do vencimento.",collection:"Regularização: só quem tem saldo vencido e pode receber um novo contato.",return:"Retomada: só quem está há pelo menos 14 dias sem treinar, com contrato ativo.",offer:"Ouro: só quem está no Prata, treina com frequência, está em dia e pode experimentar."};
    const selectionHelp=`<details class="selection-explanation"><summary>Como escolhemos as pessoas?</summary><p>Esta tela mostra apenas quem tem uma ação prevista. Estar fora de uma campanha é normal: quem já tem Ouro não recebe convite para o Ouro; quem está treinando não recebe mensagem de retomada.</p><ul>${(state.filters.previewCampaign?campaigns.filter(c=>c.id===state.filters.previewCampaign):campaigns).map(c=>`<li>${esc(rules[c.type])}</li>`).join("")}</ul><p>Mensagens já programadas aparecem na agenda. Pagamento registrado, presença recente e autorização de contato são conferidos novamente antes do envio.</p></details>`;
    const body=state.loadingPreview?`<section class="card"><div class="loading"><span></span><p>Calculando quem pode receber hoje…</p></div></section>`:!preview?`<section class="card">${empty("Não foi possível calcular a prévia","Use Atualizar para tentar novamente.")}</section>`:`<div class="summary-strip"><div class="summary-item"><strong>${preview.summary?.eligible??eligible.length}</strong><span>Para programar</span></div><div class="summary-item"><strong>${pending.length}</strong><span>Já programadas</span></div><div class="summary-item"><strong>${preview.summary?.deferred??rawRows.filter(x=>x.status==="deferred").length}</strong><span>Enviar depois</span></div></div>
      ${offerEligible.length?`<div class="callout warning mb-16"><strong>${offerEligible.length} oferta(s) Ouro podem ser programadas</strong> após prioridade, permissão e limites de contato. <button class="btn small" data-action="filter-offer-today">Ver ofertas</button></div>`:""}
      ${state.filters.todayType?`<div class="actions mb-16"><span class="pill blue">Filtro: Experimentação Ouro</span><button class="btn small" data-action="clear-today-filter">Mostrar todas</button></div>`:""}
      <div class="preview-layout"><section class="card"><div class="card-head"><div><h3>${eligible.length?"Prontas para enviar":pending.length?"Mensagens programadas":"Nenhuma mensagem pronta"}</h3><p>${eligible.length?"Confira a pessoa, a mensagem e a imagem antes de programar.":pending.length?"Estas mensagens já estão na agenda. Você decide quando registrar o envio.":"As campanhas não têm uma ação pronta nesta data. Veja abaixo como a seleção funciona."}</p></div></div><div class="card-body member-list">${displayRows.length?displayRows.map((c,i)=>`<button class="member member-button" data-action="select-preview" data-index="${i}"><div><strong>${esc(c.recipientName||c.name||"Destinatário")}</strong><p>${esc(c.campaignName||businessLabel(c.type,"Campanha"))} · ${esc(displayReason(c.reason))}</p></div>${statusPill(c.status)}</button>`).join(""):empty("Sem novos envios nesta campanha","Isso pode ser normal: a pessoa não precisa desta mensagem agora.")}</div></section>${previewPhone(displayRows[Number(state.filters.previewIndex)||0])}</div>
      <div class="actions mt-16"><button class="btn primary" data-action="schedule-preview" ${!eligible.length||state.busy?"disabled":""}>Programar lote (${eligible.length})</button><button class="btn dark" data-action="execute-mock" ${(!eligible.length&&!pending.length)||state.busy?"disabled":""}>Registrar envio (${pending.length+eligible.length})</button></div>`;
    return `${pageHead("Operação de hoje", "Confira quem recebe, qual mensagem será usada e o que já aconteceu. Abrir esta tela nunca envia nada.")}
      <div class="filters"><div class="field compact"><label>Data</label><input class="input" id="preview-date" type="date" value="${attr(date)}"></div><div class="field"><label>Campanha</label><select class="select" id="preview-campaign"><option value="">Todas as campanhas ativas</option>${campaigns.map(c=>`<option value="${attr(c.id)}" ${state.filters.previewCampaign===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div><button class="btn" data-action="generate-preview" ${state.loadingPreview?"disabled":""}>${state.loadingPreview?"Atualizando…":"Atualizar"}</button></div>${body}${selectionHelp}
      <section class="card mt-18"><div class="card-head"><div><h3>Mensagens de hoje</h3><p>${pending.length} programada(s) · ${messages.filter(c=>["accepted","delivered","responded","converted"].includes(c.status)).length} entregue(s) · ${messages.filter(c=>c.status==="responded"||c.respondedAt).length} resposta(s) · ${messages.filter(c=>["failed","unknown"].includes(c.status)).length} não concluída(s) ou sem confirmação</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Horário</th><th>Quem</th><th>Campanha</th><th>Mensagem</th><th>O que aconteceu</th></tr></thead><tbody>${messages.map(c=>`<tr><td>${dateTime(c.scheduledAt||c.date)}</td><td class="main-cell">${esc(c.recipientName)}</td><td>${esc(c.campaignName)}</td><td>${esc(businessLabel(c.group,"Grupo padrão"))} · ${esc(c.variant||"A")}</td><td>${statusPill(c.status)}<span class="sub">${esc(communicationOutcome(c))}</span></td></tr>`).join("")||`<tr><td colspan="5">${empty("Nenhuma mensagem nesta data","O lote programado aparecerá aqui.")}</td></tr>`}</tbody></table></div></section>`;
  }
  function deliveryExplanation(c) {
    const delivery=c.deliveryPreview;
    if(!delivery)return "";
    return `<details class="delivery-explanation"><summary>Como seria enviada pelo WhatsApp?</summary><p><strong>Esta versão apenas simula o envio.</strong> O texto abaixo é o pedido preparado para a Uazapi; abrir este detalhe não faz nenhuma chamada.</p><p>O servidor usaria a URL e o token guardados no ambiente para enviar este conteúdo. O número identifica o destinatário; o identificador liga a mensagem ao histórico.</p><div class="delivery-request"><strong>${esc(delivery.method)} ${esc(delivery.path)}</strong><pre>${esc(JSON.stringify(delivery.payload,null,2))}</pre></div><p><strong>E a imagem?</strong> A arte aparece nesta prévia, mas o adaptador atual prepara somente texto. O envio de mídia ainda precisa ser conectado e validado.</p><p>Próxima etapa: conectar o adaptador, registrar a identificação retornada pela Uazapi e receber confirmações de entrega e respostas. Envio aceito não significa entrega confirmada.</p><span class="copy-muted">Credenciais não aparecem aqui. Não houve envio real.</span></details>`;
  }
  function previewPhone(c) {
    if (!c) return `<section class="card">${empty("Selecione uma linha", "A mensagem e a arte exatas aparecerão aqui.")}</section>`;
    const creative = (state.data.creatives||[]).find(x=>x.id === c.creativeId); const url = safeUrl(c.creativeUrl || creative?.url || "");
    const group=c.group||c.recipientGroup||c.criteriaSnapshot?.group;
    return `<section class="card"><div class="card-head"><div><h3>Mensagem exata</h3><p>${esc(c.campaignName || businessLabel(c.type,"Campanha"))} · ${esc(businessLabel(group,"Grupo padrão"))} · mensagem ${esc(c.variant || "A")}</p></div>${statusPill(c.status)}</div><div class="card-body"><div class="phone"><div class="phone-screen"><div class="message">${url ? `<img src="${attr(url)}" alt="${attr(creativeName(c.creativeName||creative?.name,c.type))}">` : ""}${esc(c.text || c.message || "Mensagem será preparada no momento da programação.").replace(/\n/g,"<br>")}<div class="message-time">10:00 ✓✓</div></div></div><div class="phone-caption">Prévia da mensagem</div></div><div class="callout mt-14"><strong>Motivo:</strong> ${esc(displayReason(c.reason || "Regras da campanha e proteções de contato aplicadas"))}</div>${deliveryExplanation(c)}</div></section>`;
  }

  function renderStudents() {
    const students = state.data.students || [], selected = students.find(s=>s.id===state.selectedStudent); const search = (state.filters.studentSearch||"").toLowerCase(),kind=state.filters.studentKind||""; const filtered = students.filter(s=>(!kind||s.kind===kind)&&`${s.name} ${s.unit} ${s.payerName}`.toLowerCase().includes(search));
    const detail = selected ? studentDetail(selected) : "";
    return `${pageHead("Alunos e financeiro", "Aluno, pagador e obrigação são papéis distintos. A tela deixa explícito quem treina, quem recebe e quem paga.")}
      ${relationshipCards(students)}
      <div class="filters"><div class="field"><label>Buscar por aluno, unidade ou pagador</label><input class="input" id="student-search" value="${attr(state.filters.studentSearch||"")}" placeholder="Digite para filtrar"></div><div class="field compact"><label>Vínculo</label><select class="select" id="student-kind"><option value="">Todos</option><option value="individual" ${kind==="individual"?"selected":""}>Individual</option><option value="family" ${kind==="family"?"selected":""}>Família</option><option value="corporate" ${kind==="corporate"?"selected":""}>Corporativo</option></select></div><button class="btn" data-action="filter-students">Filtrar</button></div>
      ${detail}<section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Aluno</th><th>Plano/vínculo</th><th>Quem paga</th><th>Última presença</th><th>Situação e próximas ações</th><th></th></tr></thead><tbody>${filtered.map(s=>`<tr><td class="main-cell">${esc(s.name)}<span class="sub">${esc(s.unit)}</span></td><td>${esc(businessLabel(s.plan,"Plano cadastrado"))}<span class="sub">${esc(businessLabel(s.kind,"Vínculo cadastrado"))}</span></td><td>${studentPaymentSummary(s)}</td><td>${shortDate(s.lastAttendance)}</td><td>${studentSituation(s,true)}</td><td><button class="btn small" data-action="student-detail" data-id="${attr(s.id)}">Abrir ficha</button></td></tr>`).join("")}</tbody></table></div></section>`;
  }
  function currentObligations(student) {
    const all=(state.data.obligations||[]).filter(o=>(o.studentIds||[]).includes(student.id));
    const period=all.reduce((latest,o)=>String(o.period||"")>latest?String(o.period):latest,"");
    return all.filter(o=>String(o.period||"")===period);
  }
  function studentPaymentSummary(student) {
    const obs=currentObligations(student), payers=state.data.payers||[];
    if(student.kind==="corporate") {
      const companyRows=obs.filter(o=>payers.find(p=>p.id===o.payerId)?.kind==="company"), personRows=obs.filter(o=>payers.find(p=>p.id===o.payerId)?.kind!=="company");
      const company=companyRows[0], companyAmount=companyRows.reduce((n,o)=>n+(o.amountCents||0),0), personAmount=personRows.reduce((n,o)=>n+(o.amountCents||0),0);
      return `<span class="payment-line"><strong>Empresa:</strong> ${esc(company?.payerName||"Não informada")} · ${money(companyAmount)}</span><span class="sub">${personAmount?`Aluno: ${esc(student.name)} · ${money(personAmount)}`:"Sem adicional particular"}</span>`;
    }
    const amount=obs.reduce((n,o)=>n+(o.amountCents||0),0), prefix=student.kind==="family"?"Titular":"Aluno";
    return `<span class="payment-line"><strong>${prefix}:</strong> ${esc(student.payerName||student.name)} · ${money(amount)}</span>${student.kind==="family"?`<span class="sub">Planos da família reunidos em uma cobrança</span>`:""}`;
  }
  function studentSituation(student, compact=false) {
    const obligations=(state.data.obligations||[]).filter(o=>(o.studentIds||[]).includes(student.id));
    const paymentLines=rows=>{
      const disputed=rows.filter(o=>o.status==="disputed"&&o.balanceCents>0), late=rows.filter(o=>o.balanceCents>0&&o.dueDate<today()&&o.status!=="disputed"), future=rows.filter(o=>o.balanceCents>0&&o.dueDate>=today()&&o.status!=="disputed");
      if(disputed.length)return {tone:"warning",text:`Cobrança em conferência · ${money(disputed.reduce((sum,o)=>sum+o.balanceCents,0))}`};
      if(late.length)return {tone:"danger",text:`Vencida · ${money(late.reduce((sum,o)=>sum+o.balanceCents,0))}`,date:late.map(o=>o.dueDate).sort()[0]};
      if(future.length)return {tone:"warning",text:`A vencer · ${money(future.reduce((sum,o)=>sum+o.balanceCents,0))}`,date:future.map(o=>o.dueDate).sort()[0]};
      return {tone:"",text:rows.length?"Em dia":"Sem cobrança emitida"};
    };
    const payers=state.data.payers||[];
    let lines;
    if(student.kind==="corporate"){
      const companyRows=obligations.filter(o=>payers.find(p=>p.id===o.payerId)?.kind==="company"), ownRows=obligations.filter(o=>payers.find(p=>p.id===o.payerId)?.kind!=="company");
      lines=[{label:"Empresa — base Prata",payer:companyRows[0]?.payerName,...paymentLines(companyRows)},{label:"Aluno — adicional Ouro",payer:student.name,...(ownRows.length?paymentLines(ownRows):{tone:"",text:"Sem adicional contratado"})}];
    }else lines=[{label:student.kind==="family"?"Cobrança da família":"Mensalidade",payer:student.payerName,...paymentLines(obligations)}];
    const actions=(state.data.communications||[]).filter(c=>c.status==="scheduled"&&(c.studentIds||[]).includes(student.id)).sort((a,b)=>String(a.scheduledAt||a.date).localeCompare(String(b.scheduledAt||b.date)));
    const contract=student.status==="active"?"Contrato ativo":student.status==="paused"?"Contrato pausado":"Contrato cancelado";
    const types={collection:"Regularização",reminder:"Lembrete de mensalidade",return:"Retomada dos treinos",offer:"Convite para o Ouro"};
    return `<div class="student-situation ${compact?"compact":""}">${statusPill(student.status,contract)}${lines.map(l=>`<div class="situation-payment ${l.tone}"><strong>${esc(l.label)}: ${esc(l.text)}</strong>${!compact?`<span class="sub">Responsável: ${esc(l.payer||"Não informado")}${l.date?` · vencimento ${shortDate(l.date)}`:""}</span>`:""}</div>`).join("")}<div class="situation-actions"><strong>${actions.length?`${actions.length} ${actions.length===1?"ação programada":"ações programadas"}`:"Nenhuma mensagem programada"}</strong>${actions.map(c=>`<a class="scheduled-action-link sub" href="#history?campaign=${attr(encodeURIComponent(c.campaignId))}&communication=${attr(encodeURIComponent(c.id))}">${esc(types[c.type]||"Mensagem")}${compact?"":` para ${esc((state.data.contacts||[]).find(x=>x.id===c.contactId)?.name||c.recipientName)}`} · ${esc(dateTime(c.scheduledAt||c.date))} →</a>`).join("")}</div></div>`;
  }
  function relationshipCards(students) {
    const preferred={individual:"stu-ana",family:"stu-carlos",corporate:"stu-edu"};
    const descriptions={individual:"O aluno paga o próprio plano.",family:"O titular paga os planos da família.",corporate:"A empresa paga o Prata; o aluno paga somente o adicional contratado."};
    return `<div class="relationship-grid">${["individual","family","corporate"].map(kind=>{
      const group=students.filter(s=>s.kind===kind), example=group.find(s=>s.id===preferred[kind])||group[0];
      if(!example)return "";
      const obs=currentObligations(example), total=obs.reduce((sum,o)=>sum+(o.amountCents||0),0), items=obs.flatMap(o=>o.items||[]);
      let detail=`${example.name} · ${businessLabel(example.plan,"Plano cadastrado")} · ${money(total)}`;
      if(kind==="family") detail=`${example.payerName} · ${items.map(i=>`${businessLabel(students.find(s=>s.id===i.studentId)?.plan,"Plano")} ${money(i.amountCents)}`).join(" + ")||money(total)}`;
      if(kind==="corporate") { const company=obs.filter(o=>(state.data.payers||[]).find(p=>p.id===o.payerId)?.kind==="company").reduce((n,o)=>n+(o.amountCents||0),0),person=total-company; detail=`${example.name} · Empresa ${money(company)} / Aluno ${money(person)}`; }
      return `<article class="relationship-card"><div><span class="pill blue">${group.length} ${group.length===1?"aluno":"alunos"}</span><h3>${businessLabel(kind)}</h3><p>${descriptions[kind]}</p><strong>${esc(detail)}</strong></div><button class="btn small" data-action="student-detail" data-id="${attr(example.id)}">Abrir exemplo</button></article>`;
    }).join("")}</div>`;
  }
  function studentAttendance(s) {
    const day=today(), dates=unique((s.attendance||[]).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=day)).sort((a,b)=>b.localeCompare(a));
    const daysAgo=d=>Math.floor((Date.parse(`${day}T12:00:00Z`)-Date.parse(`${d}T12:00:00Z`))/86400000);
    const recent=dates.filter(d=>daysAgo(d)<30), last=dates[0];
    const ago=d=>daysAgo(d)===0?"Hoje":daysAgo(d)===1?"Há 1 dia":`Há ${daysAgo(d)} dias`;
    const frequency=(s.tags||[]).includes("frequent")?"Treina com frequência":(s.tags||[]).includes("absent")?"Pode receber ajuda para retomar":dates.length?"Rotina em acompanhamento":"Ainda sem treino registrado";
    return `<section class="attendance-panel"><div class="card-head"><div><h3>Treinos de ${esc(s.name)}</h3><p>Presenças individuais; não são os treinos dos outros membros da família.</p></div><button class="btn small" data-action="student-attendance" data-id="${attr(s.id)}">Registrar presença</button></div><div class="card-body"><div class="role-grid"><div><span>Último treino</span><strong>${last?shortDate(last):"Nenhum registrado"}</strong><p>${last?ago(last):"A primeira presença aparecerá aqui."}</p></div><div><span>Dias de treino nos últimos 30 dias</span><strong>${recent.length}</strong><p>Várias entradas no mesmo dia contam como um dia de treino.</p></div><div><span>Acompanhamento da rotina</span><strong>${frequency}</strong><p>${s.presenceSourceUpdatedAt?`Presenças atualizadas em ${shortDate(s.presenceSourceUpdatedAt)}.`:"Atualização da fonte não informada."}</p></div></div><div class="section-title">${dates.length>10?"Últimas 10 presenças registradas":"Presenças registradas"}</div>${dates.length?`<div class="table-wrap"><table class="table attendance-table"><thead><tr><th>Quem treinou</th><th>Data do treino</th><th>Quando</th></tr></thead><tbody>${dates.slice(0,10).map(d=>`<tr><td>${esc(s.name)}</td><td>${shortDate(d)}</td><td>${ago(d)}</td></tr>`).join("")}</tbody></table></div>`:empty("Nenhuma presença registrada","O cadastro não informa um treino anterior para este aluno.")}</div></section>`;
  }
  function studentDetail(s) {
    const allObs=(state.data.obligations||[]).filter(o=>(o.studentIds||[]).includes(s.id)), obs=currentObligations(s), comms=(state.data.communications||[]).filter(c=>(c.studentIds||[]).includes(s.id));
    const payerRows=obs.map(o=>{const payer=(state.data.payers||[]).find(p=>p.id===o.payerId),contact=(state.data.contacts||[]).find(c=>c.id===payer?.contactId);return {...o,payer,contact};});
    const total=obs.reduce((n,o)=>n+(o.amountCents||0),0), balance=obs.reduce((n,o)=>n+(o.balanceCents||0),0);
    const personalAmount=obs.flatMap(o=>o.items||[]).filter(item=>item.studentId===s.id).reduce((sum,item)=>sum+(item.amountCents||0),0);
    const whoPays=payerRows.map(o=>`${o.payer?.kind==="company"?"Empresa":"Pessoa"}: ${o.payerName} (${money(o.amountCents)})`).join(" · ")||"Sem cobrança no ciclo atual";
    const whoReceives=unique(payerRows.map(o=>`${o.contact?.name||o.payerName}${o.contact?.phone?` · ${o.contact.phone}`:""}`)).join(" · ")||"Sem contato financeiro definido";
    return `<section class="card detail-panel mb-18"><div class="card-head"><div><h3>${esc(s.name)}</h3><p>${esc(s.unit)} · vínculo ${esc(businessLabel(s.kind,"cadastrado"))}</p></div><button class="btn small" data-action="close-student">Fechar</button></div><div class="card-body"><div class="role-grid"><div><span>Quem treina</span><strong>${esc(s.name)}</strong><p>${esc(businessLabel(s.plan,"Plano cadastrado"))} · ${esc(businessLabel(s.status))}</p></div><div><span>Quem paga</span><strong>${esc(whoPays)}</strong><p>${s.kind==="family"?"O titular paga o total familiar, que inclui este plano.":"Responsável pelo valor contratado."}</p></div><div><span>Quem recebe a cobrança</span><strong>${esc(whoReceives)}</strong><p>${s.isMinor?"O contato é o titular responsável, não o dependente.":"Contato financeiro definido no contrato."}</p></div></div><section class="student-current-state"><h3>Situação de ${esc(s.name)}</h3>${studentSituation(s)}</section>${studentAttendance(s)}<div class="section-title">${s.kind==="family"?"Cobrança da família":"Cobrança do plano"}</div>${s.kind==="family"?`<div class="callout mb-16">O plano de ${esc(s.name)} corresponde a ${money(personalAmount)}. O total de ${money(total)} reúne os planos da família e é cobrado somente de ${esc(s.payerName)}.</div>`:""}<div class="contract-total"><div><span>${s.kind==="family"?"Total dos planos da família":s.kind==="corporate"?"Total do plano, dividido entre empresa e aluno":"Valor do plano neste ciclo"}</span><strong>${money(total)}</strong></div><div><span>${s.kind==="family"?"Saldo da cobrança familiar":"Saldo em aberto"}</span><strong>${money(balance)}</strong></div></div><div class="section-title">Partes do contrato no ciclo atual</div><div class="table-wrap"><table class="table"><thead><tr><th>Quem treina</th><th>Quem paga</th><th>Plano / componente</th><th>Valor</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>${payerRows.flatMap(o=>(o.items||[{component:"base",amountCents:o.amountCents}]).map(item=>`<tr class="${item.studentId===s.id?"student-plan-row":""}"><td class="main-cell">${esc((state.data.students||[]).find(x=>x.id===item.studentId)?.name||s.name)}${item.studentId===s.id?`<span class="sub">Ficha aberta</span>`:""}</td><td class="main-cell">${esc(o.payerName)}<span class="sub">${o.payer?.kind==="company"?"Empresa":"Pessoa responsável"}</span></td><td>${esc(item.component==="corporate-base"?"Plano Prata da empresa":item.component==="gold-additional"?"Adicional Ouro do aluno":businessLabel((state.data.students||[]).find(x=>x.id===item.studentId)?.plan,"Plano contratado"))}</td><td>${money(item.amountCents)}</td><td class="money">${money(o.amountCents?Math.round((item.amountCents||0)*(o.balanceCents||0)/o.amountCents):0)}</td><td>${statusPill(o.status)}</td></tr>`)).join("")||`<tr><td colspan="6">Sem cobrança vinculada ao ciclo atual.</td></tr>`}</tbody></table></div><div class="section-title">Como as campanhas consideram este aluno</div><div class="criteria">${(s.tags||[]).map(id=>`<span class="criteria-chip" title="${attr(displayReason(s.reasons?.[id]||"Regra do público atendida"))}">${esc(audienceLabel(id))}</span>`).join("") || "Nenhum público calculado"}</div><p class="copy-muted">${comms.length} comunicação(ões) registrada(s) para este aluno. ${allObs.length} cobrança(s) preservada(s) no histórico.</p></div></section>`;
  }

  function renderHistory() {
    const selected=(state.data.communications||[]).find(c=>c.id===state.selectedCommunication);
    const end=state.filters.historyTo||today(), startDate=new Date(`${end}T12:00:00`);startDate.setMonth(startDate.getMonth()-2);const start=state.filters.historyFrom||state.data.demoHistory?.range?.from||startDate.toISOString().slice(0,10);
    const campaign=campaignById(state.filters.historyCampaign);
    const rows = (state.data.communications||[]).filter(c=>(c.date||"")>=start&&(c.date||"")<=end&&(!campaign||c.campaignId===campaign.id)).slice().sort((a,b)=>String(b.scheduledAt||b.date).localeCompare(String(a.scheduledAt||a.date)));
    return `${pageHead(campaign?`Mensagens: ${campaign.name}`:"Histórico de comunicações", "Veja quem recebeu, a mensagem usada e o resultado registrado.", `${campaign?`<a class="btn" href="/#history">Ver todas as campanhas</a>`:""}<a class="btn" href="/api/export.csv" download>↓ Exportar CSV</a>`)}
      <div class="filters"><div class="field compact"><label>De</label><input class="input" id="history-from" type="date" value="${attr(start)}"></div><div class="field compact"><label>Até</label><input class="input" id="history-to" type="date" value="${attr(end)}"></div><div class="field"><label>Campanha</label><select class="select" id="history-campaign"><option value="">Todas as campanhas</option>${(state.data.campaigns||[]).map(c=>`<option value="${attr(c.id)}" ${state.filters.historyCampaign===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div><button class="btn dark" data-action="filter-history">Aplicar período</button><span class="copy-muted">${rows.length} comunicação(ões) no período</span></div>
      <div id="history-detail">${selected?historyDetail(selected):""}</div><section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Destinatário</th><th>Campanha</th><th>Grupo e mensagem</th><th>O que aconteceu</th><th>Detalhes</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${dateTime(c.scheduledAt||c.date)}</td><td class="main-cell">${esc(c.recipientName)}<span class="sub">${esc(c.phone||"telefone protegido")}</span></td><td>${esc(c.campaignName)}</td><td>${esc(businessLabel(c.group||c.recipientGroup||c.criteriaSnapshot?.group,"Grupo padrão"))}<span class="sub">mensagem ${esc(c.variant||"A")}</span></td><td>${statusPill(c.status)}<span class="sub">${esc(communicationOutcome(c))}</span></td><td><button class="btn small" data-action="history-detail" data-id="${attr(c.id)}">Ver registro</button></td></tr>`).join("") || `<tr><td colspan="6">${empty("Histórico vazio", "Programe as primeiras mensagens na operação de hoje.")}</td></tr>`}</tbody></table></div></section>`;
  }
  function historyDetail(c) {
    const finalDone = ["accepted","delivered","responded","converted"].includes(c.status);
    const currentCreative=(state.data.creatives||[]).find(x=>x.id===c.creativeId), creativeUrl=safeUrl(c.creativeUrl||currentCreative?.url||"");
    const snapshot=c.criteriaSnapshot||{}, group=c.group||snapshot.group, members=snapshot.members||[];
    const rules=[...(snapshot.include||[]),...(snapshot.require||[])].map(audienceLabel), exclusions=(snapshot.exclude||[]).map(audienceLabel);
    const why=members.flatMap(member=>Object.values(member.reasons||{})).filter(Boolean).map(displayReason);
    const imageName=creativeName(c.creativeName||currentCreative?.name,c.type);
    return `<section class="card detail-panel mt-16"><div class="card-head"><div><h3>${esc(c.campaignName)} · ${esc(c.recipientName)}</h3><p>${dateTime(c.scheduledAt||c.date)}</p></div>${statusPill(c.status)}</div><div class="card-body"><div class="pipeline"><div class="pipe-step done"><i>1</i><span>Pessoa selecionada</span></div><div class="pipe-step done"><i>2</i><span>Mensagem definida</span></div><div class="pipe-step done"><i>3</i><span>Programada</span></div><div class="pipe-step ${finalDone?"done":c.status==="failed"?"warn":""}"><i>4</i><span>${finalDone?"Entrega registrada":"Resultado"}</span></div><div class="pipe-step ${c.status==="converted"?"done":""}"><i>5</i><span>Objetivo</span></div></div><div class="grid-even mt-22"><div><div class="section-title">Mensagem e imagem da comunicação</div>${creativeUrl?`<img class="creative-thumb" src="${attr(creativeUrl)}" alt="${attr(imageName)}">`:""}<div class="callout">${esc(c.text||"Sem texto registrado").replace(/\n/g,"<br>")}</div><p class="copy-muted mt-12"><strong>Imagem:</strong> ${esc(creativeUrl?imageName:"Sem imagem")}</p></div><div><div class="section-title">Por que esta pessoa foi selecionada</div><div class="member"><div><strong>Destinatário</strong><p>${esc(c.recipientName)}</p></div></div><div class="member"><div><strong>Grupo</strong><p>${esc(businessLabel(group,"Grupo padrão"))}</p></div><span class="pill blue">Mensagem ${esc(c.variant||"A")}</span></div><div class="member"><div><strong>Regra</strong><p>${esc(rules.join(" · ")||`Pessoa incluída na campanha de ${c.campaignName}`)}${exclusions.length?` · Exclui: ${esc(exclusions.join(" · "))}`:""}</p></div></div><div class="member"><div><strong>Motivo</strong><p>${esc(why.join(" · ")||`Pessoa incluída na campanha de ${c.campaignName}`)}</p></div></div><div class="member"><div><strong>Responsável</strong><p>${esc(snapshot.responsible?.recipientName||c.recipientName)}</p></div></div><div class="callout mt-14"><strong>O que aconteceu:</strong> ${esc(communicationOutcome(c))}</div></div></div>${deliveryExplanation(c)}</div></section>`;
  }

  function renderOffers() {
    const offers = state.data.offers || [], students=state.data.students||[], payers=state.data.payers||[];
    return `${pageHead("Ofertas de experimentação Ouro", "Um ciclo sem o adicional de R$ 100. O plano Prata continua pago e o silêncio nunca autoriza cobrança.")}
      <div class="callout warning mb-16"><strong>Regra comercial:</strong> início no próximo ciclo após aceite, validade de 14 dias, uma concessão por aluno e continuidade paga somente com confirmação explícita do responsável financeiro.</div>
      <div class="grid-3">${offers.map(o=>{const student=students.find(s=>s.id===o.studentId), payer=payers.find(p=>p.id===(o.payerId||student?.payerId)), authorizer=payer?.name||student?.payerName||o.studentName, futurePayer=student?.kind==="corporate"?student.name:authorizer;return `<article class="entity-card offer-card"><div class="entity-top"><div><h3>${esc(o.studentName)}</h3><p>Validade até ${shortDate(o.expiresAt)}</p></div>${statusPill(o.status,o.status==="active"?"Benefício ativo":businessLabel(o.status))}</div><div class="offer-price">R$ 0 <small>adicional no primeiro ciclo</small></div><p>O Prata de R$ 200 segue vigente. Depois, retorna ao Prata salvo confirmação de continuidade Ouro por R$ 300.</p><div class="offer-responsibility"><span>Quem autoriza</span><strong>${esc(authorizer)}</strong><span>Quem paga depois</span><strong>${esc(futurePayer)} · adicional de R$ 100</strong></div><div class="entity-meta">${["offered","pending","invited"].includes(o.status) ? `<button class="btn primary small" data-action="accept-offer" data-id="${attr(o.id)}" data-payer="${attr(o.payerId||student?.payerId||"")}">Registrar aceite de ${esc(authorizer)}</button>` : ""}${["trial","accepted","active"].includes(o.status) ? `<button class="btn dark small" data-action="continue-offer" data-id="${attr(o.id)}" data-payer="${attr(o.payerId||o.acceptedBy||student?.payerId||"")}">Confirmar Ouro pago</button>` : ""}<span class="sub">${o.acceptedBy ? "Aceite financeiro registrado" : "Aguardando autorização financeira"}</span></div></article>`}).join("") || empty("Nenhuma oferta criada", "Ative a campanha Ouro e programe os elegíveis.")}</div>`;
  }

  function renderCreatives() {
    const campaigns=state.data.campaigns||[], creatives = (state.data.creatives || []).filter(c=>c.approved).slice(0,4);
    return `${pageHead("Artes das campanhas", "Uma arte aprovada para cada objetivo. A mensagem continua completa mesmo sem a imagem.")}
      <div class="creative-grid">${creatives.map(c=>{const linked=campaigns.find(x=>x.creativeId===c.id);return `<article class="entity-card"><img class="creative-thumb" src="${attr(safeUrl(c.url))}" alt="${attr(c.name)}"><div class="entity-top"><div><h3>${esc(c.name)}</h3><p>${esc(linked?`Vinculada a ${linked.name}`:"Disponível para vincular")}</p></div>${statusPill("active","Aprovada")}</div></article>`}).join("")||empty("Artes ainda não disponíveis","As quatro artes locais aparecerão aqui.")}</div>`;
  }
  function creativeForm() { return `<section class="card mb-18"><div class="card-head"><div><h3>Adicionar arte</h3><p>Use uma arte local pronta ou envie uma imagem. Nenhum dado pessoal deve aparecer.</p></div><button class="btn small" data-action="close-creative-form">Fechar</button></div><form id="creative-form-fields" class="card-body"><div class="grid-even"><div class="field"><label>Nome interno</label><input class="input" required name="name" placeholder="Ex.: Ouro · outubro"></div><div class="field"><label>Arquivo de imagem</label><input class="input" type="file" name="file" accept="image/png,image/jpeg,image/webp"></div></div><div class="field mt-12"><label>Ou URL local</label><select class="select" name="url"><option value="">Usar arquivo enviado</option><option value="/creative/reminder.svg">Cartão · lembrete</option><option value="/creative/collection.svg">Cartão · regularização</option><option value="/creative/return.svg">Cartão · retomada</option><option value="/creative/offer.svg">Cartão · Ouro</option></select></div><label class="check mt-12"><input type="checkbox" name="approved" checked><span>Aprovar para uso nas campanhas</span></label><button class="btn primary mt-14" type="submit">Salvar criativo</button></form></section>`; }

  function renderMetrics() {
    return window.SnaqFitResults.render(state.data);
  }

  function renderSimulation(compact = false) {
    const obligations = state.data.obligations||[], students=state.data.students||[], communications=state.data.communications||[];
    return `${compact ? "" : pageHead("Registrar evento", "Informe um pagamento, uma presença ou uma resposta recebida para atualizar a operação.")}
      <div class="callout mb-18">Escolha somente um fato que já aconteceu. O sistema recalcula os próximos contatos depois do registro.</div>
      <div class="grid-3">
        ${simForm("Registrar pagamento", "payment", `<div class="field"><label>Obrigação</label><select class="select" name="obligationId">${obligations.filter(o=>o.balanceCents>0).map(o=>`<option value="${attr(o.id)}">${esc(o.payerName)} · ${esc(o.period)} · saldo ${money(o.balanceCents)}</option>`).join("")}</select></div><div class="field"><label>Valor pago (R$)</label><input class="input" name="amount" type="number" min="0.01" step="0.01" required></div>`, "Pagamento integral cancela cobrança futura; parcial atualiza o saldo.")}
        ${simForm("Registrar presença", "attendance", `<div class="field"><label>Aluno</label><select class="select" name="studentId">${students.map(s=>`<option value="${attr(s.id)}">${esc(s.name)}</option>`).join("")}</select></div>`, "Presença encerra episódio de ausência e reavalia retomadas.")}
        ${simForm("Registrar resposta", "response", `<div class="field"><label>Comunicação</label><select class="select" name="communicationId">${communications.map(c=>`<option value="${attr(c.id)}">${esc(c.recipientName)} · ${esc(c.campaignName)}</option>`).join("")}</select></div><div class="field"><label>Resposta</label><select class="select" name="kind"><option value="paid_claim">Já paguei</option><option value="dispute">Contestação</option><option value="optout">Não quero receber</option><option value="reply">Outra resposta</option></select></div>`, "“Já paguei” e contestação pausam o contato e criam conferência.")}
      </div>`;
  }
  function simForm(title, type, fields, note) { return `<section class="card"><div class="card-head"><div><h3>${esc(title)}</h3><p>${esc(note)}</p></div></div><form class="card-body event-form" data-event="${attr(type)}">${fields}<button class="btn primary mt-13" type="submit">Registrar evento</button></form></section>`; }

  async function refreshPreview(force = false) {
    const date=$("#preview-date")?.value||state.filters.previewDate||today(), campaignEl=$("#preview-campaign"), campaignId=campaignEl?(campaignEl.value||undefined):(state.filters.previewCampaign||undefined);
    if(!force&&state.preview?.date===date&&state.filters.previewCampaign===(campaignId||undefined))return;
    state.filters.previewDate=date;state.filters.previewCampaign=campaignId;state.filters.previewIndex=0;state.loadingPreview=true;
    const seq=++state.previewSeq;if(state.route==="schedule")render();
    try{const result=await request("/api/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date,campaignId})});if(seq!==state.previewSeq)return;state.preview=result;}
    catch(error){if(seq===state.previewSeq){state.preview=null;toast(error.message,"error");}}
    finally{if(seq===state.previewSeq){state.loadingPreview=false;if(state.route==="schedule")render();}}
  }
  async function scheduleAndExecute() {
    const date=state.filters.previewDate||state.preview?.date||today(), campaignId=state.filters.previewCampaign||(state.filters.todayType?(state.data.campaigns||[]).find(c=>c.type===state.filters.todayType)?.id:undefined);
    try { await mutate("/api/schedule",{date,campaignId},"Lote programado"); await mutate("/api/execute",{date,campaignId,outcome:"delivered"},"Envio registrado"); }
    catch { /* toast handled */ }
  }
  async function fileDataUrl(file) { return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);}); }
  function openEventDrawer() {
    const drawer=$("#event-drawer");
    drawer.innerHTML=`<div class="drawer-head"><div><h2>Registrar evento</h2><p>Atualize o cenário com um fato que já aconteceu.</p></div><button class="drawer-close" data-action="close-simulation" aria-label="Fechar">×</button></div>${renderSimulation(true)}`;
    drawer.classList.add("open");drawer.setAttribute("aria-hidden","false");$("#drawer-scrim").classList.add("open");
  }
  function closeEventDrawer(){const drawer=$("#event-drawer");drawer.classList.remove("open");drawer.setAttribute("aria-hidden","true");$("#drawer-scrim").classList.remove("open");}

  document.addEventListener("click", async event => {
    const routeEl = event.target.closest("[data-route]"); if (routeEl) { state.route=routeEl.dataset.route;if(location.hash!==`#${state.route}`)location.hash=state.route;updateChrome();$("#sidebar").classList.remove("open");$("#scrim").classList.remove("open");if(state.route==="schedule")await refreshPreview(true);else render();return; }
    const a = event.target.closest("[data-action]"); if (!a) return; const action=a.dataset.action;
    if(action==="open-simulation") {openEventDrawer();return;}
    if(action==="close-simulation") {closeEventDrawer();return;}
    if(action==="new-campaign") $("#campaign-editor").innerHTML=campaignEditor();
    if(action==="edit-campaign") $("#campaign-editor").innerHTML=campaignEditor(campaignById(a.dataset.id));
    if(action==="close-editor") $("#campaign-editor").innerHTML="";
    if(action==="toggle-campaign") { const c=campaignById(a.dataset.id); await mutate("/api/campaigns",{...c,status:c.status==="active"?"paused":"active",approved:c.status==="active"?c.approved:true},c.status==="active"?"Campanha pausada":"Campanha aprovada e ativada"); }
    if(action==="preview-campaign") { state.filters.previewCampaign=a.dataset.id;state.filters.previewDate=today();state.route="schedule";location.hash="schedule";updateChrome();await refreshPreview(true); }
    if(action==="generate-preview") await refreshPreview(true);
    if(action==="filter-offer-today") {state.filters.todayType="offer";state.filters.previewIndex=0;render();}
    if(action==="clear-today-filter") {state.filters.todayType="";state.filters.previewIndex=0;render();}
    if(action==="select-preview") {state.filters.previewIndex=Number(a.dataset.index);render();}
    if(action==="schedule-preview") { const date=state.filters.previewDate||state.preview?.date||today(),campaignId=state.filters.previewCampaign||(state.filters.todayType?(state.data.campaigns||[]).find(c=>c.type===state.filters.todayType)?.id:undefined);await mutate("/api/schedule",{date,campaignId},"Comunicações programadas"); }
    if(action==="execute-mock") await scheduleAndExecute();
    if(action==="filter-students") {state.filters.studentSearch=$("#student-search").value;state.filters.studentKind=$("#student-kind").value;render();}
    if(action==="filter-history") {const from=$("#history-from").value,to=$("#history-to").value;if(!from||!to||from>to){toast("Escolha um período válido: a data inicial deve vir antes da final.","error");return;}state.filters.historyFrom=from;state.filters.historyTo=to;state.filters.historyCampaign=$("#history-campaign").value||null;location.hash=state.filters.historyCampaign?`history?campaign=${encodeURIComponent(state.filters.historyCampaign)}`:"history";render();}
    if(action==="student-detail") {state.selectedStudent=a.dataset.id;state.route="students";location.hash=`students?student=${encodeURIComponent(a.dataset.id)}`;updateChrome();render();$(".detail-panel")?.scrollIntoView({behavior:"smooth",block:"start"});}
    if(action==="close-student") {state.selectedStudent=null;location.hash="students";render();}
    if(action==="student-attendance") {openEventDrawer();const form=$(".event-form[data-event='attendance']",$("#event-drawer"));$("select[name='studentId']",form).value=a.dataset.id;form.scrollIntoView({behavior:"smooth",block:"start"});}
    if(action==="history-detail") { state.selectedCommunication=a.dataset.id;location.hash=`history?${state.filters.historyCampaign?`campaign=${encodeURIComponent(state.filters.historyCampaign)}&`:""}communication=${encodeURIComponent(a.dataset.id)}`;render();$("#history-detail")?.scrollIntoView({behavior:"smooth"});}
    if(action==="accept-offer") await mutate("/api/events",{type:"accept_offer",offerId:a.dataset.id,acceptedBy:a.dataset.payer},"Aceite financeiro registrado");
    if(action==="continue-offer") await mutate("/api/events",{type:"continuation",offerId:a.dataset.id,acceptedBy:a.dataset.payer},"Continuidade paga confirmada");
    if(action==="show-creative-form") $("#creative-form").innerHTML=creativeForm();
    if(action==="close-creative-form") $("#creative-form").innerHTML="";
    if(action==="toggle-creative") {const c=(state.data.creatives||[]).find(x=>x.id===a.dataset.id);await mutate("/api/creatives",{...c,approved:!c.approved},c.approved?"Aprovação retirada":"Criativo aprovado");}
    if(action==="generate-ai-image") {const campaignType=$("#ai-campaign-type")?.value;if(!campaignType||state.busy)return;state.busy=true;render();try{const result=await request("/api/images/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({campaignType,confirmed:true})});toast(result.cached?"Criativo recuperado do cache para revisão":"Fundo gerado e criativo salvo para revisão","success");await load();}catch(error){toast(`${error.message} As artes locais continuam disponíveis.`,"error");}finally{state.busy=false;if(state.route==="creatives")render();}}
  });
  document.addEventListener("click", event => { const a=event.target.closest("[data-audience]");if(a){state.selectedAudience=a.dataset.audience;render();} });
  document.addEventListener("change", event=>{
    if(event.target.id==="message-group"){$$("[data-group-panel]").forEach(panel=>panel.hidden=panel.dataset.groupPanel!==event.target.value);}
    if(event.target.id==="campaign-creative"){const preview=$("#editor-art-preview"), url=event.target.selectedOptions[0]?.dataset.url||"";if(url){preview.src=safeUrl(url);preview.hidden=false;}else{preview.removeAttribute("src");preview.hidden=true;}}
  });
  document.addEventListener("submit", async event => {
    event.preventDefault(); const form=event.target;
    if(form.id==="campaign-form") {const fd=new FormData(form), id=fd.get("id")||undefined, existing=campaignById(id)||{}, status=fd.get("status"), messageGroups={individual:{A:fd.get("individualA"),B:fd.get("individualB")},family:{A:fd.get("familyA"),B:fd.get("familyB")},corporate:{A:fd.get("corporateA"),B:fd.get("corporateB")}}, payload={id,name:fd.get("name"),type:fd.get("type"),status,approved:existing.approved??status!=="draft",template:messageGroups.individual.A,templateB:messageGroups.individual.B,abEnabled:fd.get("abEnabled")==="on",messageGroups,creativeId:fd.get("creativeId")||null,include:existing.include||[],require:existing.require||[],exclude:existing.exclude||[]};await mutate("/api/campaigns",payload,"Mensagens da campanha salvas");}
    if(form.id==="creative-form-fields") {const fd=new FormData(form);let url=fd.get("url");const file=fd.get("file");if(file?.size){const uploaded=await request("/api/upload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:file.name,dataUrl:await fileDataUrl(file)})});url=uploaded.url;}if(!url){toast("Selecione um arquivo ou arte local.","error");return;}await mutate("/api/creatives",{name:fd.get("name"),url,approved:fd.get("approved")==="on"},"Criativo salvo");}
    if(form.classList.contains("event-form")){const fd=new FormData(form),type=form.dataset.event;let payload={type};for(const [k,v] of fd.entries())payload[k]=v;if(type==="payment")payload.amountCents=Math.round(Number(payload.amount)*100),delete payload.amount;if(type==="accept_offer"){const option=form.querySelector("option:checked");payload.acceptedBy=option?.dataset.payer;}await mutate("/api/events",payload,"Evento registrado e cenário recalculado");closeEventDrawer();}
    if(form.id==="advance-form"){const fd=new FormData(form);await mutate("/api/advance",{date:fd.get("date")},"Data do cenário avançada");closeEventDrawer();}
  });
  window.addEventListener("hashchange",()=>{const selection=locationSelection();if(selection.route===state.route&&selection.student===state.selectedStudent&&selection.campaign===state.filters.historyCampaign&&selection.communication===state.selectedCommunication)return;state.route=selection.route;state.selectedStudent=selection.student;state.selectedCommunication=selection.communication;state.filters.historyCampaign=selection.campaign;updateChrome();if(state.route==="schedule")void refreshPreview(true);else render();});
  $("#menu-btn").addEventListener("click",()=>{$("#sidebar").classList.add("open");$("#scrim").classList.add("open");});
  $("#scrim").addEventListener("click",()=>{$("#sidebar").classList.remove("open");$("#scrim").classList.remove("open");});
  $("#drawer-scrim").addEventListener("click",closeEventDrawer);
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeEventDrawer();});
  load(true);
})();
