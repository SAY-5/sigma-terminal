'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getCompanyNews, getMarketNews, analyzeSentiment, getNewsImpact, timeAgo } from '@/lib/api';

export default function NewsPage() {
  const { activeSymbol } = useStore();
  const [news, setNews] = useState([]);
  const [filter, setFilter] = useState('company');
  const [sentFilter, setSentFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      const data = filter === 'company' ? await getCompanyNews(activeSymbol) : await getMarketNews('general');
      setNews((data || []).slice(0, 50));
      setLoading(false);
    };
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, [activeSymbol, filter]);

  const filtered = news.filter(n => {
    if (sentFilter === 'all') return true;
    return analyzeSentiment(n.headline, n.source).label === sentFilter.toUpperCase();
  });

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      <div style={{ padding: '6px 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="panel-title">News Feed</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {['company', 'market'].map(f => (
            <button key={f} className={`chart-tf-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'company' ? activeSymbol : 'Market'}
            </button>
          ))}
          <div className="chart-divider" />
          {['all', 'bullish', 'bearish', 'neutral'].map(s => (
            <button key={s} className={`chart-tf-btn ${sentFilter === s ? 'active' : ''}`} onClick={() => setSentFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
        {loading ? (
          <div style={{ padding: 16 }}>{[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 4, borderRadius: 4 }} />)}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>No news found</div>
        ) : (
          filtered.map((n, i) => {
            const sent = analyzeSentiment(n.headline, n.source);
            const impact = getNewsImpact(n.headline, n.source);
            const tierStars = '●'.repeat(sent.tier) + '○'.repeat(3 - sent.tier);
            return (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(26,26,37,0.4)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="flex items-center gap-4" style={{ marginBottom: 3 }}>
                    <span className="badge" style={{ background: sent.bg, color: sent.color }}>{sent.label}</span>
                    <span className={`badge ${impact === 'HIGH' ? 'badge-red' : impact === 'MEDIUM' ? 'badge-amber' : 'badge-gray'}`} style={{ fontSize: 8 }}>{impact}</span>
                    <span style={{ fontSize: 8, color: 'var(--text-4)' }} title="Source quality">{tierStars}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-4)', marginLeft: 'auto' }}>{n.source} · {timeAgo(n.datetime)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-1)', lineHeight: 1.4 }}>{n.headline}</div>
                  {n.summary && <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.3, maxHeight: 28, overflow: 'hidden' }}>{n.summary}</div>}
                </div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
