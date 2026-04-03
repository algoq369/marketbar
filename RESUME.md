# MARKETBAR — QUICK RESUME
# Last updated: 2026-04-03 19:00 UTC

## STATUS: v1.1 — DEPLOYED TO PRODUCTION ✅
- Production API: https://marketbar.vercel.app/api
- GitHub Desktop: https://github.com/algoq369/marketbar (5 commits, clean)
- GitHub Mobile: https://github.com/algoq369/marketbar-mobile (2 commits, clean)
- Local dev: `cd ~/marketbar && NODE_ENV=development npm run dev` → :5173 + :3001
- Electron: `cd ~/marketbar && NODE_ENV=development npm run dev:electron`
- Mobile: `cd ~/marketbar-mobile && ulimit -n 65536 && npx expo start`
- Stack: TypeScript + React 18 + Vite 5 + Electron 28 + Express
- Build: CLEAN (0 uncommitted, both repos synced)

## WHAT EXISTS (DO NOT RE-VERIFY)
Desktop (~/marketbar) — 1585 lines:
  electron/main.ts(170L) preload.ts(15L)
  server/index.mjs(200L) — local Express backend
  api/index.mjs(120L) — Vercel serverless (deployed)
  vercel.json — routing config
  src/App.tsx components/{TitleBar,CategoryTabs,SearchBar,AssetRow,AssetDetail,Sparkline}.tsx
  src/hooks/useMarketData.ts utils/{api,constants,helpers}.ts types/index.ts
  vite.config.ts vite.web.config.ts(web-only dev, avoids electron plugin crash)

Mobile (~/marketbar-mobile) — 1247 lines:
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

## REMAINING WORK (priority order)
NEXT: App icon (.icns + .png), keyboard shortcuts (⌘R, Esc), settings panel
THEN: Deploy mobile to TestFlight/Expo EAS, portfolio tracking, multiple watchlists
LATER: Electron auto-updater, macOS widgets, WebSocket live prices

## KEY ENV ISSUES
NODE_ENV=production globally → always use NODE_ENV=development npm install
EMFILE on Expo → ulimit -n 65536 (added to ~/.zshrc)
vite-plugin-electron kills dev → use vite.web.config.ts for browser dev

## RULES FOR AI SESSIONS
1. Read THIS file only — not the full dev log
2. Do NOT curl/verify — trust status above
3. Start building immediately
4. Update this file BEFORE context fills
