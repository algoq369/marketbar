export function fmt(n: number | null, decimals = 2): string {
  if (n == null) return '—'
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + 'T'
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  if (n >= 10000) return '$' + fmt(n, 0)
  if (n >= 1000) return '$' + fmt(n, 2)
  if (n >= 1) return '$' + fmt(n, 2)
  if (n >= 0.01) return '$' + n.toFixed(4)
  return '$' + n.toFixed(6)
}

export function fmtPct(n: number | null): string {
  if (n == null) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

export function fmtCompact(n: number | null): string {
  if (n == null) return '—'
  return '$' + fmt(n, 0)
}

export function getChangeColor(pct: number | null): string {
  if (pct == null) return '#6b7280'
  if (pct > 0) return '#34d399'
  if (pct < 0) return '#f87171'
  return '#6b7280'
}

export function getChangeBg(pct: number | null): string {
  if (pct == null) return 'rgba(255,255,255,0.04)'
  if (pct > 0) return 'rgba(52,211,153,0.1)'
  if (pct < 0) return 'rgba(248,113,113,0.1)'
  return 'rgba(255,255,255,0.04)'
}

export function generateSparkline(base: number, volatility: number, points = 48): number[] {
  const data = [base]
  for (let i = 1; i < points; i++) {
    const change = (Math.random() - 0.48) * volatility
    data.push(data[i - 1] + change)
  }
  return data
}

export function getCategoryEmoji(cat: string): string {
  switch (cat) {
    case 'indices': return '📊'
    case 'commodities': return '🪙'
    case 'crypto': return '🔗'
    default: return '📈'
  }
}

export function buildTickerString(
  items: { symbol: string; current_price: number; price_change_percentage_24h: number | null }[]
): string {
  if (items.length === 0) return ''
  return items
    .slice(0, 4)
    .map((item) => {
      const price =
        item.current_price >= 1000
          ? Math.round(item.current_price).toLocaleString()
          : item.current_price >= 1
          ? item.current_price.toFixed(2)
          : item.current_price.toFixed(4)
      const pct = item.price_change_percentage_24h
      const arrow = pct != null ? (pct >= 0 ? '▲' : '▼') : ''
      const pctStr = pct != null ? Math.abs(pct).toFixed(1) + '%' : ''
      return `${item.symbol} $${price} ${arrow}${pctStr}`
    })
    .join('  ·  ')
}
