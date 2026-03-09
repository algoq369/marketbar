import type { Asset, CoinGeckoMarket } from '../types'
import { TRADITIONAL_ASSETS, CRYPTO_IDS, FALLBACK_CRYPTO } from './constants'
import { generateSparkline } from './helpers'

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

export async function fetchCryptoAssets(): Promise<Asset[]> {
  try {
    const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${CRYPTO_IDS}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
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
  } catch (err) {
    console.warn('CoinGecko fetch failed, using fallback:', err)
    return generateFallbackCrypto()
  }
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

export function fetchTraditionalAssets(): Asset[] {
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

export async function fetchAllAssets(): Promise<Asset[]> {
  const [crypto, traditional] = await Promise.all([
    fetchCryptoAssets(),
    Promise.resolve(fetchTraditionalAssets()),
  ])
  return [...traditional, ...crypto]
}
