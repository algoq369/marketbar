import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { Asset, ViewCategory, SortKey } from '../types'
import { fetchAllAssets } from '../utils/api'
import { buildTickerString } from '../utils/helpers'
import { DEFAULT_WATCHLIST } from '../utils/constants'

export function useMarketData() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [activeCategory, setActiveCategory] = useState<ViewCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set(DEFAULT_WATCHLIST))
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const load = async () => {
      if (window.electronAPI) {
        const saved = await window.electronAPI.storeGet('watchlist')
        if (Array.isArray(saved)) setWatchlist(new Set(saved))
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.storeSet('watchlist', Array.from(watchlist))
    }
  }, [watchlist])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAllAssets()
      setAssets(data)
      setLastUpdate(new Date())
    } catch (err) {
      setError('Failed to load market data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [refresh])

  useEffect(() => {
    if (window.electronAPI) {
      return window.electronAPI.onRefreshData(() => refresh())
    }
  }, [refresh])

  useEffect(() => {
    if (!window.electronAPI || assets.length === 0) return
    const tickerItems = assets.filter((a) => watchlist.has(a.id))
    const text = buildTickerString(tickerItems)
    window.electronAPI.updateTicker(text)
  }, [assets, watchlist])

  const toggleWatchlist = useCallback((id: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const filteredAssets = useMemo(() => {
    let list = assets
    if (activeCategory === 'watchlist') {
      list = list.filter((a) => watchlist.has(a.id))
    } else if (activeCategory !== 'all') {
      list = list.filter((a) => a.category === activeCategory)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((a) => a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q))
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'price') return (b.current_price || 0) - (a.current_price || 0)
      if (sortBy === 'change') return (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)
      return a.name.localeCompare(b.name)
    })
    return list
  }, [assets, activeCategory, searchQuery, sortBy, watchlist])

  const categoryCounts = useMemo(() => ({
    all: assets.length,
    indices: assets.filter((a) => a.category === 'indices').length,
    commodities: assets.filter((a) => a.category === 'commodities').length,
    crypto: assets.filter((a) => a.category === 'crypto').length,
    watchlist: watchlist.size,
  }), [assets, watchlist])

  return {
    assets, filteredAssets, loading, error, lastUpdate,
    activeCategory, setActiveCategory, searchQuery, setSearchQuery,
    sortBy, setSortBy, watchlist, toggleWatchlist, refresh, categoryCounts,
  }
}
