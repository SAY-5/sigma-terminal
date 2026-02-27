'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getProfile, getFinancials, getEarnings, getRecommendations, getPriceTarget, getInsiderTransactions, getPeers, getSECFilings, getQuote, getBulkQuotes, fmt, fmtPct, fmtB, timeAgo } from '@/lib/api';

const TABS = ['Overview', 'Earnings', 'Ownership', 'Peers', 'Filings', 'Ratings'];

export default function CompanyPage() {
  const { activeSymbol, setActiveSymbol, setActivePage } = useStore();
  const [tab, setTab] = useState('Overview');
  const [profile, setProfile] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [recs, setRecs] = useState([]);
  const [pt, setPt] = useState(null);
  const [insiders, setInsiders] = useState([]);
  const [peers, setPeers] = useState([]);
  const [peerQuotes, setPeerQuotes] = useState({});
  const [filings, setFilings] = useState([]);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      const [p, f, e, r, pt2, ins, pe, fil, q] = await Promise.allSettled([
        getProfile(activeSymbol), getFinancials(activeSymbol), getEarnings(activeSymbol),
        getRecommendations(activeSymbol), getPriceTarget(activeSymbol),
        getInsiderTransactions(activeSymbol), getPeers(activeSymbol),
        getSECFilings(activeSymbol), getQuote(activeSymbol),
      ]);
      setProfile(p.value || null); setFinancials(f.value || null);
      setEarnings(e.value || []); setRecs((r.value || []).slice(0, 12));
      setPt(pt2.value || null); setInsiders((ins.value?.data || []).slice(0, 30));
      const peerList = (pe.value || []).slice(0, 8);
      setPeers(peerList);
      if (peerList.length) {
        const pq = await getBulkQuotes(peerList);
        setPeerQuotes(pq);
      }
      setFilings((fil.value || []).slice(0, 20)); setQuote(q.value || null);
      setLoading(false);
    };
    load();
  }, [activeSymbol]);

  const m = financials?.metric || {};
  const chg = quote?.dp ?? 0;

  if (loading) return <div className="fade-in" style={{ padding: 16 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 8, borderRadius: 6 }} />)}</div>;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Company Header */}
      <div style={{ padding: '10px 16px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        {profile?.logo && <img src={profile.logo} alt="" style={{ width: 28, height: 28, borderRadius: 4, background: '#fff' }} />}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-0)' }}>{profile?.name || activeSymbol}</span>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{profile?.ticker} · {profile?.exchange}</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{profile?.finnhubIndustry} · {profile?.country}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-0)' }}>{fmt(quote?.c)}</div>
          <span className={chg >= 0 ? 'positive' : 'negative'} style={{ fontSize: 11, fontWeight: 600 }}>{fmtPct(chg)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">{TABS.map(t => <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</div>)}</div>

      <div style={{ padding: 12, overflow: 'auto', flex: 1 }}>
        {/* OVERVIEW */}
        {tab === 'Overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {profile?.description && (
              <div className="card"><div style={{ fontSize: 10.5, color: 'var(--text-2)', lineHeight: 1.5, maxHeight: 60, overflow: 'hidden' }}>{profile.description}</div></div>
            )}
            <div className="stat-grid stat-grid-4">
              {[
                ['Mkt Cap', fmtB(profile?.marketCapitalization * 1e6)], ['P/E TTM', fmt(m['peBasicExclExtraTTM'])],
                ['P/E Fwd', fmt(m['peTTM'])], ['P/B', fmt(m['pbQuarterly'])],
                ['P/S', fmt(m['psTTM'])], ['EV/EBITDA', fmt(m['currentEv/freeCashFlowTTM'])],
                ['Div Yield', fmtPct(m['dividendYieldIndicatedAnnual'])], ['Beta', fmt(m['beta'])],
                ['52W High', fmt(m['52WeekHigh'])], ['52W Low', fmt(m['52WeekLow'])],
                ['EPS TTM', fmt(m['epsBasicExclExtraItemsTTM'])], ['ROE', fmtPct(m['roeTTM'])],
                ['Gross Margin', fmtPct(m['grossMarginTTM'])], ['Op Margin', fmtPct(m['operatingMarginTTM'])],
                ['Net Margin', fmtPct(m['netProfitMarginTTM'])], ['D/E', fmt(m['totalDebt/totalEquityQuarterly'])],
                ['Rev Growth', fmtPct(m['revenueGrowthQuarterlyYoy'])], ['EPS Growth', fmtPct(m['epsGrowthQuarterlyYoy'])],
                ['Book Value', fmt(m['bookValuePerShareQuarterly'])], ['Revenue/Share', fmt(m['revenuePerShareTTM'])],
              ].map(([label, val]) => (
                <div key={label} className="stat-item">
                  <span className="stat-label">{label}</span>
                  <span className="stat-value">{val}</span>
                </div>
              ))}
            </div>
            {/* Price Target */}
            {pt && (
              <div className="card">
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 4 }}>ANALYST PRICE TARGET</div>
                <div className="flex items-center gap-12">
                  <div><span className="stat-label">Low</span><br/><span className="stat-value negative">{fmt(pt.targetLow)}</span></div>
                  <div><span className="stat-label">Mean</span><br/><span className="stat-value" style={{ color: 'var(--amber)', fontSize: 16 }}>{fmt(pt.targetMean)}</span></div>
                  <div><span className="stat-label">High</span><br/><span className="stat-value positive">{fmt(pt.targetHigh)}</span></div>
                  <div><span className="stat-label">Median</span><br/><span className="stat-value">{fmt(pt.targetMedian)}</span></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EARNINGS */}
        {tab === 'Earnings' && (
          <div>
            <table className="data-table">
              <thead><tr><th>Period</th><th>Date</th><th>EPS Actual</th><th>EPS Est</th><th>Surprise</th><th>Rev Actual</th><th>Rev Est</th></tr></thead>
              <tbody>
                {earnings.map((e, i) => {
                  const beat = e.actual > e.estimate;
                  return (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-1)' }}>{e.period}</td>
                      <td>{e.period}</td>
                      <td style={{ fontWeight: 600 }} className={beat ? 'positive' : 'negative'}>{fmt(e.actual)}</td>
                      <td>{fmt(e.estimate)}</td>
                      <td className={e.surprisePercent >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 600 }}>{fmtPct(e.surprisePercent)}</td>
                      <td>{e.revenueActual ? fmtB(e.revenueActual) : '—'}</td>
                      <td>{e.revenueEstimate ? fmtB(e.revenueEstimate) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* OWNERSHIP / INSIDERS */}
        {tab === 'Ownership' && (
          <div>
            <div className="panel-title" style={{ marginBottom: 8 }}>Insider Transactions</div>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Title</th><th>Date</th><th>Type</th><th>Shares</th><th>Price</th><th>Value</th></tr></thead>
              <tbody>
                {insiders.map((t, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-1)' }}>{t.name}</td>
                    <td style={{ fontSize: 9 }}>{t.transactionType}</td>
                    <td>{t.transactionDate}</td>
                    <td><span className={`badge ${t.change > 0 ? 'badge-green' : 'badge-red'}`}>{t.change > 0 ? 'BUY' : 'SELL'}</span></td>
                    <td className="tabular">{Math.abs(t.change || 0).toLocaleString()}</td>
                    <td className="tabular">{fmt(t.transactionPrice)}</td>
                    <td className="tabular">{fmtB(Math.abs((t.change || 0) * (t.transactionPrice || 0)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PEERS */}
        {tab === 'Peers' && (
          <div>
            <table className="data-table">
              <thead><tr><th>Ticker</th><th>Price</th><th>Change</th></tr></thead>
              <tbody>
                {peers.map(p => {
                  const q = peerQuotes[p];
                  return (
                    <tr key={p} onClick={() => { setActiveSymbol(p); }}>
                      <td style={{ fontWeight: 600, color: 'var(--amber)' }}>{p}</td>
                      <td className="tabular">{fmt(q?.c)}</td>
                      <td className={`tabular ${(q?.dp ?? 0) >= 0 ? 'positive' : 'negative'}`}>{fmtPct(q?.dp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* SEC FILINGS */}
        {tab === 'Filings' && (
          <div>
            <table className="data-table">
              <thead><tr><th>Type</th><th>Date</th><th>Link</th></tr></thead>
              <tbody>
                {filings.map((f, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-blue">{f.form}</span></td>
                    <td>{f.filedDate || f.acceptedDate}</td>
                    <td><a href={f.reportUrl || f.filingUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>View →</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ANALYST RATINGS */}
        {tab === 'Ratings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recs.length > 0 && (
              <div className="card">
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 8 }}>RECOMMENDATION TREND</div>
                <table className="data-table">
                  <thead><tr><th>Period</th><th style={{ color: 'var(--green)' }}>Strong Buy</th><th style={{ color: '#4ade80' }}>Buy</th><th>Hold</th><th style={{ color: '#fb923c' }}>Sell</th><th style={{ color: 'var(--red)' }}>Strong Sell</th></tr></thead>
                  <tbody>
                    {recs.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-1)' }}>{r.period}</td>
                        <td className="positive" style={{ fontWeight: 600 }}>{r.strongBuy}</td>
                        <td style={{ color: '#4ade80' }}>{r.buy}</td>
                        <td>{r.hold}</td>
                        <td style={{ color: '#fb923c' }}>{r.sell}</td>
                        <td className="negative" style={{ fontWeight: 600 }}>{r.strongSell}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {recs[0] && (() => {
              const latest = recs[0];
              const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
              const buyPct = total ? ((latest.strongBuy + latest.buy) / total * 100) : 0;
              const holdPct = total ? (latest.hold / total * 100) : 0;
              const sellPct = total ? ((latest.sell + latest.strongSell) / total * 100) : 0;
              return (
                <div className="card">
                  <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 6 }}>CONSENSUS</div>
                  <div className="flex gap-4" style={{ height: 8, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${buyPct}%`, background: 'var(--green)' }} />
                    <div style={{ width: `${holdPct}%`, background: 'var(--amber)' }} />
                    <div style={{ width: `${sellPct}%`, background: 'var(--red)' }} />
                  </div>
                  <div className="flex justify-between" style={{ marginTop: 4, fontSize: 9 }}>
                    <span className="positive">Buy {buyPct.toFixed(0)}%</span>
                    <span style={{ color: 'var(--amber)' }}>Hold {holdPct.toFixed(0)}%</span>
                    <span className="negative">Sell {sellPct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
