'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getBulkQuotes, getMarketNews, getEarningsCalendar, getEconomicCalendar, analyzeSentiment, fmt, fmtPct, fmtB, timeAgo } from '@/lib/api';

const SECTORS = [
  { symbol: 'XLK', label: 'Tech' }, { symbol: 'XLF', label: 'Finance' },
  { symbol: 'XLV', label: 'Health' }, { symbol: 'XLY', label: 'Consumer' },
  { symbol: 'XLE', label: 'Energy' }, { symbol: 'XLI', label: 'Industrial' },
  { symbol: 'XLC', label: 'Comms' }, { symbol: 'XLRE', label: 'RealEst' },
  { symbol: 'XLP', label: 'Staples' }, { symbol: 'XLU', label: 'Utility' },
  { symbol: 'XLB', label: 'Materials' },
];

const TOP_STOCKS = ['AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','JPM','V','WMT','UNH','JNJ','XOM','PG','MA','HD','COST','ABBV','CRM','AMD'];

export default function Dashboard() {
  const { setActiveSymbol, setActivePage } = useStore();
  const [sectorData, setSectorData] = useState({});
  const [stockData, setStockData] = useState({});
  const [news, setNews] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [econCal, setEconCal] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [sectors, stocks, newsData, earningsData, econData] = await Promise.allSettled([
        getBulkQuotes(SECTORS.map(s => s.symbol)),
        getBulkQuotes(TOP_STOCKS),
        getMarketNews('general'),
        getEarningsCalendar(),
        getEconomicCalendar(),
      ]);
      setSectorData(sectors.value || {});
      setStockData(stocks.value || {});
      setNews((newsData.value || []).slice(0, 20));
      setEarnings((earningsData.value?.earningsCalendar || []).slice(0, 12));
      setEconCal((econData.value?.economicCalendar?.result || []).slice(0, 10));
      setLoading(false);
    };
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  const goTo = (symbol, page = 'chart') => { setActiveSymbol(symbol); setActivePage(page); };

  const sorted = Object.entries(stockData).filter(([_, q]) => q?.dp != null).sort((a, b) => b[1].dp - a[1].dp);
  const gainers = sorted.slice(0, 5);
  const losers = sorted.slice(-5).reverse();

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 6 }} />)}
    </div>
  );

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* SECTOR HEATMAP */}
      <div className="panel">
        <div className="panel-header"><span className="panel-title">Sector Performance</span></div>
        <div style={{ padding: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))', gap: 4 }}>
          {SECTORS.map(sec => {
            const q = sectorData[sec.symbol]; const chg = q?.dp ?? 0;
            const bg = chg >= 0 ? `rgba(38,166,154,${Math.min(Math.abs(chg)*0.12,0.45)})` : `rgba(239,83,80,${Math.min(Math.abs(chg)*0.12,0.45)})`;
            return (
              <div key={sec.symbol} onClick={() => goTo(sec.symbol)} className="cursor-pointer"
                style={{ background: bg, border: '1px solid var(--border)', borderRadius: 4, padding: '8px 5px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{sec.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }} className={chg >= 0 ? 'positive' : 'negative'}>{fmtPct(chg)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* TOP GAINERS */}
        <div className="panel">
          <div className="panel-header"><span className="panel-title" style={{ color: 'var(--green)' }}>▲ Gainers</span></div>
          <div className="panel-body no-pad">
            {gainers.map(([s, q]) => (
              <div key={s} className="wl-row" onClick={() => goTo(s)}>
                <span className="wl-symbol">{s}</span>
                <span className="wl-price">{fmt(q.c)}</span>
                <span className="wl-change positive" style={{ fontWeight: 700 }}>{fmtPct(q.dp)}</span>
              </div>
            ))}
          </div>
        </div>
        {/* TOP LOSERS */}
        <div className="panel">
          <div className="panel-header"><span className="panel-title" style={{ color: 'var(--red)' }}>▼ Losers</span></div>
          <div className="panel-body no-pad">
            {losers.map(([s, q]) => (
              <div key={s} className="wl-row" onClick={() => goTo(s)}>
                <span className="wl-symbol">{s}</span>
                <span className="wl-price">{fmt(q.c)}</span>
                <span className="wl-change negative" style={{ fontWeight: 700 }}>{fmtPct(q.dp)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
        {/* NEWS */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Market News</span>
            <button className="btn btn-sm" onClick={() => setActivePage('news')}>All</button>
          </div>
          <div className="panel-body no-pad" style={{ maxHeight: 320 }}>
            {news.map((n, i) => {
              const sent = analyzeSentiment(n.headline, n.source);
              return (
                <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <div className="wl-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: '6px 10px' }}>
                    <div className="flex items-center gap-4 w-full">
                      <span className="badge" style={{ background: sent.bg, color: sent.color }}>{sent.label}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-4)', marginLeft: 'auto' }}>{n.source} · {timeAgo(n.datetime)}</span>
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--text-1)', lineHeight: 1.35 }}>{n.headline}</span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
        {/* EARNINGS */}
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Earnings</span></div>
          <div className="panel-body no-pad" style={{ maxHeight: 320 }}>
            {earnings.map((e, i) => (
              <div key={i} className="wl-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} onClick={() => goTo(e.symbol)}>
                <div className="flex items-center gap-4 w-full">
                  <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{e.symbol}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{e.date}</span>
                  <span className="badge badge-amber" style={{ marginLeft: 'auto', fontSize: 8 }}>{e.hour === 'bmo' ? 'BMO' : e.hour === 'amc' ? 'AMC' : '—'}</span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>EPS Est: {e.epsEstimate ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ECONOMIC CALENDAR */}
      <div className="panel">
        <div className="panel-header"><span className="panel-title">Economic Calendar</span></div>
        <div className="panel-body no-pad">
          <table className="data-table">
            <thead><tr><th>Event</th><th>Country</th><th>Date</th><th>Impact</th><th>Prev</th><th>Est</th><th>Actual</th></tr></thead>
            <tbody>
              {econCal.map((e, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-1)', maxWidth: 180 }} className="truncate">{e.event}</td>
                  <td>{e.country}</td>
                  <td style={{ fontSize: 9 }}>{e.date}</td>
                  <td><span className={`badge ${e.impact === 'high' ? 'badge-red' : e.impact === 'medium' ? 'badge-amber' : 'badge-gray'}`}>{(e.impact||'low').toUpperCase()}</span></td>
                  <td className="tabular">{e.prev ?? '—'}</td>
                  <td className="tabular">{e.estimate ?? '—'}</td>
                  <td className="tabular" style={{ fontWeight: 600 }}>{e.actual ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
