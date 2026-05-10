import { execFileSync } from "node:child_process";

const API_BASE = "https://lite-api.jup.ag";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const DEFAULT_OUTPUT_MINT = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

async function getJson(path) {
  const url = `${API_BASE}${path}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${path}`);
    }
    return response.json();
  } catch (error) {
    const body = execFileSync("curl", ["-fsSL", url], { encoding: "utf8" });
    return JSON.parse(body);
  }
}

const outputMint = process.argv[2] || DEFAULT_OUTPUT_MINT;
const amountLamports = Number(process.argv[3] || 100000000);

const [tokens, prices, quote] = await Promise.all([
  getJson(`/tokens/v2/search?query=${encodeURIComponent(outputMint)}`),
  getJson(`/price/v3?ids=${SOL_MINT},${outputMint}`),
  getJson(`/swap/v1/quote?inputMint=${SOL_MINT}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=50`)
]);

const token = tokens[0] || null;
const tokenPrice = prices[outputMint];
const solPrice = prices[SOL_MINT];
const routeLabels = (quote.routePlan || []).map((hop) => hop.swapInfo?.label).filter(Boolean);
const outTokens = token ? Number(quote.outAmount) / 10 ** Number(token.decimals || 0) : 0;
const inputSol = amountLamports / 1e9;
const tokenUsdPrice = Number(tokenPrice?.usdPrice ?? token?.usdPrice ?? 0);
const inputUsd = inputSol * Number(solPrice?.usdPrice || 0);
const impliedUsd = outTokens * tokenUsdPrice;
const quoteDrift = inputUsd ? Math.abs(impliedUsd - inputUsd) / inputUsd : null;
const warnings = [];

if (token && !token.isVerified) warnings.push("Token is not verified.");
if (token && Number(token.organicScore || 0) < 70) warnings.push("Organic score is below 70.");
if (token && Number(token.liquidity || 0) < 100000) warnings.push("Liquidity is below $100k.");
if (routeLabels.length > 3) warnings.push("Route has more than three hops.");
if (Number(quote.priceImpactPct || 0) > 1) warnings.push("Price impact is above 1%.");
if (quoteDrift !== null && quoteDrift > 0.03) warnings.push("Quote value differs from Price API by more than 3%.");

const snapshot = {
  generatedAt: new Date().toISOString(),
  input: {
    amountLamports,
    inputMint: SOL_MINT,
    outputMint
  },
  token,
  prices,
  signal: {
    label: warnings.length ? "Caution" : "Clean",
    quoteDrift,
    warnings
  },
  quote: {
    outAmount: quote.outAmount,
    priceImpactPct: quote.priceImpactPct,
    routeLabels
  }
};

console.log(JSON.stringify(snapshot, null, 2));
