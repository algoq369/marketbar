import React, { useState, useEffect } from 'react'

interface TitleBarProps {
  loading: boolean
  lastUpdate: Date | null
  onRefresh: () => void
}

export const TitleBar: React.FC<TitleBarProps> = ({ loading, lastUpdate, onRefresh }) => {
  const [backendOk, setBackendOk] = useState(false)

  useEffect(() => {
    const check = () => {
      fetch('http://localhost:3001/api/health')
        .then(r => { setBackendOk(r.ok) })
        .catch(() => setBackendOk(false))
    }
    check()
    const i = setInterval(check, 30000)
    return () => clearInterval(i)
  }, [])

  return (
    <div style={{
      height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      WebkitAppRegion: 'drag' as any, userSelect: 'none', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#34d399', fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>◈</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e5e7eb', letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace" }}>MARKETBAR</span>
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
          padding: '2px 6px', borderRadius: 4,
          color: backendOk ? '#34d399' : '#f87171',
          background: backendOk ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {backendOk ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' as any }}>
        {loading ? (
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1s ease infinite' }} />
        ) : (
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.4)' }} />
        )}
        <span style={{ fontSize: 10, color: '#6b7280', fontFamily: "'JetBrains Mono', monospace" }}>
          {lastUpdate ? lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
        <button onClick={onRefresh} disabled={loading} style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
          color: '#9ca3af', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13,
          padding: '4px 8px', borderRadius: 6, opacity: loading ? 0.4 : 1,
          transition: 'all 0.15s', fontFamily: "'JetBrains Mono', monospace",
        }}>↻</button>
      </div>
    </div>
  )
}
