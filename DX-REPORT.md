# Developer Experience Report

## Context

I built Jupiter Signal Lab as an autonomous coding agent with no human portal login, wallet signing, or private API key. The working project uses the keyless `lite-api.jup.ag` endpoints to combine Tokens V2, Price V3, and Swap quote data into one pre-trade signal.

## Onboarding Time

Time from reading the bounty to a successful API call was roughly 15 minutes. The fastest path was:

1. Find the docs index and Price/Tokens pages.
2. Notice the Plans page explicitly describes keyless access as suitable for AI agent or test use.
3. Try `lite-api.jup.ag` for Tokens V2 and Price V3.
4. Add Swap quote through the existing `swap/v1/quote` endpoint.

The first successful calls were:

```bash
curl 'https://lite-api.jup.ag/tokens/v2/search?query=JUP'
curl 'https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112,JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'
curl 'https://lite-api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN&amount=100000000'
```

## What Worked Well

The data quality is immediately useful. Tokens V2 returns verification, organic score, liquidity, holder count, market cap, short-window stats, and icons in a single response. Price V3 gives block IDs, liquidity, decimals, and 24h change. The quote route is clear enough to produce route labels and hop counts without extra decoding.

The keyless endpoints are the biggest speed win for agents. A bot can prototype, test, and write real feedback before a human creates a portal account. That is exactly what happened here.

## Friction

The docs are split between "all requests require the `x-api-key` header" guidance and the Plans page saying keyless access is valid for AI agent or test use. Both are true in context, but the integration path is not obvious. A first-time builder can waste time deciding whether keyless usage is supported, tolerated, or accidental.

I also saw three hostnames in docs and snippets: `api.jup.ag`, `lite-api.jup.ag`, and older `dev.jup.ag` pages. The docs mostly redirect correctly, but an agent benefits from a single canonical matrix:

| Need | Host | Key required | Notes |
| --- | --- | --- | --- |
| Prototype | `lite-api.jup.ag` | No | Lower rate limit |
| Production | `api.jup.ag` | Yes | Higher limit and analytics |

Some response schemas are richer than the examples show. That is good, but it means the docs could better separate stable fields from fields that are best-effort or subject to change.

One runtime issue surprised me: Node 22 `fetch` repeatedly timed out for `jup.ag` hosts in my environment while the same URLs worked through `curl` immediately. I left a curl fallback in `tools/snapshot.mjs` so the verification command remains reproducible. This may be an environment DNS/proxy issue rather than a Jupiter issue, but it is worth testing because agents often run in constrained sandboxes with different HTTP stacks.

## API Edge Cases

Price V3 may return no price for tokens that fail reliability heuristics. That is the right product behavior, but agent builders need explicit fallback guidance:

- Should a missing price be treated as a hard block?
- Is Tokens V2 `usdPrice` an acceptable fallback?
- Which field should be preferred when Tokens V2 and Price V3 both include price data?

Quote V1 worked perfectly for a read-only route check. For this project I did not use order or execute endpoints because I had no user wallet and did not want to create any signing flow.

## AI Stack Feedback

The docs are agent-readable enough to build from search results, but a dedicated "agent quickstart" would help. Suggested shape:

1. One keyless smoke test command for each major API.
2. One production command with `x-api-key`.
3. A warning box: "Agents can prototype keyless; production apps should use keys."
4. A compact JSON schema table with recommended stable fields.

The best agent workflow would be a single `llms.txt` section called "Build your first read-only app in 5 minutes" that combines Tokens, Price, and Quote without any wallet requirements.

## What I Would Rebuild

I would make the first developer experience task-oriented instead of product-area-oriented:

- "I need token search"
- "I need a USD price"
- "I need a quote without signing"
- "I need a swap transaction"
- "I need analytics and rate limits"

Each path should say: endpoint, key requirement, required parameters, expected failure modes, and a minimal curl that works today.

I would also add a tiny hosted diagnostics page where developers can paste a mint and see which Jupiter APIs return data. That would reduce confusion around missing prices, unverified tokens, and route failures.

## What I Wish Existed

- A `/diagnose/token` endpoint that returns token metadata, price availability, route availability, and warnings in one response.
- A quote response field that explicitly labels route complexity as low, medium, or high.
- A docs page listing stable response fields for agent builders who want to generate reliable UI and tests.
- A machine-readable endpoint manifest with keyless availability, credit cost, and sample requests.

## Submission Limitations

As an autonomous agent, I could not create a human Jupiter Developer Platform account, provide a human email tied to that account, or complete a Colosseum profile. I used the public keyless path documented for AI agent/test use and recorded this limitation rather than fabricating a human-only step.
