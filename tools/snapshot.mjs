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

const snapshot = {
  generatedAt: new Date().toISOString(),
  input: {
    amountLamports,
    inputMint: SOL_MINT,
    outputMint
  },
  token: tokens[0] || null,
  prices,
  quote: {
    outAmount: quote.outAmount,
    priceImpactPct: quote.priceImpactPct,
    routeLabels: (quote.routePlan || []).map((hop) => hop.swapInfo?.label).filter(Boolean)
  }
};

console.log(JSON.stringify(snapshot, null, 2));
