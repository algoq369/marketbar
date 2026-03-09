import type { Asset, CoinGeckoMarket } from '../types'
import { TRADITIONAL_ASSETS, FALLBACK_CRYPTO } from './constants'
import { generateSparkline } from './helpers'

const API_BASE = 'http://localhost:3001/api'

// ─── Fetch Crypto via Backend ───────────────────────────────────────
export async function fetchCryptoAssets(): Promise<Asset[]> {
  try {
    const res = await fetch(`${API_BASE}/crypto/markets`)
    if (!res.ok) throw new Error(`Backend ${res.status}`)
    const json = await res.json()
    const data: CoinGeckoMarket[] = json.data

    return data.map((c) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      category: 'crypto' as const,
      current_price: c.current_price,
      price_change_percentage_24h: c.price_change_percentage_24h,
      sparkline_in_7d: c.sparkline_in_7d ?? null,
      market_cap: c.market_cap,
      total_volume: c.total_volume,
      high_24h: c.high_24h,
      low_24h: c.low_24h,
      image: c.image,
    }))
  } catch (err) {
    console.warn('Backend crypto fetch failed, trying direct:', err)
    // Fallback: try CoinGecko directly
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,cardano,dogecoin,avalanche-2,chainlink,polkadot,litecoin,uniswap,stellar,cosmos,near,arbitrum&order=market_cap_desc&sparkline=true&price_change_percentage=24h')
      if (!res.ok) throw new Error('Direct CoinGecko failed')
      const data: CoinGeckoMarket[] = await res.json()
      return data.map((c) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        category: 'crypto' as const,
        current_price: c.current_price,
        price_change_percentage_24h: c.price_change_percentage_24h,
        sparkline_in_7d: c.sparkline_in_7d ?? null,
        market_cap: c.market_cap,
        total_volume: c.total_volume,
        high_24h: c.high_24h,
        low_24h: c.low_24h,
        image: c.image,
      }))
    } catch {
      return generateFallbackCrypto()
    }
  }
}

// ─── Fetch Traditional via Backend (REAL Yahoo Finance data) ────────
export async function fetchTraditionalAssets(): Promise<Asset[]> {
  try {
    const res = await fetch(`${API_BASE}/traditional/all`)
    if (!res.ok) throw new Error(`Backend ${res.status}`)
    const json = await res.json()
    const data = json.data as Record<string, {
      price: number
      changePercent: number | null
      high: number | null
      low: number | null
      volume: number | null
      sparkline: number[]
      marketState: string
    }>

    return TRADITIONAL_ASSETS.map((a) => {
      const live = data[a.id]
      if (live) {
        return {
          id: a.id,
          symbol: a.symbol,
          name: a.name,
          category: a.category,
          current_price: live.price,
          price_change_percentage_24h: live.changePercent,
          sparkline_in_7d: { price: live.sparkline },
          market_cap: null,
          total_volume: live.volume,
          high_24h: live.high,
          low_24h: live.low,
          image: null,
        }
      }
      // Fallback to simulated for any that failed
      const sparkline = generateSparkline(a.base, a.vol)
      const current = sparkline[sparkline.length - 1]
      const prev = sparkline[0]
      return {
        id: a.id,
        symbol: a.symbol,
        name: a.name,
        category: a.category,
        current_price: current,
        price_change_percentage_24h: ((current - prev) / prev) * 100,
        sparkline_in_7d: { price: sparkline },
        market_cap: null,
        total_volume: null,
        high_24h: null,
        low_24h: null,
        image: null,
      }
    })
  } catch (err) {
    console.warn('Backend traditional fetch failed, using simulated:', err)
    return generateSimulatedTraditional()
  }
}

function generateSimulatedTraditional(): Asset[] {
  return TRADITIONAL_ASSETS.map((a) => {
    const sparkline = generateSparkline(a.base, a.vol)
    const current = sparkline[sparkline.length - 1]
    const prev = sparkline[0]
    return {
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      category: a.category,
      current_price: current,
      price_change_percentage_24h: ((current - prev) / prev) * 100,
      sparkline_in_7d: { price: sparkline },
      market_cap: null,
      total_volume: null,
      high_24h: null,
      low_24h: null,
      image: null,
    }
  })
}

function generateFallbackCrypto(): Asset[] {
  return FALLBACK_CRYPTO.map((c) => {
    const sparkline = generateSparkline(c.base, c.vol)
    const current = sparkline[sparkline.length - 1]
    const prev = sparkline[0]
    return {
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      category: 'crypto' as const,
      current_price: current,
      price_change_percentage_24h: ((current - prev) / prev) * 100,
      sparkline_in_7d: { price: sparkline },
      market_cap: null,
      total_volume: null,
      high_24h: null,
      low_24h: null,
      image: null,
    }
  })
}

// ─── Fetch All ──────────────────────────────────────────────────────
export async function fetchAllAssets(): Promise<Asset[]> {
  const [crypto, traditional] = await Promise.all([
    fetchCryptoAssets(),
    fetchTraditionalAssets(),
  ])
  return [...traditional, ...crypto]
}

// ─── Backend Health Check ───────────────────────────────────────────
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}
