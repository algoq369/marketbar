import React from 'react'
import type { ViewCategory } from '../types'
import { CATEGORY_CONFIG } from '../utils/constants'

interface CategoryTabsProps {
  active: ViewCategory
  counts: Record<ViewCategory, number>
  onChange: (cat: ViewCategory) => void
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ active, counts, onChange }) => {
  const categories = Object.entries(CATEGORY_CONFIG) as [ViewCategory, { label: string; icon: string }][]
  return (
    <div style={{ display: 'flex', gap: 4, padding: '0 14px', overflowX: 'auto', flexShrink: 0 }}>
      {categories.map(([key, { label, icon }]) => {
        const isActive = active === key
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif", color: isActive ? '#f0f1f3' : '#6b7280',
            background: isActive ? 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.06))' : 'transparent',
            border: isActive ? '1px solid rgba(52,211,153,0.2)' : '1px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 12 }}>{icon}</span>
            {label}
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 5,
              background: isActive ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.05)',
              color: isActive ? '#34d399' : '#6b7280', fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
            }}>{counts[key]}</span>
          </button>
        )
      })}
    </div>
  )
}
