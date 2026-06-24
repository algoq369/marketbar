# MARKETBAR — QUICK RESUME
# Last updated: 2026-06-24 12:40 UTC | + server-side ZONE-ALERT ENGINE (Phase 1: notify)

## STATUS: v1.1 — DEPLOYED TO PRODUCTION ✅
- Production API: https://marketbar.vercel.app/api
- GitHub Desktop: https://github.com/algoq369/marketbar (5 commits, clean)
- GitHub Mobile: https://github.com/algoq369/marketbar-mobile (2 commits, clean)
- Local dev: `cd ~/Desktop/hustle/projects/marketbar/marketbar-desktop && NODE_ENV=development npm run dev` → :5173 + :3001
- Electron: `cd ~/Desktop/hustle/projects/marketbar/marketbar-desktop && NODE_ENV=development npm run dev:electron`
- Mobile: `cd ~/Desktop/hustle/projects/marketbar/marketbar-mobile && ulimit -n 65536 && npx expo start`
- Stack: TypeScript + React 18 + Vite 5 + Electron 28 + Express
- Build: CLEAN (0 uncommitted, both repos synced)

## WHAT EXISTS (DO NOT RE-VERIFY)
Desktop (~/Desktop/hustle/projects/marketbar/marketbar-desktop) — 1585 lines:
  electron/main.ts(170L) preload.ts(15L)
  server/index.mjs(200L) — local Express backend
  api/index.mjs(120L) — Vercel serverless (deployed)
  vercel.json — routing config
  src/App.tsx components/{TitleBar,CategoryTabs,SearchBar,AssetRow,AssetDetail,Sparkline}.tsx
  src/hooks/useMarketData.ts utils/{api,constants,helpers}.ts types/index.ts
  vite.config.ts vite.web.config.ts(web-only dev, avoids electron plugin crash)

Mobile (~/Desktop/hustle/projects/marketbar/marketbar-mobile) — 1247 lines:
  App.tsx screens/{MarketsScreen,AlertsScreen,CreateAlertScreen}.tsx
  services/{api,indicators,alertEngine,notifications}.ts utils/constants.ts
  API pointed to: https://marketbar.vercel.app/api

## VERIFIED DATA (2026-04-03 19:00 UTC)
Production endpoints: health=200 crypto=200 traditional=200 alerts=200
Local endpoints: frontend(5173)=200 backend(3001)=200
16/16 traditional assets: real Yahoo Finance prices (source=api)
15/15 crypto coins: real CoinGecko data (source=api)
Both repos: 0 uncommitted files, synced with origin

## COMPLETED FEATURES
F1 ✅ Electron menu bar tray app (macOS, dock hidden, right-click menu)
F2 ✅ Express backend :3001 with Yahoo Finance + CoinGecko
F3 ✅ Vercel serverless deployment (auto-deploy on push)
F4 ✅ Server-side caching (60s price, 300s meta)
F5 ✅ 16 live traditional assets (6 indices + 10 commodities)
F6 ✅ 15 live crypto coins (CoinGecko API)
F7 ✅ Category tabs, search, sort (name/price/change)
F8 ✅ Sparkline 7d charts (SVG)
F9 ✅ Watchlist persistence (electron-store)
F10 ✅ Asset detail overlay with expanded chart
F11 ✅ TitleBar LIVE/OFFLINE backend status badge
F12 ✅ Footer: "CoinGecko + Yahoo Finance" (no longer "simulated")
F13 ✅ GitHub public repos (MIT license)
F14 ✅ Mobile alert engine (13 conditions: price/RSI/MACD/Fib/divergence)
F15 ✅ Expo push notifications (local)
F16 ✅ Mobile pointed to production API
F17 ✅ Server-side ZONE-ALERT ENGINE (Phase 1: notify-only) — see block below

