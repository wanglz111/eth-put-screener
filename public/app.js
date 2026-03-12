const marketEl = document.getElementById("market");
const recommendationsEl = document.getElementById("recommendations");
const statusEl = document.getElementById("status");
const reloadButton = document.getElementById("reload-button");

function percent(value) {
  if (value === null || value === undefined) {
    return "--";
  }

  return `${(value * 100).toFixed(2)}%`;
}

function number(value, digits = 2) {
  if (value === null || value === undefined) {
    return "--";
  }

  return Number(value).toFixed(digits);
}

function renderKeyValue(items) {
  return items
    .map(
      ([label, value]) =>
        `<div class="row"><span class="label">${label}</span><span class="value">${value}</span></div>`
    )
    .join("");
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || `Request failed for ${url}`);
  }

  return payload.data;
}

function renderMarket(data) {
  marketEl.innerHTML = renderKeyValue([
    ["Underlying", data.underlying],
    ["Spot", `$${number(data.spotPrice)}`],
    ["Market IV", percent(data.marketIv)],
    ["Risk-free", percent(data.riskFreeRate)],
    ["Captured", new Date(data.capturedAt).toLocaleString()]
  ]);
}

function renderStatus(data) {
  statusEl.innerHTML = renderKeyValue([
    ["Status", data.ok ? "OK" : "Failed"],
    ["Provider", data.provider],
    ["Started", new Date(data.startedAt).toLocaleString()],
    ["Finished", new Date(data.finishedAt).toLocaleString()],
    ["Message", data.message]
  ]);
}

function renderRecommendations(data) {
  if (!data.items.length) {
    recommendationsEl.innerHTML = `<p class="muted">No recommendations matched the current filter set.</p>`;
    return;
  }

  recommendationsEl.innerHTML = data.items
    .map(
      (item) => `
        <article class="card">
          <div class="card-head">
            <p class="rank">#${item.rank}</p>
            <p class="muted">${item.expiry} · ${item.instrumentName}</p>
          </div>
          ${renderKeyValue([
            ["Strike", `$${number(item.strike)}`],
            ["DTE", `${item.dte} days`],
            ["Premium", `$${number(item.premium)}`],
            ["Effective Buy", `$${number(item.effectiveBuyPrice)}`],
            ["Price Discount", percent(item.priceDiscount)],
            ["IV", percent(item.iv)],
            ["Delta", number(item.delta, 4)],
            ["Yield", percent(item.positionYield)],
            ["Annualized", percent(item.annualizedYield)],
            ["Score", number(item.score, 4)]
          ])}
        </article>
      `
    )
    .join("");
}

function renderError(element, message) {
  element.innerHTML = `<p class="error">${message}</p>`;
}

async function loadDashboard() {
  reloadButton.disabled = true;

  try {
    const [market, recommendations, status] = await Promise.all([
      fetchJson("/api/market/latest"),
      fetchJson("/api/recommendations?limit=3"),
      fetchJson("/api/status")
    ]);

    renderMarket(market);
    renderRecommendations(recommendations);
    renderStatus(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown dashboard error";
    renderError(marketEl, message);
    renderError(recommendationsEl, message);
    renderError(statusEl, message);
  } finally {
    reloadButton.disabled = false;
  }
}

reloadButton.addEventListener("click", () => {
  loadDashboard();
});

loadDashboard();

