import React from 'react'
import type { SortKey } from '../types'

interface SearchBarProps {
  query: string
  onQueryChange: (q: string) => void
  sortBy: SortKey
  onSortChange: (key: SortKey) => void
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'A-Z' },
  { key: 'price', label: '$' },
  { key: 'change', label: '%' },
]

export const SearchBar: React.FC<SearchBarProps> = ({ query, onQueryChange, sortBy, onSortChange }) => {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 14px', alignItems: 'center', flexShrink: 0 }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4b5563', fontSize: 13, pointerEvents: 'none' }}>⌕</span>
        <input type="text" placeholder="Search assets..." value={query} onChange={(e) => onQueryChange(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px 8px 30px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)',
            color: '#e5e7eb', fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(52,211,153,0.3)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
        />
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {SORT_OPTIONS.map((s) => (
          <button key={s.key} onClick={() => onSortChange(s.key)} style={{
            padding: '6px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            color: sortBy === s.key ? '#34d399' : '#6b7280',
            background: sortBy === s.key ? 'rgba(52,211,153,0.1)' : 'transparent',
            border: `1px solid ${sortBy === s.key ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.04)'}`,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>{s.label}</button>
        ))}
      </div>
    </div>
  )
}
