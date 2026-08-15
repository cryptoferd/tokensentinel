# Multichain Token Sentinel

An on-demand, timed launch monitor and contract-risk scanner for major EVM mainnets. Each scan targets one selected network.

Access is token-gated to wallets holding a **Croikeys ERC-721** at
`0x3b70a5eae51db90bad7e4083341e0c2c0b74dae4` on Ethereum mainnet.

> Research tooling only. A clean result is **not** a guarantee that a token is safe, sellable, fairly launched, or free of malicious behavior.

## Deploy

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_GITHUB_USERNAME%2Frobinhood-token-sentinel&env=VITE_API_URL&envDescription=Public%20HTTPS%20URL%20of%20the%20Railway%20scanner%20API&project-name=robinhood-token-sentinel&repository-name=robinhood-token-sentinel)

The repository includes production manifests for a **Railway scanner/API** and
**Vercel dashboard**. Deploy Railway first, then give its public HTTPS URL to
Vercel as `VITE_API_URL`. See **[DEPLOY.md](DEPLOY.md)** for the complete setup,
persistent SQLite volume instructions, and how to publish a true Railway
one-click template button after the repository is on GitHub.

## What it does

- Runs user-controlled live scanning sessions from **5 to 60 minutes**.
- Uses a gas-free signed-wallet challenge and server-side Ethereum ownership check.
- Saves scan sessions and results separately for each authenticated wallet.
- Selects Robinhood, Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, Avalanche or Linea per scan.
- Uses public/standard chain RPCs for live scans, keeping live polling off Alchemy.
- Backfills launches from the last **5m, 30m, 1h, 3h, 6h, 12h or 24h** using concurrent Alchemy block-range scanning when a key is configured.
- Adds Dexscreener market-cap/liquidity enrichment and filters for market cap, holders, concentration, liquidity and risk.
- Adds direct DexScreener links for tokens and resolves OpenSea collection slugs for indexed NFTs.
- Starts each timed session at the current chain tip and stops automatically at zero.
- Includes an immediate manual stop control and live countdown.
- Watches every new block during an active session for **contract-creation transactions**.
- Classifies new deployments as ERC-20 or ERC-721 using ERC-165 plus contract metadata probes.
- Lets each live or historical scan target Tokens, NFTs, or Both; new scans default to ERC-20 tokens.
- Detects canonical **Uniswap V2-style `PairCreated`** and **V3-style `PoolCreated`** events chain-wide.
- Stores discoveries by chain ID and address in SQLite so identical addresses on different networks never collide.
- Pulls verified source/ABI information from Robinhood Chain Blockscout.
- Flags blacklist, pause/trading controls, minting, mutable fees/taxes, max-wallet/max-tx controls, whitelist/exemptions, cooldowns, proxy/upgrade patterns, assembly and delegatecall patterns.
- Scans runtime bytecode for notable opcodes while correctly skipping PUSH data.
- Probes common public buy/sell tax getters and flags high values when they can be normalized responsibly.
- Reconstructs balances from ERC-20 `Transfer` logs for **Top 5 holder concentration**.
- Displays both raw Top 5 and an adjusted circulating Top 5 excluding burn/zero/token/pool addresses.
- Streams new blocks, launches, pool creation and analysis updates to the React dashboard over SSE.

## Official Robinhood Chain defaults

```text
Chain ID:       4663
RPC:            https://rpc.mainnet.chain.robinhood.com
Block explorer: https://robinhoodchain.blockscout.com
WETH (L2):      0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
```

The public RPCs are used for live monitoring and contract analysis. Alchemy is reserved for historical block retrieval. For frequent or long-running sessions, override the relevant live RPC variable with a dedicated non-Alchemy endpoint.

OpenSea collection pages use slugs rather than contract addresses. When `OPENSEA_API_KEY` is configured, NFT analysis asks OpenSea for the contract metadata and stores its collection slug. Collections that are unsupported or not yet indexed display as pending; use **Rescan now** after OpenSea indexes the collection.

## Requirements

- Node.js 20+
- npm 10+

`better-sqlite3` includes a native module. Normal npm installs on current Node LTS versions use prebuilt binaries on common platforms; otherwise a local C/C++ build toolchain may be required.

## Quick start

```bash
git clone <your-repo-url>
cd robinhood-token-sentinel
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

The scanner/API runs on `http://localhost:8787`.

## Production build

```bash
npm install
npm run build
npm start
```

