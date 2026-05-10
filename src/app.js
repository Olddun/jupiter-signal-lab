const API_BASE = "https://lite-api.jup.ag";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const els = {
  amount: document.querySelector("#amount"),
  health: document.querySelector("#health"),
  price: document.querySelector("#price"),
  query: document.querySelector("#query"),
  raw: document.querySelector("#raw"),
  route: document.querySelector("#route"),
  run: document.querySelector("#run"),
  signal: document.querySelector("#signal"),
  token: document.querySelector("#token")
};

function money(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/a";
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

function number(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/a";
  return num.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function metric(label, value, className = "") {
  return `<div class="metric"><span>${label}</span><strong class="${className}">${value}</strong></div>`;
}

async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${path}`);
  }
  return response.json();
}

function bestToken(results) {
  return [...results].sort((a, b) => {
    const verifiedDelta = Number(Boolean(b.isVerified)) - Number(Boolean(a.isVerified));
    if (verifiedDelta) return verifiedDelta;
    return Number(b.organicScore || 0) - Number(a.organicScore || 0);
  })[0];
}

function scoreSignals({ token, tokenPrice, quote, solPrice }) {
  const flags = [];
  let score = 100;

  if (!token.isVerified) {
    score -= 25;
    flags.push("Token is not verified.");
  }

  if (Number(token.organicScore || 0) < 70) {
    score -= 20;
    flags.push("Organic score is below 70.");
  }

  if (Number(token.liquidity || 0) < 100000) {
    score -= 20;
    flags.push("Liquidity is below $100k.");
  }

  const routeLabels = (quote.routePlan || []).map((hop) => hop.swapInfo?.label).filter(Boolean);
  if (routeLabels.length > 3) {
    score -= 10;
    flags.push("Route has more than three hops.");
  }

  const priceImpact = Number(quote.priceImpactPct || 0);
  if (priceImpact > 1) {
    score -= 15;
    flags.push("Price impact is above 1%.");
  }

  const inSol = Number(quote.inAmount) / 1e9;
  const outTokens = Number(quote.outAmount) / 10 ** Number(token.decimals || 0);
  const impliedUsd = outTokens * Number(tokenPrice?.usdPrice || 0);
  const inputUsd = inSol * Number(solPrice?.usdPrice || 0);
  const quoteDrift = inputUsd ? Math.abs(impliedUsd - inputUsd) / inputUsd : 0;
  if (quoteDrift > 0.03) {
    score -= 10;
    flags.push("Quote value differs from Price API by more than 3%.");
  }

  return {
    flags,
    label: score >= 80 ? "Clean" : score >= 55 ? "Caution" : "Risky",
    score: Math.max(0, score),
    routeLabels,
    quoteDrift
  };
}

function renderToken(token) {
  els.token.className = "stack";
  els.token.innerHTML = [
    `<span class="pill">${token.symbol || "UNKNOWN"}</span>`,
    metric("Name", token.name || "n/a"),
    metric("Mint", `${String(token.id).slice(0, 6)}...${String(token.id).slice(-6)}`),
    metric("Verified", token.isVerified ? "Yes" : "No", token.isVerified ? "good" : "warn"),
    metric("Organic score", number(token.organicScore || 0)),
    metric("Holders", number(token.holderCount || 0, 0)),
    metric("Liquidity", money(token.liquidity || 0, 0))
  ].join("");
}

function renderPrice(tokenPrice, solPrice) {
  els.price.className = "stack";
  els.price.innerHTML = [
    metric("Token USD", money(tokenPrice?.usdPrice)),
    metric("24h change", `${number(tokenPrice?.priceChange24h || 0)}%`, Number(tokenPrice?.priceChange24h || 0) >= 0 ? "good" : "bad"),
    metric("Token block", tokenPrice?.blockId || "n/a"),
    metric("SOL USD", money(solPrice?.usdPrice)),
    metric("SOL 24h", `${number(solPrice?.priceChange24h || 0)}%`, Number(solPrice?.priceChange24h || 0) >= 0 ? "good" : "bad")
  ].join("");
}

function renderRoute(quote, token) {
  const outTokens = Number(quote.outAmount) / 10 ** Number(token.decimals || 0);
  const labels = (quote.routePlan || []).map((hop) => hop.swapInfo?.label).filter(Boolean);
  els.route.className = "stack";
  els.route.innerHTML = [
    metric("Output", `${number(outTokens, 6)} ${token.symbol}`),
    metric("Impact", `${number(quote.priceImpactPct || 0, 4)}%`),
    metric("Hops", labels.length || 0),
    `<span class="pill">${labels.join(" -> ") || "direct"}</span>`
  ].join("");
}

function renderSignal(signal) {
  const tone = signal.score >= 80 ? "good" : signal.score >= 55 ? "warn" : "bad";
  els.signal.className = "stack";
  els.signal.innerHTML = [
    `<span class="pill ${tone}">${signal.label} / ${signal.score}</span>`,
    metric("Quote drift", `${number(signal.quoteDrift * 100, 2)}%`),
    signal.flags.length ? signal.flags.map((flag) => `<p class="muted">${flag}</p>`).join("") : "<p class=\"good\">No major pre-trade warnings found.</p>"
  ].join("");
}

async function analyze() {
  const query = els.query.value.trim() || "JUP";
  const solAmount = Math.max(0.01, Number(els.amount.value) || 0.1);
  const lamports = Math.round(solAmount * 1e9);

  els.health.textContent = "Fetching Jupiter APIs...";
  els.run.disabled = true;

  try {
    const tokens = await getJson(`/tokens/v2/search?query=${encodeURIComponent(query)}`);
    const token = bestToken(tokens);
    if (!token) throw new Error(`No token found for ${query}`);

    const ids = `${SOL_MINT},${token.id}`;
    const [prices, quote] = await Promise.all([
      getJson(`/price/v3?ids=${encodeURIComponent(ids)}`),
      getJson(`/swap/v1/quote?inputMint=${SOL_MINT}&outputMint=${token.id}&amount=${lamports}&slippageBps=50`)
    ]);

    const tokenPrice = prices[token.id];
    const solPrice = prices[SOL_MINT];
    const signal = scoreSignals({ token, tokenPrice, quote, solPrice });

    renderToken(token);
    renderPrice(tokenPrice, solPrice);
    renderRoute(quote, token);
    renderSignal(signal);
    els.raw.textContent = JSON.stringify({ token, tokenPrice, solPrice, quote, signal }, null, 2);
    els.health.textContent = `Loaded ${token.symbol} via keyless Jupiter endpoints`;
  } catch (error) {
    els.health.textContent = "Analysis failed";
    els.signal.className = "stack bad";
    els.signal.textContent = error.message;
  } finally {
    els.run.disabled = false;
  }
}

els.run.addEventListener("click", analyze);
els.query.addEventListener("keydown", (event) => {
  if (event.key === "Enter") analyze();
});

analyze();
