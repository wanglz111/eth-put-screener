const tableBody = document.getElementById("options-table-body");
const filtersForm = document.getElementById("filters");
const resultsMeta = document.getElementById("results-meta");
const reloadButton = document.getElementById("reload-options-button");
const resetFiltersButton = document.getElementById("reset-filters");

let snapshot = [];
let generatedAt = null;

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

function getFilters() {
  const formData = new FormData(filtersForm);
  const readNumber = (key) => {
    const value = formData.get(key);
    if (typeof value !== "string" || value.trim() === "") {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    search: String(formData.get("search") || "").trim().toLowerCase(),
    minDte: readNumber("minDte"),
    maxDte: readNumber("maxDte"),
    minIv: readNumber("minIv"),
    minYield: readNumber("minYield"),
    minDelta: readNumber("minDelta"),
    maxDelta: readNumber("maxDelta"),
    strictOnly: String(formData.get("strictOnly") || "all"),
    sortBy: String(formData.get("sortBy") || "score_desc")
  };
}

function applyFilters(items) {
  const filters = getFilters();

  const filtered = items.filter((item) => {
    if (filters.search) {
      const haystack = `${item.instrumentName} ${item.expiry}`.toLowerCase();
      if (!haystack.includes(filters.search)) {
        return false;
      }
    }

    if (filters.minDte !== null && item.dte < filters.minDte) {
      return false;
    }

    if (filters.maxDte !== null && item.dte > filters.maxDte) {
      return false;
    }

    if (filters.minIv !== null && (item.iv ?? -1) < filters.minIv) {
      return false;
    }

    if (filters.minYield !== null && item.positionYield < filters.minYield) {
      return false;
    }

    if (filters.minDelta !== null && item.absDelta < filters.minDelta) {
      return false;
    }

    if (filters.maxDelta !== null && item.absDelta > filters.maxDelta) {
      return false;
    }

    if (filters.strictOnly === "strict" && !item.passesStrictFilters) {
      return false;
    }

    return true;
  });

  filtered.sort((left, right) => {
    switch (filters.sortBy) {
      case "yield_desc":
        return right.positionYield - left.positionYield;
      case "dte_asc":
        return left.dte - right.dte;
      case "strike_asc":
        return left.strike - right.strike;
      case "iv_desc":
        return (right.iv ?? -1) - (left.iv ?? -1);
      case "score_desc":
      default:
        return right.score - left.score;
    }
  });

  return filtered;
}

function renderRows(items) {
  if (!items.length) {
    tableBody.innerHTML = `
      <tr>
        <td class="muted" colspan="12">No options matched the current front-end filters.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = items
    .map(
      (item) => `
        <tr>
          <td>${item.instrumentName}</td>
          <td>${item.expiry}</td>
          <td>${item.dte}</td>
          <td>$${number(item.strike)}</td>
          <td>$${number(item.premium)}</td>
          <td>${percent(item.iv)}</td>
          <td>${number(item.delta, 4)}</td>
          <td>${number(item.absDelta, 4)}</td>
          <td>${percent(item.positionYield)}</td>
          <td>${percent(item.annualizedYield)}</td>
          <td>${number(item.score, 4)}</td>
          <td>${item.passesStrictFilters ? "Yes" : "No"}</td>
        </tr>
      `
    )
    .join("");
}

function renderTable() {
  const filtered = applyFilters(snapshot);
  renderRows(filtered);

  const strictCount = snapshot.filter((item) => item.passesStrictFilters).length;
  const generatedText = generatedAt ? new Date(generatedAt).toLocaleString() : "--";
  resultsMeta.textContent = `${filtered.length} shown / ${snapshot.length} total / ${strictCount} strict · generated ${generatedText}`;
}

async function loadOptions() {
  reloadButton.disabled = true;
  resultsMeta.textContent = "Loading options snapshot...";

  try {
    const payload = await fetchJson("/api/options");
    snapshot = payload.items;
    generatedAt = payload.generatedAt;
    renderTable();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown options page error";
    resultsMeta.textContent = message;
    tableBody.innerHTML = `
      <tr>
        <td class="error" colspan="12">${message}</td>
      </tr>
    `;
  } finally {
    reloadButton.disabled = false;
  }
}

filtersForm.addEventListener("input", () => {
  renderTable();
});

filtersForm.addEventListener("change", () => {
  renderTable();
});

resetFiltersButton.addEventListener("click", () => {
  filtersForm.reset();
  renderTable();
});

reloadButton.addEventListener("click", () => {
  loadOptions();
});

loadOptions();

