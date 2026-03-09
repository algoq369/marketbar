export interface Asset {
  id: string
  symbol: string
  name: string
  category: AssetCategory
  current_price: number
  price_change_percentage_24h: number | null
  sparkline_in_7d: { price: number[] } | null
  market_cap: number | null
  total_volume: number | null
  high_24h: number | null
  low_24h: number | null
  image: string | null
}

export type AssetCategory = 'indices' | 'commodities' | 'crypto'
export type ViewCategory = AssetCategory | 'all' | 'watchlist'
export type SortKey = 'name' | 'price' | 'change'

export interface CoinGeckoMarket {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_percentage_24h: number
  sparkline_in_7d?: { price: number[] }
}

export interface AppSettings {
  watchlist: string[]
  refreshInterval: number
  launchAtLogin: boolean
  theme: 'dark' | 'light' | 'system'
}

export interface ElectronAPI {
  updateTicker: (text: string) => void
  storeGet: (key: string) => Promise<any>
  storeSet: (key: string, value: any) => Promise<void>
  hideWindow: () => void
  setWindowSize: (w: number, h: number) => void
  openExternal: (url: string) => void
  getTheme: () => Promise<'dark' | 'light'>
  onRefreshData: (callback: () => void) => () => void
  platform: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