`npm start` starts the scanner/API. Serve the repository-level `dist` directory with any static host and set `VITE_API_URL` before building the frontend to the public scanner API URL.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `ALCHEMY_API_KEY` | Railway-only key used exclusively for accelerated historical block retrieval | empty |
| `OPENSEA_API_KEY` | Railway-only key used to resolve an NFT contract to its OpenSea collection slug | empty |
| `RPC_URL` | Robinhood live-scan RPC; Alchemy is never substituted here | Official public RPC |
| `LIVE_RPC_URL_*` | Per-chain live RPC overrides for Ethereum, Base, Arbitrum, Optimism, Polygon, BNB, Avalanche and Linea | Public chain endpoints |
| `CHAIN_ID` | Robinhood mainnet chain ID | `4663` |
| `BLOCKSCOUT_API_URL` | Explorer API | Robinhood Blockscout `/api` |
| `START_BLOCK` | First block if no DB cursor exists | `latest` |
| `POLL_INTERVAL_MS` | Tip polling interval | `1500` |
| `MAX_BLOCKS_PER_TICK` | Catch-up work per polling loop | `5` |
| `ANALYSIS_CONCURRENCY` | Parallel deep analyses | `2` |
| `HOLDER_LOOKBACK_BLOCKS` | Maximum holder reconstruction lookback | `50000` |
| `MAX_TRANSFER_LOGS` | Holder-analysis log safety limit | `20000` |
| `SCANNER_AUTO_START` | Start continuous scanning when the API boots; keep `false` for timed dashboard sessions | `false` |
| `GATE_RPC_URL` | Ethereum-mainnet RPC used for Croikey `balanceOf` checks | Public Ethereum endpoint |
| `GATE_CONTRACT_ADDRESS` | ERC-721 collection required for access | Croikeys contract |
| `SESSION_TTL_HOURS` | Signed-wallet session lifetime | `168` (7 days) |
| `HISTORICAL_CONCURRENCY` | Parallel historical block requests | `8` |
| `RPC_REQUEST_INTERVAL_MS` | Minimum spacing between historical RPC request starts; raise it if your plan returns 429 errors | `150` |
| `RPC_RATE_LIMIT_RETRIES` | Exponential-backoff retries for Alchemy 429 responses | `6` |
| `MAX_HISTORICAL_BLOCKS` | Safety cap for one lookback job | `400000` |
| `DB_PATH` | SQLite database location; uses an attached Railway volume automatically when unset | `./sentinel.db` locally |
| `DEX_V2_FACTORIES` | Optional comma-separated V2 factory allowlist | empty |
| `DEX_V3_FACTORIES` | Optional comma-separated V3 factory allowlist | empty |
| `CORS_ORIGINS` | Comma-separated exact or wildcard frontend origins | localhost Vite + `*.vercel.app` |
| `VITE_API_URL` | Frontend API base URL | localhost API |

If the DEX factory lists are empty, canonical V2/V3 pool events from any event emitter are accepted. Set factory allowlists when you know the canonical production deployments and want strict attribution.

## API

- `GET /health`
- `GET /api/auth/config`
- `POST /api/auth/nonce` with `{ "address": "0x..." }`
- `POST /api/auth/verify` with `{ "address": "0x...", "signature": "0x..." }`
- All remaining `/api/*` routes require `Authorization: Bearer <session>`.
- `GET /api/stats`
- `GET /api/chains`
- `GET /api/scans`
- `DELETE /api/scans/:id` — deletes one completed/failed/stopped scan owned by the authenticated wallet
- `POST /api/scans/history` with `{ "chainKey": "ethereum", "lookbackMinutes": 5|30|60|180|360|720|1440, "assetType": "ERC20"|"ERC721"|"BOTH" }`
- `GET /api/scans/:id/results` with market-cap, holder, LP, concentration, tax, risk and text filters
- `GET /api/tokens/:address`
- `POST /api/tokens/:address/rescan`
- `POST /api/scanner/start` with `{ "chainKey": "ethereum", "durationMinutes": 5..60, "assetType": "ERC20"|"ERC721"|"BOTH" }`
- `POST /api/scanner/stop` with `{ "scanId": "..." }`
- `GET /api/stream` — Server-Sent Events

## Risk model

Risk scores are deliberately explainable. Each warning contributes a severity weight and the final score is capped at 100:

- `0–20`: LOW
- `21–40`: MODERATE
- `41–70`: HIGH
- `71–100`: CRITICAL

The UI presents the underlying warnings instead of treating the score as proof of safety.

### Important limitations

**Taxes / honeypots:** V1 probes common zero-argument public tax/fee getters when available. It does not claim a token is sellable merely because no tax getter is found. Fully generic buy/sell simulation requires a known route, pool state and a simulation strategy for funded caller state; this should be added as a separate simulation adapter instead of faking a result.

**Holder concentration:** balances are reconstructed from standard `Transfer` logs. Rebasing tokens, nonstandard balance mutations, intentionally malformed events, truncated history, and archive-provider limitations can make the estimate incomplete. New launches monitored from deployment are the most reliable case.

**Source analysis:** verified Solidity source permits deeper review. Unverified contracts receive an explicit warning; bytecode heuristics still run.

**Pool detection:** V2/V3 event signatures are detected. V4-style singleton PoolManager initialization is intentionally not labeled as a conventional pool contract in V1; add a V4 adapter once the target Robinhood deployment is confirmed.

## Repo layout

```text
apps/
  scanner/               Node/TypeScript indexer + API
    src/analysis/        source, bytecode, tax, holder and scoring engines
    src/workers/         block scanner, pool watcher, analysis queue
    src/http/            REST + SSE server
    src/db/              SQLite schema/repository
  web/                   React/Vite dashboard
packages/
  shared/                shared API/domain types
```

## Deployment notes

The scanner writes SQLite state and should not be deployed as a stateless Vercel function. Railway can host the API with a persistent volume and its Serverless option enabled. With `SCANNER_AUTO_START=false`, blockchain polling occurs only during a timed session; after the dashboard is closed and outbound activity stops, Railway can put the service to sleep. The React frontend remains hosted statically on Vercel.

For the included Railway + Vercel layout, follow [DEPLOY.md](DEPLOY.md). The
checked-in `railway.json` configures Docker builds, health checks and restart
behavior. The checked-in `vercel.json` builds only the shared package and web
dashboard, with Vite emitting directly to the root `dist` directory Vercel
expects. Attach exactly one Railway volume and run a single scanner replica
while using SQLite.

For multi-instance production deployments, replace SQLite with Postgres and use a single elected scanner/indexer process.

## Security posture

This application never needs a private key. Keep it read-only. Do not add wallet signing keys to the scanner to perform simulations; prefer `eth_call`, state overrides where supported, or third-party simulation infrastructure.

## License

MIT
