'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getEarningsCalendar, getEconomicCalendar, getIPOCalendar, getForexRates, getBulkQuotes, fmt, fmtPct, fmtB } from '@/lib/api';

const FX_PAIRS = ['OANDA:EUR_USD','OANDA:GBP_USD','OANDA:USD_JPY','OANDA:USD_CHF','OANDA:AUD_USD','OANDA:USD_CAD','OANDA:NZD_USD'];
const FX_LABELS = { 'OANDA:EUR_USD': 'EUR/USD', 'OANDA:GBP_USD': 'GBP/USD', 'OANDA:USD_JPY': 'USD/JPY', 'OANDA:USD_CHF': 'USD/CHF', 'OANDA:AUD_USD': 'AUD/USD', 'OANDA:USD_CAD': 'USD/CAD', 'OANDA:NZD_USD': 'NZD/USD' };

export default function MacroPage() {
  const { setActiveSymbol, setActivePage } = useStore();
  const [tab, setTab] = useState('earnings');
  const [earnings, setEarnings] = useState([]);
  const [econCal, setEconCal] = useState([]);
  const [ipos, setIpos] = useState([]);
  const [fxQuotes, setFxQuotes] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [e, ec, ip, fx] = await Promise.allSettled([
        getEarningsCalendar(), getEconomicCalendar(), getIPOCalendar(), getBulkQuotes(FX_PAIRS),
      ]);
      setEarnings((e.value?.earningsCalendar || []).slice(0, 40));
      setEconCal((ec.value?.economicCalendar?.result || []).slice(0, 30));
      setIpos((ip.value?.ipoCalendar || []).slice(0, 20));
      setFxQuotes(fx.value || {});
      setLoading(false);
    };
    load();
  }, []);

  const tabs = ['earnings', 'economic', 'ipo', 'forex'];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="tabs">
        {tabs.map(t => <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</div>)}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 12 }}>{[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 30, marginBottom: 4, borderRadius: 4 }} />)}</div>
        ) : (
          <>
            {tab === 'earnings' && (
              <table className="data-table">
                <thead><tr><th>Symbol</th><th>Date</th><th>Time</th><th>EPS Est</th><th>Rev Est</th><th>Year</th></tr></thead>
                <tbody>
                  {earnings.map((e, i) => (
                    <tr key={i} onClick={() => { setActiveSymbol(e.symbol); setActivePage('chart'); }}>
                      <td style={{ fontWeight: 600, color: 'var(--amber)' }}>{e.symbol}</td>
                      <td>{e.date}</td>
                      <td><span className="badge badge-amber" style={{ fontSize: 8 }}>{e.hour === 'bmo' ? 'BMO' : e.hour === 'amc' ? 'AMC' : e.hour || '—'}</span></td>
                      <td className="tabular">{e.epsEstimate ?? '—'}</td>
                      <td className="tabular">{e.revenueEstimate ? fmtB(e.revenueEstimate) : '—'}</td>
                      <td>{e.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'economic' && (
              <table className="data-table">
                <thead><tr><th>Event</th><th>Country</th><th>Date</th><th>Impact</th><th>Prev</th><th>Est</th><th>Actual</th></tr></thead>
                <tbody>
                  {econCal.map((e, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-1)', maxWidth: 200 }} className="truncate">{e.event}</td>
                      <td>{e.country}</td>
                      <td style={{ fontSize: 9 }}>{e.date}</td>
                      <td><span className={`badge ${e.impact === 'high' ? 'badge-red' : e.impact === 'medium' ? 'badge-amber' : 'badge-gray'}`}>{(e.impact || 'low').toUpperCase()}</span></td>
                      <td className="tabular">{e.prev ?? '—'}</td>
                      <td className="tabular">{e.estimate ?? '—'}</td>
                      <td className="tabular" style={{ fontWeight: 600 }}>{e.actual ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'ipo' && (
              <table className="data-table">
                <thead><tr><th>Company</th><th>Symbol</th><th>Date</th><th>Shares</th><th>Price Range</th><th>Status</th></tr></thead>
                <tbody>
                  {ipos.map((e, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-1)' }}>{e.name}</td>
                      <td style={{ fontWeight: 600, color: 'var(--amber)' }}>{e.symbol}</td>
                      <td>{e.date}</td>
                      <td className="tabular">{e.numberOfShares ? fmtB(e.numberOfShares) : '—'}</td>
                      <td className="tabular">${e.price || '—'}</td>
                      <td><span className="badge badge-blue">{e.status || 'Upcoming'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'forex' && (
              <div style={{ padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                  {FX_PAIRS.map(pair => {
                    const q = fxQuotes[pair];
                    const chg = q?.dp ?? 0;
                    return (
                      <div key={pair} className="card" onClick={() => { setActiveSymbol(pair); setActivePage('chart'); }} style={{ cursor: 'pointer' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>{FX_LABELS[pair]}</div>
                        <div className="flex items-center justify-between">
                          <span style={{ fontSize: 16, fontWeight: 700 }}>{q ? fmt(q.c, 4) : '—'}</span>
                          <span className={chg >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 600 }}>{fmtPct(chg)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