## ZONE-ALERT ENGINE (Phase 1 ✅ — notify-only, money-path-hardened)
Server polls live prices and fires Expo push when an asset approaches/enters a price zone.
Built forward-compatible with trade execution: zone.action ('notify'|'trade') + zone.tradeConfig
(null, // PHASE 2) attach to the SAME zone object later with no rewrite. NO Blofin/trade code yet.

Files (all new, in server/lib/):
  zoneEngine.mjs   PURE testable core: distanceToZone, classifyZoneState, shouldFire, buildAlertMessage
  prices.mjs       CoinGecko + CMC fallback + Yahoo; every fetch = withRetry + 8s timeout + breaker + classifyError
  push.mjs         Expo push send (chunked, self-prunes DeviceNotRegistered tokens)
  evaluate.mjs     runEvaluationPass (single-flight) + zonesStatus — shared by local poller AND Vercel
  zoneRoutes.mjs   all endpoints, Zod-validated + rate-limited; mounted by BOTH server/index.mjs & api/index.mjs
  store.mjs        zones.json + push-tokens.json (crypto.randomBytes ids; atomic writes; /tmp on serverless)
  schemas.mjs      Zod (upper>lower, approachThreshold 0–50, asset enum, max lengths)
  retry.mjs errors.mjs  VENDORED stdlib patterns (withRetry/withTimeout, classifyError/isTransientError) — copied, NOT cross-repo imported
  log.mjs          structured JSON-line logger, redacts key/token-like values
  circuitBreaker.mjs rateLimit.mjs assets.mjs

Endpoints (local :3001 AND Vercel):
  GET    /api/zones            POST /api/zones            PUT /api/zones/:id
  DELETE /api/zones/:id        POST /api/zones/:id/toggle
  GET    /api/zones/status     live price/state/distance% per zone (dashboard + mobile)
  GET    /api/zones/evaluate   ONE evaluation pass (Vercel cron / uptime pinger — see below)
  POST   /api/push/register    store an Expo push token

Local: 45s setInterval poller in server/index.mjs (single-flight + overlap guard). PORT now env-configurable.
Vercel: serverless CANNOT setInterval → drive GET /api/zones/evaluate on a schedule. PRODUCTION TRIGGER (do at deploy time):
  - Easiest (any plan): external pinger (cron-job.org / UptimeRobot) → GET /api/zones/evaluate every 1–2 min.
  - Or Vercel Cron: add `"crons":[{"path":"/api/zones/evaluate","schedule":"*/2 * * * *"}]` (Hobby limits cadence — verify plan).
  - If EVALUATE_TOKEN is set in Vercel env, the pinger must send `?token=` or `x-evaluate-token` header.
  - NOTE: file persistence on Vercel is /tmp (per-instance, ephemeral). Durable cross-instance zones need a DB → Phase 2/3.

Env (.env.example, all OPTIONAL for Phase 1): CMC_API_KEY (crypto fallback; skipped if unset, no crash),
  EVALUATE_TOKEN (guards the evaluate trigger), LOG_LEVEL, ZONES_PATH/PUSH_TOKENS_PATH overrides.
Tests: `NODE_ENV=development npm test` → 34 Vitest pass (zoneEngine 27 + retry 7). Runtime state (lastState/lastFired)
  persists to zones.json so transitions are detected across restarts/cold-starts.
Mobile TODO (not done here): call POST /api/push/register with getExpoPushTokenAsync(); render GET /api/zones/status.

## REMAINING WORK (priority order)
NEXT (zone engine): wire mobile to register push token + render /api/zones/status; add zone-create UI; production evaluate trigger (pinger/cron).
PHASE 2 (Blofin READ-ONLY): add BLOFIN_API_KEY/SECRET/PASSPHRASE (T1 server-side only, T7 validate at boot),
  read account balance + open positions; surface on a zone with action stays 'notify'. NO order placement.
PHASE 3 (Blofin TRADE EXECUTION): zone.action='trade' + tradeConfig becomes live. REQUIRES, per RESUME standards:
  T5 server-side re-validation of zone/size/RR/SL against AlgoQ rulebook in the handler; T6 HMAC+timingSafeEqual+timestamp
  on Blofin responses; T8 explicit per-zone confirm flag (no silent auto-exec); full DEPLOY GATE before any real-money ship.
THEN: App icon (.icns + .png), keyboard shortcuts (⌘R, Esc), settings panel; mobile TestFlight/EAS; portfolio tracking.
LATER: Electron auto-updater, macOS widgets, WebSocket live prices.

## KEY ENV ISSUES
NODE_ENV=production globally → always use NODE_ENV=development npm install
EMFILE on Expo → ulimit -n 65536 (added to ~/.zshrc)
vite-plugin-electron kills dev → use vite.web.config.ts for browser dev


═══════════════════════════════════════════════════════════════════════
## CODING STANDARDS — from WEBNA V3 Rulebook (pertinent subset only)
═══════════════════════════════════════════════════════════════════════
# Source: How-To-Build-And-Ship-A-Website-V3.docx + @algoq/stdlib (20 patterns)
# Scope: Only what applies to MarketBar (menu-bar + mobile + backend → Blofin trades).
# Skipped as N/A: passkeys/OAuth, CMS, i18n, search, PWA, Stripe, full CSP L3,
#   Lighthouse 90+, full Security Shield CI. MarketBar is a personal trading tool,
#   not a multi-user SaaS website. But the money-path rules below are NON-NEGOTIABLE.

### TIER 1 — MONEY-PATH (mandatory once Blofin connects; real funds at stake)
T1. SECRETS server-side ONLY. Blofin API key/secret, CMC key live in env vars +
    Vercel "Sensitive" flag. NEVER in client code, NEVER committed. (.env in .gitignore)
T2. Every external API call (CoinGecko/CMC/Yahoo/Blofin) wrapped in withRetry() —
    exponential backoff. One failed fetch must NEVER crash the alert engine. (stdlib #10)
T3. Zod-validate every backend endpoint input — especially zone CRUD + any trade payload.
    Max lengths, type checks, range checks. Every boundary needs Zod. (Principle 1)
T4. crypto.randomBytes for all IDs/tokens — NEVER Math.random(). (Principle 3)
T5. Trade actions enforced SERVER-SIDE only — never trust a client-sent "place trade".
    Re-validate the zone, the size, the RR, the SL against the AlgoQ rulebook in the handler.
T6. Blofin webhook/response signatures verified (HMAC + timingSafeEqual + timestamp).
    No unsigned trade confirmation is trusted. (Principle 9)
T7. Env validation at BOOT — if BLOFIN_API_KEY missing/malformed, fail loud at startup,
    NOT mid-trade. Build fails loud, not runtime fails silent. (Principle 5)
T8. Sensitive ops (placing/modifying a real trade) require explicit confirmation —
    no silent auto-execution without a confirmed config flag per zone. (Principle 4/8)

### TIER 2 — RELIABILITY (the alert engine must run unattended without dying)
T9.  classifyError() pattern — distinguish transient (retry) vs permanent (alert+skip).
     Graceful fallback on every fetch, never a bare throw that kills the poller. (stdlib #3)
T10. Every poll/long-op uses a timeout + abort (createContext().withTimeout()) — a hung
     Blofin/CoinGecko call must not freeze the 45s loop. Abort propagates. (stdlib #4)
T11. Circuit breaker on failure-prone paths — if a source 5xxs repeatedly, back off
     instead of hammering it every cycle. (createGuard / Principle 14)
T12. Rate-limit public Vercel endpoints (zone CRUD, push register) — they're internet-facing.
T13. Structured logging, not console.log. Redact secrets. Tag each poll with a tracker
     (cost/duration/source). (stdlib #5 createDebugLogger, #18 createTracker)
T14. Health endpoint (have /api/health) + uptime monitor (UptimeRobot) + error tracking
     (Sentry free tier) once the engine runs 24/7. (Phase 11/24)

### TIER 3 — HYGIENE (cheap, always-on discipline)
T15. TypeScript strict mode everywhere. tsc 0 errors before any commit.
T16. Conventional Commits (already doing). Never commit .env/.db/keys. (Phase 21)
T17. Unit tests on the CORE money logic: approach-detection + indicator math
     (RSI/MACD/Fib/zone-state transitions). This is the one place tests are mandatory —
     it decides money. Vitest, run before deploy. (Phase 18, scoped)
T18. If you cannot roll back, do not deploy. Tag releases; keep last-good live. (Principle 7)
T19. Basic security headers on the web dashboard (config-only in vercel.json):
     X-Content-Type-Options nosniff, Referrer-Policy, HSTS. No app-code changes. (Phase 7, light)
T20. NEVER SHIP INCOMPLETE — all env vars set, all sources provisioned before "done". (Principle 11)

### @algoq/stdlib — available at ~/webna/packages/stdlib (vendor or copy patterns as needed)
Relevant to MarketBar: withRetry (retry/), classifyError (errors/), createContext (context/),
createGuard (permissions/), createTracker (tracking/), createDebugLogger (debug/),
createMeter+startSpan (telemetry/). These are reference implementations — copy the pattern,
don't over-engineer. "WEBNA tells you WHAT; stdlib tells you HOW."

### DEPLOY GATE (lightweight Shield, MarketBar-scoped)
Before any production deploy of the backend, the money-path minimum:
  1. Zero secrets in code/bundle (grep for sk_/AKIA/blofin key patterns post-build)
  2. .env not committed (git check)
  3. All external calls have withRetry + timeout
  4. Zone CRUD + trade payloads Zod-validated
  5. HTTPS on every endpoint (Vercel gives this)
Fail any → do not deploy. (Distilled from the 5-layer Security Shield; full CI optional later.)


## RULES FOR AI SESSIONS
1. Read THIS file only — not the full dev log
2. Do NOT curl/verify — trust status above
3. Start building immediately
4. Update this file BEFORE context fills
5. Backend/money-path code MUST follow the CODING STANDARDS section above —
   Tier 1 (secrets, Zod, withRetry, server-side trade enforcement) is non-negotiable
   the moment Blofin is wired. No real-trade code ships without the deploy gate passing.
