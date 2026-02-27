'use client';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { getQuote, getBulkQuotes, subscribeSymbol, fmt, fmtPct } from '@/lib/api';

export default function WatchlistPanel() {
  const { watchlists, activeWatchlist, setActiveWatchlist, activeSymbol, setActiveSymbol, setActivePage, addToWatchlist, removeFromWatchlist, createWatchlist, livePrices } = useStore();
  const [quotes, setQuotes] = useState({});
  const [newList, setNewList] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addTicker, setAddTicker] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const symbols = watchlists[activeWatchlist] || [];

  useEffect(() => {
    if (symbols.length === 0) return;
    const load = async () => {
      const q = await getBulkQuotes(symbols);
      setQuotes(q);
    };
    load();
    symbols.forEach(s => subscribeSymbol(s));
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, [symbols.join(',')]);

  const getPrice = (s) => {
    const live = livePrices[s];
    const rest = quotes[s];
    return { c: live?.price ?? rest?.c ?? 0, dp: rest?.dp ?? 0, d: rest?.d ?? 0, pc: rest?.pc ?? 0 };
  };

  const handleContext = (e, symbol) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, symbol });
  };

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  return (
    <div className="panel" style={{ width: 220, flexShrink: 0, height: '100%' }}>
      <div className="panel-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
        <div className="flex items-center justify-between">
          <span className="panel-title">Watchlist</span>
          <button className="btn btn-sm" onClick={() => setShowAdd(!showAdd)} title="Add ticker">+</button>
        </div>
        {/* Watchlist tabs */}
        <div className="flex gap-2" style={{ overflowX: 'auto' }}>
          {Object.keys(watchlists).map(name => (
            <button key={name} className={`chart-tf-btn ${activeWatchlist === name ? 'active' : ''}`} onClick={() => setActiveWatchlist(name)}>
              {name}
            </button>
          ))}
          <input style={{ width: 60, fontSize: 9, padding: '2px 4px' }} placeholder="+ New" value={newList}
            onChange={e => setNewList(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newList.trim()) { createWatchlist(newList.trim()); setNewList(''); } }} />
        </div>
      </div>

      {/* Add ticker */}
      {showAdd && (
        <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
          <input style={{ width: '100%' }} placeholder="Ticker (e.g. AAPL)" value={addTicker}
            onChange={e => setAddTicker(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && addTicker.trim()) { addToWatchlist(addTicker.trim()); setAddTicker(''); setShowAdd(false); } }} />
        </div>
      )}

      {/* Watchlist rows */}
      <div className="panel-body no-pad" style={{ flex: 1 }}>
        {symbols.map(s => {
          const q = getPrice(s);
          const chg = q.dp;
          return (
            <div key={s} className={`wl-row ${activeSymbol === s ? 'active' : ''}`}
              onClick={() => { setActiveSymbol(s); setActivePage('chart'); }}
              onContextMenu={(e) => handleContext(e, s)}>
              <span className="wl-symbol">{s}</span>
              <span className="wl-price" style={{ color: 'var(--text-1)' }}>{fmt(q.c)}</span>
              <span className={`wl-change ${chg >= 0 ? 'positive' : 'negative'}`}>{fmtPct(chg)}</span>
            </div>
          );
        })}
        {symbols.length === 0 && (
          <div style={{ padding: 16, color: 'var(--text-3)', textAlign: 'center', fontSize: 10 }}>
            No symbols in this watchlist.<br />Click + to add.
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div className="glass" style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1001, borderRadius: 'var(--radius)', minWidth: 150 }}>
          {[
            { label: 'Open Chart', action: () => { setActiveSymbol(contextMenu.symbol); setActivePage('chart'); } },
            { label: 'Company Profile', action: () => { setActiveSymbol(contextMenu.symbol); setActivePage('company'); } },
            { label: 'View News', action: () => { setActiveSymbol(contextMenu.symbol); setActivePage('news'); } },
            { label: 'AI Analysis', action: () => { setActiveSymbol(contextMenu.symbol); setActivePage('ai'); } },
            { label: 'Remove', action: () => removeFromWatchlist(contextMenu.symbol), color: 'var(--red)' },
          ].map(item => (
            <div key={item.label} className="cmd-result" style={{ color: item.color || 'var(--text-2)' }} onClick={item.action}>
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
