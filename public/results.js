(function () {
  "use strict";

  const html = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const plural = (value, singular, pluralForm) => `${value} ${value === 1 ? singular : pluralForm}`;
  const money = (cents) => (number(cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dateOnly = (value) => String(value ?? "").slice(0, 10);
  const date = (value) => {
    const day = dateOnly(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "—";
    return new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR");
  };

  const GROUPS = {
    individual: "Individual",
    family: "Família",
    corporate: "Corporativo",
  };
  const selectedGroups = new Map();
  let lastRenderedData = null;

  const CAMPAIGN_COPY = {
    reminder: {
      audience: "Pagadores com mensalidade próxima do vencimento",
      objective: "Ajudar o responsável a pagar em dia, antes de virar uma pendência.",
      result: (metric) => `${plural(number(metric.converted), "pagamento foi registrado", "pagamentos foram registrados")} até o vencimento`,
      outcome: (variant) => number(variant.converted),
      outcomeLabel: "pagamentos no prazo",
      action: (count) => count === 1 ? "pagou no prazo" : "pagaram no prazo",
    },
    collection: {
      audience: "Responsáveis com saldo vencido",
      objective: "Facilitar a regularização e abrir espaço para dúvidas ou divergências.",
      result: (metric) => `${plural(number(metric.converted), "pagamento foi registrado", "pagamentos foram registrados")} após a mensagem`,
      outcome: (variant) => number(variant.converted),
      outcomeLabel: "pagamentos registrados",
      action: (count) => count === 1 ? "regularizou o pagamento" : "regularizaram o pagamento",
    },
    return: {
      audience: "Alunos que se afastaram dos treinos",
      objective: "Convidar o aluno a retomar a rotina com uma abordagem acolhedora.",
      result: (metric) => `${plural(number(metric.converted), "aluno voltou", "alunos voltaram")} a treinar`,
      outcome: (variant) => number(variant.converted),
      outcomeLabel: "alunos que voltaram",
      action: (count) => count === 1 ? "voltou a treinar" : "voltaram a treinar",
    },
    offer: {
      audience: "Alunos Prata frequentes e com pagamentos em dia",
      objective: "Apresentar o Ouro por um ciclo e pedir confirmação antes de qualquer adicional.",
      result: (metric) => `${plural(number(metric.trialAcceptances), "aluno aceitou", "alunos aceitaram")} experimentar o Ouro`,
      outcome: (variant) => number(variant.trialAcceptances),
      outcomeLabel: "aceites para experimentar",
      action: (count) => count === 1 ? "aceitou experimentar o Ouro" : "aceitaram experimentar o Ouro",
    },
  };

  function campaignType(data, metric) {
    return (data.campaigns ?? []).find((campaign) => campaign.id === metric.campaignId)?.type ?? "unknown";
  }

  function period(data) {
    const dates = (data.communications ?? [])
      .map((communication) => dateOnly(communication.date || communication.scheduledAt))
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
      .sort();
    if (!dates.length) return "Nenhuma mensagem registrada";
    if (dates[0] === dates.at(-1)) return `Mensagens de ${date(dates[0])}`;
    return `Mensagens de ${date(dates[0])} a ${date(dates.at(-1))}`;
  }

  function paymentSummary(data) {
    const communicationIds = new Set((data.communications ?? []).map((item) => item.id));
    const seen = new Set();
    const attributions = [];
    for (const obligation of data.obligations ?? []) {
      for (const attribution of obligation.paymentAttributions ?? []) {
        if (!communicationIds.has(attribution.communicationId)) continue;
        const key = [obligation.id, attribution.communicationId, attribution.paidAt, attribution.amountCents].join(":");
        if (seen.has(key)) continue;
        seen.add(key);
        attributions.push(attribution);
      }
    }
    return {
      count: attributions.length,
      cents: attributions.reduce((sum, item) => sum + number(item.amountCents), 0),
    };
  }

  function summaryCards(data) {
    const payments = paymentSummary(data);
    const returnedStudents = new Set((data.communications ?? [])
      .filter((item) => item.type === "return" && (item.status === "converted" || item.convertedAt))
      .flatMap((item) => item.studentIds ?? [])).size;
    const acceptedOffers = (data.offers ?? []).filter((item) => ["accepted", "active", "continued", "completed"].includes(item.status)).length;
    const continuations = (data.offers ?? []).filter((item) => Boolean(item.continuation)).length;

    const cards = [
      ["Pagamentos registrados", money(payments.cents), `${plural(payments.count, "pagamento ligado", "pagamentos ligados")} às mensagens`],
      ["Alunos voltaram", returnedStudents, `${plural(returnedStudents, "presença registrada", "presenças registradas")} após a campanha de retomada`],
      ["Aceites do Ouro", acceptedOffers, `${plural(acceptedOffers, "experimentação aceita", "experimentações aceitas")} pelo responsável financeiro`],
      ["Continuidade confirmada", continuations, `${plural(continuations, "confirmação", "confirmações")} para seguir no Ouro após a experiência`],
    ];
    return `<div class="results-summary">${cards.map(([label, value, note]) => `
      <article class="results-summary-card">
        <span>${html(label)}</span>
        <strong>${html(value)}</strong>
        <p>${html(note)}</p>
      </article>`).join("")}</div>
      <p class="results-clarification">Continuidade confirmada indica a decisão do aluno ou responsável. O valor só vira receita quando o pagamento é registrado.</p>`;
  }

  function pipeline(data) {
    const communications = data.communications ?? [];
    const statuses = [
      { singular: "entrega registrada", plural: "entregas registradas", statuses: ["delivered", "responded", "converted"], tone: "good" },
      { singular: "aguarda envio", plural: "aguardam envio", statuses: ["scheduled"], tone: "plain" },
      { singular: "aceita para envio", plural: "aceitas para envio", statuses: ["accepted"], tone: "plain", help: "o provedor aceitou, mas ainda não confirmou a entrega" },
      { singular: "envio não concluído", plural: "envios não concluídos", statuses: ["failed"], tone: "attention" },
      { singular: "aguarda confirmação", plural: "aguardam confirmação", statuses: ["unknown"], tone: "attention" },
      { singular: "adiada", plural: "adiadas", statuses: ["deferred"], tone: "plain" },
      { singular: "cancelada", plural: "canceladas", statuses: ["cancelled"], tone: "plain" },
    ].map((item) => ({ ...item, count: communications.filter((communication) => item.statuses.includes(communication.status)).length }))
      .filter((item) => item.count > 0);

    return `<section class="results-section results-operation">
      <div class="results-section-head">
        <div><span class="results-kicker">Situação das mensagens</span><h3>${plural(communications.length, "mensagem registrada", "mensagens registradas")} no período</h3></div>
        <p>Cada mensagem aparece uma única vez abaixo.</p>
      </div>
      <div class="results-status-list">${statuses.map((item) => `
        <div class="results-status results-status-${item.tone}">
          <strong>${item.count}</strong><span>${html(item.count === 1 ? item.singular : item.plural)}</span>${item.help ? `<small>${html(item.help)}</small>` : ""}
        </div>`).join("") || '<p class="results-empty">Ainda não há mensagens para acompanhar.</p>'}</div>
    </section>`;
  }

  function campaignCard(data, metric) {
    const type = campaignType(data, metric);
    const copy = CAMPAIGN_COPY[type] ?? {
      audience: "Público definido na campanha",
      objective: "Acompanhar o resultado definido para esta campanha.",
      result: (item) => plural(number(item.converted), "resultado registrado", "resultados registrados"),
    };
    const delivered = number(metric.delivered);
    const responded = (data.communications ?? []).filter((item) => item.campaignId === metric.campaignId && (item.respondedAt || item.status === "responded")).length;
    const outcome = type === "offer" ? number(metric.trialAcceptances) : number(metric.converted);
    const waiting = number(metric.pending);
    const recovered = number(metric.recoveredCents);
    const resultSentence = delivered
      ? `De ${plural(delivered, "mensagem com entrega registrada", "mensagens com entrega registrada")}, ${copy.result(metric)}.`
      : "Ainda não há entrega registrada para medir o resultado.";

    return `<article class="results-campaign">
      <div class="results-campaign-title">
        <div><span class="results-kicker">${html(copy.audience)}</span><h3>${html(metric.name || "Campanha")}</h3></div>
        <a class="btn small" href="/#history?campaign=${encodeURIComponent(metric.campaignId)}">Ver mensagens da campanha</a>
      </div>
      <p class="results-objective"><strong>Objetivo:</strong> ${html(copy.objective)}</p>
      <p class="results-readout">${html(resultSentence)}</p>
      <div class="results-campaign-facts">
        <div><strong>${number(metric.scheduled)}</strong><span>${number(metric.scheduled) === 1 ? "mensagem" : "mensagens"} no período</span></div>
        <div><strong>${delivered}</strong><span>${delivered === 1 ? "entrega registrada" : "entregas registradas"}</span></div>
        <div><strong>${responded}</strong><span>${responded === 1 ? "resposta recebida" : "respostas recebidas"}</span></div>
        <div><strong>${outcome}</strong><span>${outcome === 1 ? "objetivo alcançado" : "objetivos alcançados"}</span></div>
      </div>
      <div class="results-evidence">
        ${recovered > 0 ? `<p><strong>${html(money(recovered))}</strong> em pagamentos ligados a esta campanha.</p>` : ""}
        ${type === "offer" ? `<p><strong>${number(metric.freeCycleUses)}</strong> usaram o ciclo de experiência e <strong>${number(metric.paidContinuations)}</strong> confirmaram a continuidade. Confirmação ainda não representa pagamento recebido.</p>` : ""}
        ${waiting > 0 ? `<p>${plural(waiting, "caso ainda está", "casos ainda estão")} dentro do prazo de observação.</p>` : ""}
        <p>O custo da campanha não foi informado; por isso, esta tela não calcula retorno financeiro.</p>
      </div>
      <div class="results-comparison-host" data-campaign-id="${html(metric.campaignId)}">${comparison(data, metric, type, copy)}</div>
    </article>`;
  }

  function comparison(data, metric, type, copy) {
    const pairs = Object.values((metric.variants ?? []).reduce((groups, variant) => {
      const group = variant.group ?? "individual";
      groups[group] ??= { group, A: null, B: null };
      groups[group][variant.variant] = variant;
      return groups;
    }, {})).filter((pair) => number(pair.A?.denominator) > 0 || number(pair.B?.denominator) > 0);
    if (!pairs.length) return "";
    const preferred = pairs.slice().sort((left, right) =>
      (number(right.A?.delivered) + number(right.B?.delivered)) - (number(left.A?.delivered) + number(left.B?.delivered)))[0].group;
    const stored = selectedGroups.get(metric.campaignId);
    const selectedGroup = pairs.some((pair) => pair.group === stored) ? stored : preferred;
    selectedGroups.set(metric.campaignId, selectedGroup);
    const pair = pairs.find((item) => item.group === selectedGroup);

    const actualResponses = (label) => (data.communications ?? []).filter((item) =>
      item.campaignId === metric.campaignId
      && (item.group ?? "individual") === selectedGroup
      && item.variant === label
      && (item.respondedAt || item.status === "responded")).length;

    const facts = (item) => {
      const delivered = number(item?.delivered);
      const outcome = item && copy.outcome ? copy.outcome(item) : number(item?.converted);
      return { delivered, outcome, rate: delivered ? Math.round(outcome / delivered * 100) : 0 };
    };
    const a = facts(pair.A);
    const b = facts(pair.B);
    const lead = !a.delivered || !b.delivered
      ? "Ainda faltam entregas das duas versões para comparar."
      : a.rate === b.rate
        ? `Mesmo resultado proporcional nesta amostra: ${a.rate}% para cada mensagem.`
        : `Mensagem ${a.rate > b.rate ? "A" : "B"} está à frente nesta amostra: ${Math.max(a.rate, b.rate)}% contra ${Math.min(a.rate, b.rate)}%.`;

    const variant = (item, label) => {
      if (!item || number(item.denominator) === 0) return `<div class="results-variant"><strong>Mensagem ${label}</strong><p>Ainda não foi usada neste grupo.</p></div>`;
      const delivered = number(item.delivered);
      const outcome = copy.outcome ? copy.outcome(item) : number(item.converted);
      const rate = delivered ? Math.round(outcome / delivered * 100) : 0;
      const people = delivered === 1 ? "pessoa" : "pessoas";
      return `<div class="results-variant">
        <span class="results-variant-label">Mensagem ${label}</span>
        <strong>${rate}%</strong>
        <progress max="100" value="${rate}" aria-label="Mensagem ${label}: ${rate}%"></progress>
        <p class="results-variant-result">${delivered ? `${outcome} de ${delivered} ${people} ${html(typeof copy.action === "function" ? copy.action(outcome) : "alcançaram o objetivo")} (${rate}%)` : "Nenhuma entrega confirmada até agora"}</p>
        <dl>
          <div><dt>Entregas registradas</dt><dd>${delivered}</dd></div>
          <div><dt>Respostas recebidas</dt><dd>${actualResponses(label)}</dd></div>
          ${number(item.recoveredCents) > 0 ? `<div><dt>Pagamentos ligados</dt><dd>${html(money(item.recoveredCents))}</dd></div>` : ""}
          ${type === "offer" ? `<div><dt>Continuaram no Ouro</dt><dd>${number(item.paidContinuations)}</dd></div>` : ""}
        </dl>
      </div>`;
    };

    return `<details class="results-comparison" open>
      <summary>Comparar A/B · ${html(GROUPS[selectedGroup] || "Grupo padrão")} · ${html(lead)}</summary>
      <div class="results-comparison-toolbar">
        <label>Tipo de vínculo
          <select class="select" data-results-group="${html(metric.campaignId)}">
            ${pairs.map((item) => `<option value="${html(item.group)}"${item.group === selectedGroup ? " selected" : ""}>${html(GROUPS[item.group] || "Grupo padrão")}</option>`).join("")}
          </select>
        </label>
      </div>
      <p class="results-ab-lead">${html(lead)}</p>
      <div class="results-variants">${variant(pair.A, "A")}${variant(pair.B, "B")}</div>
      <p class="results-comparison-note">A amostra deste grupo ainda é pequena. A diferença observada ajuda a formular uma hipótese, mas não prova que uma mensagem seja mais eficaz.</p>
    </details>`;
  }

  function render(data = {}) {
    lastRenderedData = data;
    const metrics = data.metrics ?? [];
    return `<div class="page-head results-page-head">
      <div><h2>Resultados</h2><p>Veja o que aconteceu depois das mensagens: pagamentos, retorno aos treinos e decisões sobre o plano Ouro.</p></div>
      <a class="btn" href="/api/export.csv" download>Baixar dados</a>
    </div>
    <div class="results-period"><div><span>Período analisado</span><strong>${html(period(data))}</strong></div><p>Data do cenário: ${html(date(data.clock))}</p></div>
    ${summaryCards(data)}
    ${pipeline(data)}
    <section class="results-campaigns">
      <div class="results-section-head"><div><span class="results-kicker">Resultado por objetivo</span><h3>O que cada campanha produziu</h3></div><p>Resultados ligados às mensagens dentro do prazo definido para cada campanha.</p></div>
      <div class="results-campaign-list">${metrics.map((metric) => campaignCard(data, metric)).join("") || '<p class="results-empty">Ainda não há resultados. Registre entregas e eventos para acompanhar as campanhas.</p>'}</div>
    </section>`;
  }

  document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-results-group]");
    if (!select || !lastRenderedData) return;
    const campaignId = select.dataset.resultsGroup;
    const metric = (lastRenderedData.metrics ?? []).find((item) => item.campaignId === campaignId);
    const host = document.querySelector(`.results-comparison-host[data-campaign-id="${CSS.escape(campaignId)}"]`);
    if (!metric || !host) return;
    selectedGroups.set(campaignId, select.value);
    const type = campaignType(lastRenderedData, metric);
    const copy = CAMPAIGN_COPY[type] ?? { action: "alcançaram o objetivo" };
    host.innerHTML = comparison(lastRenderedData, metric, type, copy);
  });

  window.SnaqFitResults = Object.freeze({ render });
}());
