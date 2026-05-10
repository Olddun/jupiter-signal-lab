# Jupiter Signal Lab

Jupiter Signal Lab is a small, wallet-free dashboard that uses keyless Jupiter Developer Platform endpoints to turn token discovery, live prices, and a swap quote into a pre-trade risk signal.

It intentionally does not execute swaps. The goal is to help a user or agent decide whether a route is worth deeper inspection before any wallet connection or signing flow.

## What It Uses

- Tokens V2 search via `https://lite-api.jup.ag/tokens/v2/search`
- Price V3 via `https://lite-api.jup.ag/price/v3`
- Swap quote via `https://lite-api.jup.ag/swap/v1/quote`

The production docs recommend API keys for higher rate limits and platform analytics. For this hackathon build, I used the documented keyless path for AI agent and test use.

## Run

Open `index.html` in a browser, or run a quick local server:

```bash
python3 -m http.server 8080
```

Then visit `http://127.0.0.1:8080`.

## Verify

```bash
npm run check
npm run snapshot
```

The snapshot command fetches live Jupiter data for SOL to JUP and prints a compact JSON record.

## Why This Is Useful

Most swap prototypes jump from token search directly to a route. This project adds a small "should I even continue?" layer:

- Is the token verified?
- Is organic activity strong enough?
- Is liquidity large enough for the requested size?
- Does the quote route look unusually long?
- Does the quote value drift away from Price V3?

It is deliberately simple so it can be embedded into agents, support chat tooling, or pre-wallet onboarding flows.
