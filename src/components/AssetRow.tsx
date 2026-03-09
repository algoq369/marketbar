import React from 'react'
import type { Asset } from '../types'
import { Sparkline } from './Sparkline'
import { fmtPrice, fmtPct, getChangeColor, getChangeBg, getCategoryEmoji } from '../utils/helpers'

interface AssetRowProps {
  asset: Asset
  isWatched: boolean
  onToggleWatch: () => void
  onClick: () => void
  index: number
}

export const AssetRow: React.FC<AssetRowProps> = ({ asset, isWatched, onToggleWatch, onClick, index }) => {
  const pct = asset.price_change_percentage_24h
  const color = getChangeColor(pct)
  const sparkData = asset.sparkline_in_7d?.price || []

  return (
    <div onClick={onClick} style={{
      display: 'grid', gridTemplateColumns: '28px 1fr 90px 72px 64px 28px',
      gap: 6, alignItems: 'center', padding: '10px 14px', cursor: 'pointer',
      borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.12s',
      animation: `fadeInUp ${0.15 + index * 0.02}s ease both`,
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {asset.image ? (
          <img src={asset.image} alt="" style={{ width: 22, height: 22, borderRadius: 11 }} />
        ) : (
          <div style={{
            width: 22, height: 22, borderRadius: 11,
            background: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.05))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
          }}>{getCategoryEmoji(asset.category)}</div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f1f3', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
        <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>{asset.symbol}</div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#f0f1f3', fontFamily: "'JetBrains Mono', monospace" }}>{fmtPrice(asset.current_price)}</div>
      <div style={{ textAlign: 'right' }}>
        <span style={{
          display: 'inline-block', padding: '2px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace", color, background: getChangeBg(pct),
        }}>{fmtPct(pct)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Sparkline data={sparkData} color={color} width={56} height={20} />
      </div>
      <button onClick={(e) => { e.stopPropagation(); onToggleWatch() }} style={{
        background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
        color: isWatched ? '#fbbf24' : '#374151', padding: 2, transition: 'all 0.15s',
        transform: isWatched ? 'scale(1.1)' : 'scale(1)',
      }}>{isWatched ? '★' : '☆'}</button>
    </div>
  )
}
