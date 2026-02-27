'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { getBulkQuotes, getQuote, getMarketNews, searchSymbol, connectWebSocket, onTrade, subscribeSymbol, fmt, fmtPct, fmtB } from '@/lib/api';

// ── Page Components (lazy-ish inline for single-file deploy reliability) ──
import Dashboard from '@/components/layout/Dashboard';
import ChartPage from '@/components/charts/ChartPage';
import CompanyPage from '@/components/data/CompanyPage';
import NewsPage from '@/components/data/NewsPage';
import AIResearch from '@/components/data/AIResearch';
import MacroPage from '@/components/data/MacroPage';
import PortfolioPage from '@/components/data/PortfolioPage';
import WatchlistPanel from '@/components/layout/WatchlistPanel';

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export default function SigmaTerminal() {
  const { activePage, setActivePage, activeSymbol, setActiveSymbol, sidebarCollapsed, toggleSidebar, commandPaletteOpen, openCommandPalette, closeCommandPalette } = useStore();
  const [clock, setClock] = useState('');
  const [marketStatus, setMarketStatus] = useState('closed');
  const [tickerData, setTickerData] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [cmdQuery, setCmdQuery] = useState('');
  const [cmdResults, setCmdResults] = useState([]);
  const [cmdIdx, setCmdIdx] = useState(0);
  const searchRef = useRef(null);
  const cmdRef = useRef(null);

  // ── Clock & Market Status ────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
      const mins = h * 60 + m;
      if (day === 0 || day === 6) setMarketStatus('closed');
      else if (mins >= 570 && mins < 960) setMarketStatus('open');
      else if (mins >= 240 && mins < 570) setMarketStatus('pre');
      else if (mins >= 960 && mins < 1200) setMarketStatus('after');
      else setMarketStatus('closed');
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  // ── Ticker Bar Data ──────────────────────────────────────
  const INDICES = [
    { symbol: 'SPY', label: 'S&P 500' }, { symbol: 'DIA', label: 'DOW' },
    { symbol: 'QQQ', label: 'NASDAQ' }, { symbol: 'IWM', label: 'Russell' },
    { symbol: 'GLD', label: 'GOLD' }, { symbol: 'USO', label: 'OIL' },
  ];

  useEffect(() => {
    const load = async () => {
      const quotes = await getBulkQuotes(INDICES.map(i => i.symbol));
      setTickerData(quotes);
    };
    load();
    const i = setInterval(load, 12000);
    return () => clearInterval(i);
  }, []);

  // ── WebSocket ────────────────────────────────────────────
  useEffect(() => {
    connectWebSocket();
    const unsub = onTrade((trades) => {
      trades.forEach(t => {
        useStore.getState().updatePrice(t.s, { price: t.p, volume: t.v });
      });
    });
    return unsub;
  }, []);

  // ── Search ───────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      const res = await searchSymbol(searchQuery);
      setSearchResults((res?.result || []).slice(0, 8));
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const selectSearchResult = (symbol) => {
    setActiveSymbol(symbol);
    setActivePage('chart');
    setSearchQuery('');
    setSearchResults([]);
    useStore.getState().addToWatchlist(symbol);
  };

  // ── Keyboard Shortcuts ───────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openCommandPalette(); }
      if (e.key === 'Escape') { closeCommandPalette(); setSearchResults([]); }
      if (commandPaletteOpen) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'w') setActivePage('dashboard');
      if (e.key === 'c') setActivePage('chart');
      if (e.key === 'n') setActivePage('news');
      if (e.key === 'p') setActivePage('company');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandPaletteOpen]);

  // ── Command Palette Logic ────────────────────────────────
  useEffect(() => {
    if (!commandPaletteOpen) { setCmdQuery(''); setCmdResults([]); return; }
    cmdRef.current?.focus();
  }, [commandPaletteOpen]);

  useEffect(() => {
    if (!cmdQuery) {
      setCmdResults([
        { action: 'dashboard', label: 'Dashboard', icon: '◫' },
        { action: 'chart', label: 'Chart', icon: '◪' },
        { action: 'company', label: 'Company Analysis', icon: '◧' },
        { action: 'news', label: 'News Feed', icon: '◩' },
        { action: 'ai', label: 'AI Research Lab', icon: '◈' },
        { action: 'macro', label: 'Macro & Calendar', icon: '◆' },
        { action: 'portfolio', label: 'Portfolio', icon: '◇' },
      ]);
      return;
    }
    const q = cmdQuery.toLowerCase();
    const pages = [
      { action: 'dashboard', label: 'Dashboard', icon: '◫' },
      { action: 'chart', label: 'Chart', icon: '◪' },
      { action: 'company', label: 'Company Analysis', icon: '◧' },
      { action: 'news', label: 'News Feed', icon: '◩' },
      { action: 'ai', label: 'AI Research Lab', icon: '◈' },
      { action: 'macro', label: 'Macro & Calendar', icon: '◆' },
      { action: 'portfolio', label: 'Portfolio', icon: '◇' },
    ].filter(p => p.label.toLowerCase().includes(q) || p.action.includes(q));

    // Check if it might be a ticker
    if (/^[A-Za-z]{1,5}$/.test(cmdQuery.trim())) {
      const ticker = cmdQuery.trim().toUpperCase();
      pages.push(
        { action: `chart:${ticker}`, label: `Chart ${ticker}`, icon: '◪', shortcut: 'Enter' },
        { action: `company:${ticker}`, label: `Analysis ${ticker}`, icon: '◧' },
        { action: `news:${ticker}`, label: `News ${ticker}`, icon: '◩' },
      );
    }
    setCmdResults(pages);
    setCmdIdx(0);
  }, [cmdQuery]);

  const execCmd = (cmd) => {
    closeCommandPalette();
    if (cmd.includes(':')) {
      const [page, symbol] = cmd.split(':');
      setActiveSymbol(symbol);
      setActivePage(page);
      useStore.getState().addToWatchlist(symbol);
    } else {
      setActivePage(cmd);
    }
  };

  // ── NAV ITEMS ────────────────────────────────────────────
  const NAV = [
    { id: 'dashboard', icon: '◫', label: 'DASHBOARD' },
    { id: 'chart', icon: '◪', label: 'CHART' },
    { id: 'company', icon: '◧', label: 'COMPANY' },
    { id: 'news', icon: '◩', label: 'NEWS' },
    { id: 'ai', icon: '◈', label: 'AI RESEARCH' },
    { id: 'macro', icon: '◆', label: 'MACRO' },
    { id: 'portfolio', icon: '◇', label: 'PORTFOLIO' },
  ];

  const statusLabel = { open: 'MARKET OPEN', closed: 'CLOSED', pre: 'PRE-MARKET', after: 'AFTER HOURS' };

  // ── Render Page ──────────────────────────────────────────
  const renderPage = () => {
    switch (activePage) {
      case 'chart': return <ChartPage />;
      case 'company': return <CompanyPage />;
      case 'news': return <NewsPage />;
      case 'ai': return <AIResearch />;
      case 'macro': return <MacroPage />;
      case 'portfolio': return <PortfolioPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app">
      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo" onClick={toggleSidebar} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">Σ</div>
          <span className="logo-text">SIGMA PRO</span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">Navigate</div>
          {NAV.map(n => (
            <div key={n.id} className={`nav-item ${activePage === n.id ? 'active' : ''}`} onClick={() => setActivePage(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </div>
          ))}
          <div className="nav-section" style={{ marginTop: 16 }}>Active</div>
          <div className="nav-item" onClick={() => { setActivePage('chart'); }} style={{ color: 'var(--amber)' }}>
            <span className="nav-icon">⬡</span>
            <span className="nav-label">{activeSymbol}</span>
          </div>
        </nav>
      </aside>

      {/* ── MAIN AREA ────────────────────────────────────── */}
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <span className="topbar-logo">Σ</span>
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input ref={searchRef} type="text" placeholder="Search ticker..." value={searchQuery} onChange={e => setSearchQuery(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter' && searchResults[0]) selectSearchResult(searchResults[0].symbol); }} />
            <span className="search-kbd">⌘K</span>
            {searchResults.length > 0 && (
              <div className="glass" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, borderRadius: 'var(--radius)', zIndex: 100, maxHeight: 240, overflowY: 'auto' }}>
                {searchResults.map(r => (
                  <div key={r.symbol} className="cmd-result" onClick={() => selectSearchResult(r.symbol)}>
                    <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{r.symbol}</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 9 }}>{r.description}</span>
                    <span className="cmd-action">{r.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <span className={`topbar-status ${marketStatus}`}>{statusLabel[marketStatus]}</span>
          <span className="topbar-clock">{clock}</span>
          <button className="topbar-btn" onClick={openCommandPalette} title="Command Palette (⌘K)">⌘K</button>
        </header>

        {/* Ticker Bar */}
        <div className="ticker-bar">
          {INDICES.map(idx => {
            const q = tickerData[idx.symbol];
            const chg = q?.dp ?? 0;
            return (
              <div key={idx.symbol} className="ticker-item" onClick={() => { setActiveSymbol(idx.symbol); setActivePage('chart'); }}>
                <span className="ticker-label">{idx.label}</span>
                <span className="ticker-price">{fmt(q?.c)}</span>
                <span className={`ticker-change ${chg >= 0 ? 'positive' : 'negative'}`}>{fmtPct(chg)}</span>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="content-area">
          <WatchlistPanel />
          <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
            {renderPage()}
          </div>
        </div>
      </div>

      {/* ── COMMAND PALETTE ───────────────────────────────── */}
      {commandPaletteOpen && (
        <div className="cmd-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeCommandPalette(); }}>
          <div className="cmd-box">
            <input ref={cmdRef} className="cmd-input" placeholder="Type a command or ticker..." value={cmdQuery} onChange={e => setCmdQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setCmdIdx(i => Math.min(i + 1, cmdResults.length - 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setCmdIdx(i => Math.max(i - 1, 0)); }
                if (e.key === 'Enter' && cmdResults[cmdIdx]) execCmd(cmdResults[cmdIdx].action);
                if (e.key === 'Escape') closeCommandPalette();
              }} />
            <div className="cmd-results">
              {cmdResults.map((r, i) => (
                <div key={r.action} className={`cmd-result ${i === cmdIdx ? 'selected' : ''}`} onClick={() => execCmd(r.action)}>
                  <span>{r.icon}</span>
                  <span>{r.label}</span>
                  {r.shortcut && <span className="cmd-action">{r.shortcut}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
