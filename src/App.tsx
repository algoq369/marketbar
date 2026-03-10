import React, { useState } from 'react'
import type { Asset } from './types'
import { useMarketData } from './hooks/useMarketData'
import { TitleBar } from './components/TitleBar'
import { CategoryTabs } from './components/CategoryTabs'
import { SearchBar } from './components/SearchBar'
import { AssetRow } from './components/AssetRow'
import { AssetDetail } from './components/AssetDetail'

export default function App() {
  const {
    filteredAssets, loading, lastUpdate, activeCategory, setActiveCategory,
    searchQuery, setSearchQuery, sortBy, setSortBy, watchlist, toggleWatchlist,
    refresh, categoryCounts,
  } = useMarketData()

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  return (
    <div style={{
      width: '100%', height: '100vh',
      background: 'linear-gradient(180deg, #0f1117 0%, #0c0e13 100%)',
      color: '#e5e7eb',
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', borderRadius: 12,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: transparent; overflow: hidden; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      <TitleBar loading={loading} lastUpdate={lastUpdate} onRefresh={refresh} />

      <div style={{ padding: '12px 0 0', flexShrink: 0 }}>
        <CategoryTabs active={activeCategory} counts={categoryCounts} onChange={setActiveCategory} />
      </div>

      <div style={{ padding: '10px 0', flexShrink: 0 }}>
        <SearchBar query={searchQuery} onQueryChange={setSearchQuery} sortBy={sortBy} onSortChange={setSortBy} />
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '28px 1fr 90px 72px 64px 28px', gap: 6,
        padding: '0 14px 8px', fontSize: 9, fontWeight: 700, color: '#374151', letterSpacing: 1.2,
        fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
      }}>
        <span></span><span>Asset</span>
        <span style={{ textAlign: 'right' }}>Price</span>
        <span style={{ textAlign: 'right' }}>24h</span>
        <span style={{ textAlign: 'center' }}>7d</span><span></span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {loading && filteredAssets.length === 0 ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{
              height: 48, margin: '3px 14px', borderRadius: 8,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.02) 75%)',
              backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease infinite',
            }} />
          ))
        ) : filteredAssets.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#374151', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
            {searchQuery ? `No results for "${searchQuery}"` : 'No assets in this category'}
          </div>
        ) : (
          filteredAssets.map((asset, idx) => (
            <AssetRow key={asset.id} asset={asset} isWatched={watchlist.has(asset.id)}
              onToggleWatch={() => toggleWatchlist(asset.id)}
              onClick={() => setSelectedAsset(asset)} index={idx} />
          ))
        )}
      </div>

      <div style={{
        padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.04)',
        fontSize: 9, color: '#2d3748', fontFamily: "'JetBrains Mono', monospace", textAlign: 'center', flexShrink: 0,
      }}>Live data · CoinGecko + Yahoo Finance · Backend :3001</div>

      {selectedAsset && (
        <AssetDetail asset={selectedAsset} isWatched={watchlist.has(selectedAsset.id)}
          onToggleWatch={() => toggleWatchlist(selectedAsset.id)}
          onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  )
}
