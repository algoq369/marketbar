import React from 'react'
import type { Asset } from '../types'
import { Sparkline } from './Sparkline'
import { fmtPrice, fmtPct, fmtCompact, getChangeColor } from '../utils/helpers'

interface AssetDetailProps {
  asset: Asset
  isWatched: boolean
  onToggleWatch: () => void
  onClose: () => void
}

export const AssetDetail: React.FC<AssetDetailProps> = ({ asset, isWatched, onToggleWatch, onClose }) => {
  const pct = asset.price_change_percentage_24h
  const color = getChangeColor(pct)
  const sparkData = asset.sparkline_in_7d?.price || []

  const statCards = [
    asset.market_cap ? { label: 'MKT CAP', value: fmtCompact(asset.market_cap) } : null,
    asset.total_volume ? { label: '24H VOL', value: fmtCompact(asset.total_volume) } : null,
    asset.high_24h ? { label: '24H HIGH', value: fmtPrice(asset.high_24h) } : null,
    asset.low_24h ? { label: '24H LOW', value: fmtPrice(asset.low_24h) } : null,
    sparkData.length ? { label: '7D HIGH', value: fmtPrice(Math.max(...sparkData)) } : null,
    sparkData.length ? { label: '7D LOW', value: fmtPrice(Math.min(...sparkData)) } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #0f1117 0%, #0c0e13 100%)', zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 16px 0', flexShrink: 0 }}>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
          color: '#9ca3af', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace",
        }}>←</button>
        <button onClick={onToggleWatch} style={{
          background: isWatched ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isWatched ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)'}`,
          color: isWatched ? '#fbbf24' : '#6b7280', padding: '6px 12px', borderRadius: 8,
          cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
          display: 'flex', alignItems: 'center', gap: 4,
        }}>{isWatched ? '★ Watching' : '☆ Watch'}</button>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {asset.image && <img src={asset.image} alt="" style={{ width: 32, height: 32, borderRadius: 16 }} />}
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, letterSpacing: 1.2, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', marginBottom: 2 }}>{asset.symbol} · {asset.category}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', fontFamily: "'DM Sans', sans-serif" }}>{asset.name}</div>
          </div>
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', fontFamily: "'JetBrains Mono', monospace", marginTop: 16, letterSpacing: -1 }}>{fmtPrice(asset.current_price)}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{pct != null ? (pct >= 0 ? '▲ ' : '▼ ') : ''}{fmtPct(pct)}</span>
          <span style={{ color: '#4b5563', fontWeight: 400, fontSize: 12 }}>24h</span>
        </div>
      </div>

      {sparkData.length > 2 && (
        <div style={{ margin: '20px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '16px 12px', border: '1px solid rgba(255,255,255,0.04)' }}>
          <Sparkline data={sparkData} color={color} width={356} height={100} />
        </div>
      )}

      {statCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px', marginBottom: 20 }}>
          {statCards.map((stat) => (
            <div key={stat.label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 9, color: '#4b5563', fontWeight: 700, letterSpacing: 1, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>{stat.label}</div>
              <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
