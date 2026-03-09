# ◈ MarketBar

**Free, open-source macOS menu bar market tracker.**

Track stocks, indices, commodities, and crypto — all from your menu bar.

![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-macOS-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Electron](https://img.shields.io/badge/Electron-28-purple)

---

## Features

- **Menu bar ticker** — live watchlist prices scrolling in your macOS menu bar
- **31 assets** — 6 indices, 10 commodities, 15 crypto coins
- **Live crypto data** — CoinGecko API (free, no key needed)
- **Watchlist** — star your favorites, persisted between sessions
- **Category filters** — All / Indices / Commodities / Crypto / Watchlist
- **Search + sort** — filter by name/symbol, sort by A-Z / Price / % Change
- **Sparkline charts** — 7-day price trend for every asset
- **Detail view** — tap any asset for expanded chart + stats
- **Launch at login** — optional auto-start
- **Native macOS** — dark theme, vibrancy, frameless window, dock hidden

### Assets Tracked

| Indices | Commodities | Crypto |
|---------|-------------|--------|
| S&P 500 | Gold | Bitcoin |
| Dow Jones | Silver | Ethereum |
| Nasdaq 100 | Crude Oil WTI | Solana |
| FTSE 100 | Brent Crude | XRP |
| DAX 40 | Natural Gas | Cardano |
| Nikkei 225 | Platinum | Dogecoin |
| | Palladium | Avalanche |
| | Copper | Chainlink |
| | Wheat | Polkadot |
| | Corn | + 5 more |

---

## Quick Start

```bash
git clone https://github.com/algoq369/marketbar.git
cd marketbar
npm install
npm run dev:electron
```

The ◈ icon appears in your menu bar. Click it to open the tracker popup.

### Requirements

- Node.js ≥ 18
- macOS (menu bar UX is macOS-optimized)

---

## Stack

- **TypeScript** — full type safety
- **React 18** — UI components
- **Vite 5** — dev server + bundler
- **Electron 28** — native macOS app
- **CoinGecko API** — live crypto data (free)

---

## Project Structure

```
marketbar/
├── electron/
│   ├── main.ts          # Tray, window management, IPC
│   └── preload.ts       # Secure IPC bridge
├── src/
│   ├── components/      # React UI components
│   ├── hooks/           # useMarketData hook
│   ├── types/           # TypeScript definitions
│   ├── utils/           # API, constants, helpers
│   ├── App.tsx          # Main app
│   └── main.tsx         # Entry point
├── index.html
├── vite.config.ts
└── package.json
```

---

## Build & Distribute

```bash
# Development
npm run dev:electron

# Build
npm run build

# Package as .dmg
npm run dist
```

---

## Contributing

Pull requests welcome. For major changes, open an issue first.

1. Fork the repo
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## License

[MIT](LICENSE) — free and open source.

---

Built with ◈ by [@algoq369](https://github.com/algoq369)
