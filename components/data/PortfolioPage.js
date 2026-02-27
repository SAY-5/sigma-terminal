'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getBulkQuotes, fmt, fmtPct, fmtB } from '@/lib/api';

export default function PortfolioPage() {
  const { portfolio, addPosition, removePosition, alerts, addAlert, removeAlert, alertHistory, setActiveSymbol, setActivePage } = useStore();
  const [quotes, setQuotes] = useState({});
  const [tab, setTab] = useState('positions');
  const [form, setForm] = useState({ symbol: '', shares: '', price: '', date: '' });
  const [alertForm, setAlertForm] = useState({ symbol: '', price: '', type: 'above' });

  const symbols = [...new Set(portfolio.map(p => p.symbol))];
  useEffect(() => {
    if (symbols.length === 0) return;
    const load = async () => { const q = await getBulkQuotes(symbols); setQuotes(q); };
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, [symbols.join(',')]);

  const addPos = () => {
    if (!form.symbol || !form.shares || !form.price) return;
    addPosition({ symbol: form.symbol.toUpperCase(), shares: parseFloat(form.shares), entryPrice: parseFloat(form.price), date: form.date || new Date().toISOString().split('T')[0] });
    setForm({ symbol: '', shares: '', price: '', date: '' });
  };

  const addAlertFn = () => {
    if (!alertForm.symbol || !alertForm.price) return;
    addAlert({ symbol: alertForm.symbol.toUpperCase(), targetPrice: parseFloat(alertForm.price), type: alertForm.type });
    setAlertForm({ symbol: '', price: '', type: 'above' });
  };

  // Portfolio stats
  let totalValue = 0, totalCost = 0;
  const positions = portfolio.map(p => {
    const q = quotes[p.symbol];
    const current = q?.c ?? p.entryPrice;
    const mv = current * p.shares;
    const cost = p.entryPrice * p.shares;
    const pnl = mv - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    totalValue += mv; totalCost += cost;
    return { ...p, current, mv, cost, pnl, pnlPct, chg: q?.dp ?? 0 };
  });
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // Allocation by symbol
  const alloc = {};
  positions.forEach(p => { alloc[p.symbol] = (alloc[p.symbol] || 0) + p.mv; });

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="tabs">
        {['positions', 'alerts', 'history'].map(t => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {tab === 'positions' && (
          <>
            {/* Summary */}
            <div className="stat-grid stat-grid-4" style={{ marginBottom: 12 }}>
              <div className="stat-item"><span className="stat-label">Total Value</span><span className="stat-value">${fmtB(totalValue)}</span></div>
              <div className="stat-item"><span className="stat-label">Total Cost</span><span className="stat-value">${fmtB(totalCost)}</span></div>
              <div className="stat-item"><span className="stat-label">Total P&L</span><span className={`stat-value ${totalPnL >= 0 ? 'positive' : 'negative'}`}>{totalPnL >= 0 ? '+' : ''}{fmtB(totalPnL)}</span></div>
              <div className="stat-item"><span className="stat-label">Return</span><span className={`stat-value ${totalPnLPct >= 0 ? 'positive' : 'negative'}`}>{fmtPct(totalPnLPct)}</span></div>
            </div>

            {/* Allocation */}
            {Object.keys(alloc).length > 0 && (
              <div className="flex gap-2" style={{ marginBottom: 12, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                {Object.entries(alloc).map(([sym, val], i) => {
                  const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
                  const colors = ['#3b82f6','#f59e0b','#26a69a','#8b5cf6','#ef5350','#06b6d4','#ec4899','#22c55e'];
                  return <div key={sym} title={`${sym}: ${pct.toFixed(1)}%`} style={{ width: `${pct}%`, background: colors[i % colors.length], minWidth: pct > 0 ? 2 : 0 }} />;
                })}
              </div>
            )}

            {/* Add Position */}
            <div className="card flex items-center gap-4" style={{ marginBottom: 8 }}>
              <input placeholder="Symbol" value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })} style={{ width: 70 }} />
              <input placeholder="Shares" type="number" value={form.shares} onChange={e => setForm({ ...form, shares: e.target.value })} style={{ width: 70 }} />
              <input placeholder="Price" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={{ width: 80 }} />
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={{ width: 120 }} />
              <button className="btn btn-primary btn-sm" onClick={addPos}>Add</button>
            </div>

            {/* Positions Table */}
            <table className="data-table">
              <thead><tr><th>Symbol</th><th>Shares</th><th>Entry</th><th>Current</th><th>Mkt Value</th><th>P&L</th><th>Return</th><th>Day</th><th></th></tr></thead>
              <tbody>
                {positions.map(p => (
                  <tr key={p.id} onClick={() => { setActiveSymbol(p.symbol); setActivePage('chart'); }}>
                    <td style={{ fontWeight: 600, color: 'var(--amber)' }}>{p.symbol}</td>
                    <td className="tabular">{p.shares}</td>
                    <td className="tabular">{fmt(p.entryPrice)}</td>
                    <td className="tabular" style={{ fontWeight: 600 }}>{fmt(p.current)}</td>
                    <td className="tabular">{fmtB(p.mv)}</td>
                    <td className={`tabular ${p.pnl >= 0 ? 'positive' : 'negative'}`} style={{ fontWeight: 600 }}>{p.pnl >= 0 ? '+' : ''}{fmtB(p.pnl)}</td>
                    <td className={`tabular ${p.pnlPct >= 0 ? 'positive' : 'negative'}`}>{fmtPct(p.pnlPct)}</td>
                    <td className={`tabular ${p.chg >= 0 ? 'positive' : 'negative'}`}>{fmtPct(p.chg)}</td>
                    <td><button className="btn btn-sm" style={{ color: 'var(--red)', fontSize: 9 }} onClick={e => { e.stopPropagation(); removePosition(p.id); }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {positions.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 10 }}>No positions. Add one above.</div>}
          </>
        )}

        {tab === 'alerts' && (
          <>
            <div className="card flex items-center gap-4" style={{ marginBottom: 8 }}>
              <input placeholder="Symbol" value={alertForm.symbol} onChange={e => setAlertForm({ ...alertForm, symbol: e.target.value.toUpperCase() })} style={{ width: 70 }} />
              <select value={alertForm.type} onChange={e => setAlertForm({ ...alertForm, type: e.target.value })}>
                <option value="above">Price Above</option>
                <option value="below">Price Below</option>
              </select>
              <input placeholder="Price" type="number" value={alertForm.price} onChange={e => setAlertForm({ ...alertForm, price: e.target.value })} style={{ width: 80 }} />
              <button className="btn btn-primary btn-sm" onClick={addAlertFn}>Set Alert</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Symbol</th><th>Type</th><th>Target</th><th></th></tr></thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, color: 'var(--amber)' }}>{a.symbol}</td>
                    <td><span className={`badge ${a.type === 'above' ? 'badge-green' : 'badge-red'}`}>{a.type === 'above' ? '▲ Above' : '▼ Below'}</span></td>
                    <td className="tabular">{fmt(a.targetPrice)}</td>
                    <td><button className="btn btn-sm" onClick={() => removeAlert(a.id)} style={{ color: 'var(--red)', fontSize: 9 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {alerts.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 10 }}>No active alerts.</div>}
          </>
        )}

        {tab === 'history' && (
          <>
            {alertHistory.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 10 }}>No triggered alerts yet.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Symbol</th><th>Type</th><th>Target</th><th>Triggered</th></tr></thead>
                <tbody>
                  {alertHistory.map((a, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{a.symbol}</td>
                      <td>{a.type}</td>
                      <td className="tabular">{fmt(a.targetPrice)}</td>
                      <td style={{ fontSize: 9 }}>{new Date(a.triggeredAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
