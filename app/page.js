'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { getQuote, getBulkQuotes, getMarketNews, getEarningsCalendar, getEconomicCalendar, getCompanyNews, getCandles, getProfile, getFinancials, getEarnings, getRecommendations, getPriceTarget, getInsiderTransactions, getPeers, getSECFilings, getIPOCalendar, getSupportResistance, searchSymbol, analyzeSentiment, getNewsImpact, fmt, fmtPct, fmtB, timeAgo, unixToDate, unixToDateTime, connectWebSocket, subscribeSymbol } from '@/lib/api';
import { calcSMA, calcEMA, calcRSI, calcMACD, calcBollinger, calcStochastic, calcATR, calcOBV, calcVWAP, calcCCI, toHeikinAshi } from '@/lib/indicators';

const NAV = [
  { key: 'dashboard', icon: '◫', label: 'DASHBOARD' },
  { key: 'chart', icon: '◪', label: 'CHART' },
  { key: 'company', icon: '◧', label: 'COMPANY' },
  { key: 'news', icon: '◩', label: 'NEWS' },
  { key: 'ai', icon: '◈', label: 'AI RESEARCH' },
  { key: 'macro', icon: '◆', label: 'MACRO' },
  { key: 'portfolio', icon: '◇', label: 'PORTFOLIO' },
];

const TICKER_SYMBOLS = [
  { symbol: 'SPY', label: 'S&P 500' }, { symbol: 'DIA', label: 'DOW' },
  { symbol: 'QQQ', label: 'NASDAQ' }, { symbol: 'IWM', label: 'Russell' },
  { symbol: 'GLD', label: 'GOLD' }, { symbol: 'USO', label: 'OIL' },
];

export default function App() {
  const store = useStore();
  const { activeSymbol, setActiveSymbol, activePage, setActivePage, sidebarCollapsed, toggleSidebar, commandPaletteOpen, openCommandPalette, closeCommandPalette, watchlists, activeWatchlist, setActiveWatchlist, addToWatchlist, removeFromWatchlist, createWatchlist } = store;

  const [tickerData, setTickerData] = useState({});
  const [wlPrices, setWlPrices] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [cmdQuery, setCmdQuery] = useState('');
  const [cmdIdx, setCmdIdx] = useState(0);
  const [clock, setClock] = useState('');
  const [marketStatus, setMarketStatus] = useState({ label: 'CLOSED', cls: 'closed' });
  const [addTicker, setAddTicker] = useState('');
  const [newWlName, setNewWlName] = useState('');
  const searchRef = useRef(null);
  const cmdRef = useRef(null);

  // ── Clock + Market Status ────────────────────────
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      setClock(et.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ET');
      const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
      const mins = h * 60 + m;
      if (day === 0 || day === 6) setMarketStatus({ label: 'CLOSED', cls: 'closed' });
      else if (mins >= 570 && mins < 960) setMarketStatus({ label: 'OPEN', cls: 'open' });
      else if (mins >= 240 && mins < 570) setMarketStatus({ label: 'PRE-MKT', cls: 'pre' });
      else if (mins >= 960 && mins < 1200) setMarketStatus({ label: 'AFTER-HRS', cls: 'after' });
      else setMarketStatus({ label: 'CLOSED', cls: 'closed' });
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  // ── Ticker Bar Data ──────────────────────────────
  useEffect(() => {
    const load = async () => {
      const data = await getBulkQuotes(TICKER_SYMBOLS.map(t => t.symbol));
      setTickerData(data || {});
    };
    load();
    const i = setInterval(load, 12000);
    return () => clearInterval(i);
  }, []);

  // ── Watchlist Prices ─────────────────────────────
  useEffect(() => {
    const syms = watchlists[activeWatchlist] || [];
    if (syms.length === 0) return;
    const load = async () => {
      const data = await getBulkQuotes(syms);
      setWlPrices(data || {});
    };
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, [watchlists, activeWatchlist]);

  // ── Search ───────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const res = await searchSymbol(searchQuery);
      setSearchResults((res?.result || []).slice(0, 6));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Keyboard Shortcuts ───────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openCommandPalette(); }
      if (e.key === 'Escape') { closeCommandPalette(); setSearchResults([]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Command Palette Items ────────────────────────
  const cmdItems = [
    ...NAV.map(n => ({ icon: n.icon, label: n.label, hint: '', action: () => { setActivePage(n.key); closeCommandPalette(); } })),
    ...(cmdQuery.length >= 1 ? [{ icon: '⬡', label: `Go to ${cmdQuery.toUpperCase()}`, hint: 'ticker', action: () => { setActiveSymbol(cmdQuery.toUpperCase()); setActivePage('chart'); closeCommandPalette(); } }] : []),
  ].filter(item => !cmdQuery || item.label.toLowerCase().includes(cmdQuery.toLowerCase()));

  const handleCmdKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCmdIdx(i => Math.min(i + 1, cmdItems.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCmdIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && cmdItems[cmdIdx]) { cmdItems[cmdIdx].action(); }
    if (e.key === 'Escape') closeCommandPalette();
  };

  const handleAddTicker = () => {
    if (addTicker.trim()) { addToWatchlist(addTicker.toUpperCase()); setAddTicker(''); }
  };

  const currentWatchlist = watchlists[activeWatchlist] || [];

  return (
    <div className="app">
      {/* ── SIDEBAR ──────────────────── */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo" onClick={toggleSidebar}>
          <div className="logo-icon">Σ</div>
          <span className="logo-text">SIGMA PRO</span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">Navigate</div>
          {NAV.map(n => (
            <div key={n.key} className={`nav-item ${activePage === n.key ? 'active' : ''}`}
              onClick={() => setActivePage(n.key)}>
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </div>
          ))}
          <div className="nav-section" style={{ marginTop: 16 }}>Active</div>
          <div className="nav-item" style={{ color: 'var(--amber)' }} onClick={() => setActivePage('chart')}>
            <span className="nav-icon">⬡</span>
            <span className="nav-label">{activeSymbol}</span>
          </div>
        </nav>
      </aside>

      {/* ── MAIN ─────────────────────── */}
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <span className="topbar-logo">Σ</span>
          <div className="search-box" style={{ position: 'relative' }}>
            <span className="search-icon">⌕</span>
            <input ref={searchRef} type="text" placeholder="Search ticker..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && searchQuery.trim()) { setActiveSymbol(searchQuery.toUpperCase()); setActivePage('chart'); setSearchQuery(''); setSearchResults([]); } }}
            />
            <span className="search-kbd">⌘K</span>
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-2)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius)', marginTop: 4, zIndex: 100, overflow: 'hidden' }}>
                {searchResults.map((r, i) => (
                  <div key={i} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 10, display: 'flex', justifyContent: 'space-between' }}
                    onClick={() => { setActiveSymbol(r.symbol); setActivePage('chart'); setSearchQuery(''); setSearchResults([]); }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontWeight: 600, color: 'var(--amber)' }}>{r.symbol}</span>
                    <span style={{ color: 'var(--text-3)' }}>{r.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <span className={`topbar-status ${marketStatus.cls}`}>{marketStatus.label}</span>
          <span className="topbar-clock">{clock}</span>
          <button className="topbar-btn" onClick={openCommandPalette}>⌘K</button>
        </header>

        {/* Ticker Bar */}
        <div className="ticker-bar">
          {TICKER_SYMBOLS.map(t => {
            const q = tickerData[t.symbol];
            const chg = q?.dp ?? 0;
            return (
              <div key={t.symbol} className="ticker-item" style={{ cursor: 'pointer' }}
                onClick={() => { setActiveSymbol(t.symbol); setActivePage('chart'); }}>
                <span className="ticker-label">{t.label}</span>
                <span className="ticker-price">{q ? fmt(q.c) : '—'}</span>
                <span className={`ticker-change ${chg >= 0 ? 'positive' : 'negative'}`}>
                  {chg >= 0 ? '+' : ''}{fmtPct(chg)}
                </span>
              </div>
            );
          })}
          <div style={{ marginLeft: 'auto' }}><div className="live-dot" title="Live data" /></div>
        </div>

        {/* Content */}
        <div className="content-area">
          {/* Watchlist Panel */}
          <div className="panel" style={{ width: 210, flexShrink: 0, height: '100%', borderRadius: 0, borderTop: 'none' }}>
            <div className="panel-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <div className="flex items-center justify-between">
                <span className="panel-title">Watchlist</span>
              </div>
              <div className="flex gap-2" style={{ overflowX: 'auto' }}>
                {Object.keys(watchlists).map(name => (
                  <button key={name} className={`chart-tf-btn ${activeWatchlist === name ? 'active' : ''}`}
                    onClick={() => setActiveWatchlist(name)}>{name}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input style={{ flex: 1, fontSize: 9, padding: '2px 6px' }} placeholder="Add ticker..."
                  value={addTicker} onChange={e => setAddTicker(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddTicker(); }} />
                <button className="btn btn-sm" onClick={handleAddTicker}>+</button>
              </div>
            </div>
            <div className="panel-body no-pad" style={{ flex: 1 }}>
              {currentWatchlist.map(sym => {
                const q = wlPrices[sym];
                const chg = q?.dp ?? 0;
                return (
                  <div key={sym} className={`wl-row ${sym === activeSymbol ? 'active' : ''}`}
                    onClick={() => { setActiveSymbol(sym); setActivePage('chart'); }}>
                    <span className="wl-symbol">{sym}</span>
                    <span className="wl-price" style={{ color: 'var(--text-1)' }}>{q ? fmt(q.c) : '...'}</span>
                    <span className={`wl-change ${chg >= 0 ? 'positive' : 'negative'}`}>
                      {chg >= 0 ? '+' : ''}{fmtPct(chg)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
            {activePage === 'dashboard' && <DashboardPage />}
            {activePage === 'chart' && <ChartPage />}
            {activePage === 'company' && <CompanyPage />}
            {activePage === 'news' && <NewsPage />}
            {activePage === 'ai' && <AIPage />}
            {activePage === 'macro' && <MacroPage />}
            {activePage === 'portfolio' && <PortfolioPage />}
          </div>
        </div>
      </div>

      {/* Command Palette */}
      {commandPaletteOpen && (
        <div className="cmd-overlay" onClick={closeCommandPalette}>
          <div className="cmd-palette fade-in" onClick={e => e.stopPropagation()}>
            <input ref={cmdRef} className="cmd-input" placeholder="Type a command or ticker..."
              value={cmdQuery} onChange={e => { setCmdQuery(e.target.value); setCmdIdx(0); }}
              onKeyDown={handleCmdKey} autoFocus />
            <div className="cmd-results">
              {cmdItems.map((item, i) => (
                <div key={i} className={`cmd-item ${i === cmdIdx ? 'active' : ''}`} onClick={item.action}>
                  <span className="cmd-icon">{item.icon}</span>
                  <span className="cmd-text">{item.label}</span>
                  {item.hint && <span className="cmd-hint">{item.hint}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════
const SECTORS = [
  { symbol: 'XLK', label: 'Tech' }, { symbol: 'XLF', label: 'Finance' },
  { symbol: 'XLV', label: 'Health' }, { symbol: 'XLY', label: 'Consumer' },
  { symbol: 'XLE', label: 'Energy' }, { symbol: 'XLI', label: 'Industrials' },
  { symbol: 'XLC', label: 'Comms' }, { symbol: 'XLRE', label: 'Real Est' },
  { symbol: 'XLP', label: 'Staples' }, { symbol: 'XLU', label: 'Utilities' },
  { symbol: 'XLB', label: 'Materials' },
];
const TOP_STOCKS = ['AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','JPM','V','WMT','UNH','JNJ','XOM','PG','MA','HD','COST','ABBV','CRM','AMD'];

function DashboardPage() {
  const { setActiveSymbol, setActivePage } = useStore();
  const [sectorData, setSectorData] = useState({});
  const [stockData, setStockData] = useState({});
  const [news, setNews] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, st, n, e] = await Promise.allSettled([
          getBulkQuotes(SECTORS.map(s => s.symbol)),
          getBulkQuotes(TOP_STOCKS),
          getMarketNews('general'),
          getEarningsCalendar(),
        ]);
        setSectorData(s.value || {});
        setStockData(st.value || {});
        setNews((n.value || []).slice(0, 15));
        setEarnings((e.value?.earningsCalendar || []).slice(0, 10));
      } catch (err) { console.error('Dashboard load error:', err); }
      setLoading(false);
    };
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  const goTo = (sym) => { setActiveSymbol(sym); setActivePage('chart'); };
  const sorted = Object.entries(stockData).filter(([_, q]) => q?.dp != null).sort((a, b) => b[1].dp - a[1].dp);
  const gainers = sorted.slice(0, 5);
  const losers = sorted.slice(-5).reverse();

  if (loading) return <div className="fade-in" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
    {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 6 }} />)}
  </div>;

  return (
    <div className="fade-in" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', height: '100%' }}>
      {/* Sector Heatmap */}
      <div className="panel">
        <div className="panel-header"><span className="panel-title">Sector Performance</span></div>
        <div style={{ padding: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 4 }}>
          {SECTORS.map(sec => {
            const q = sectorData[sec.symbol]; const chg = q?.dp ?? 0;
            const bg = chg >= 0
              ? `rgba(16,185,129,${Math.min(Math.abs(chg) * 0.15, 0.5)})`
              : `rgba(239,68,68,${Math.min(Math.abs(chg) * 0.15, 0.5)})`;
            return (
              <div key={sec.symbol} onClick={() => goTo(sec.symbol)}
                style={{ background: bg, border: '1px solid var(--border)', borderRadius: 4, padding: '8px 5px', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>{sec.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }} className={chg >= 0 ? 'positive' : 'negative'}>{chg >= 0 ? '+' : ''}{fmtPct(chg)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* Gainers */}
        <div className="panel">
          <div className="panel-header"><span className="panel-title positive">▲ Top Gainers</span></div>
          <div className="panel-body no-pad">
            {gainers.map(([s, q]) => (
              <div key={s} className="wl-row" onClick={() => goTo(s)}>
                <span className="wl-symbol">{s}</span>
                <span className="wl-price" style={{ color: 'var(--text-1)' }}>{fmt(q.c)}</span>
                <span className="wl-change positive" style={{ fontWeight: 700 }}>+{fmtPct(q.dp)}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Losers */}
        <div className="panel">
          <div className="panel-header"><span className="panel-title negative">▼ Top Losers</span></div>
          <div className="panel-body no-pad">
            {losers.map(([s, q]) => (
              <div key={s} className="wl-row" onClick={() => goTo(s)}>
                <span className="wl-symbol">{s}</span>
                <span className="wl-price" style={{ color: 'var(--text-1)' }}>{fmt(q.c)}</span>
                <span className="wl-change negative" style={{ fontWeight: 700 }}>{fmtPct(q.dp)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
        {/* News */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Market News</span>
            <button className="btn btn-sm" onClick={() => setActivePage('news')}>All →</button>
          </div>
          <div className="panel-body no-pad" style={{ maxHeight: 280 }}>
            {news.map((n, i) => {
              const sent = analyzeSentiment(n.headline, n.source);
              return (
                <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div className="flex items-center gap-4" style={{ marginBottom: 2 }}>
                      <span className="badge" style={{ background: sent.bg, color: sent.color }}>{sent.label}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-4)', marginLeft: 'auto' }}>{n.source} · {timeAgo(n.datetime)}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-1)', lineHeight: 1.35 }}>{n.headline}</div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
        {/* Earnings */}
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Upcoming Earnings</span></div>
          <div className="panel-body no-pad" style={{ maxHeight: 280 }}>
            {earnings.map((e, i) => (
              <div key={i} className="wl-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '5px 10px' }}
                onClick={() => goTo(e.symbol)}>
                <div className="flex items-center gap-4 w-full">
                  <span style={{ fontWeight: 600, color: 'var(--amber)' }}>{e.symbol}</span>
                  <span className="badge badge-amber" style={{ marginLeft: 'auto', fontSize: 8 }}>{e.hour === 'bmo' ? 'BMO' : e.hour === 'amc' ? 'AMC' : '—'}</span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{e.date} · EPS Est: {e.epsEstimate ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CHART PAGE
// ═══════════════════════════════════════════════════════════
const TIMEFRAMES = [
  { key: '5', label: '5m' }, { key: '15', label: '15m' }, { key: '60', label: '1H' },
  { key: 'D', label: '1D' }, { key: 'W', label: '1W' }, { key: 'M', label: '1M' },
];

function ChartPage() {
  const { activeSymbol, chartTimeframe, setChartTimeframe, overlays, toggleOverlay, oscillators, toggleOscillator, chartType, setChartType } = useStore();
  const canvasRef = useRef(null);
  const [candles, setCandles] = useState([]);
  const [quote, setQuote] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [cd, q] = await Promise.allSettled([getCandles(activeSymbol, chartTimeframe), getQuote(activeSymbol)]);
      const d = cd.value;
      if (d && d.s === 'ok' && d.c) setCandles(d.t.map((t, i) => ({ t, o: d.o[i], h: d.h[i], l: d.l[i], c: d.c[i], v: d.v[i] })));
      setQuote(q.value || null);
    };
    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, [activeSymbol, chartTimeframe]);

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const pad = { t: 10, r: 60, b: 22, l: 5 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;

    let data = chartType === 'heikinashi' ? toHeikinAshi(candles) : candles;
    const count = Math.min(data.length, Math.floor(cw / 5));
    data = data.slice(-count);
    const barW = cw / data.length;
    const toX = i => pad.l + i * barW + barW / 2;

    let hi = -Infinity, lo = Infinity;
    data.forEach(d => { if (d.h > hi) hi = d.h; if (d.l < lo) lo = d.l; });
    const pPad = (hi - lo) * 0.06; hi += pPad; lo -= pPad;
    const toY = p => pad.t + ch * (1 - (p - lo) / (hi - lo));

    // Background
    ctx.fillStyle = '#07070c'; ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = pad.t + (ch / 5) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = '#555'; ctx.font = '9px JetBrains Mono'; ctx.textAlign = 'left';
      ctx.fillText(fmt(hi - (hi - lo) * (i / 5)), W - pad.r + 4, y + 3);
    }

    // Time labels
    ctx.fillStyle = '#333'; ctx.font = '8px JetBrains Mono'; ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(data.length / 7));
    for (let i = 0; i < data.length; i += step) ctx.fillText(unixToDate(data[i].t), toX(i), H - 4);

    // Volume
    const maxV = Math.max(...data.map(d => d.v || 0));
    data.forEach((d, i) => {
      const h = ((d.v || 0) / maxV) * ch * 0.12;
      ctx.fillStyle = d.c >= d.o ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
      ctx.fillRect(toX(i) - barW * 0.35, pad.t + ch - h, barW * 0.7, h);
    });

    // Bollinger
    if (overlays.bollinger) {
      const bb = calcBollinger(data, 20, 2);
      ctx.fillStyle = 'rgba(99,102,241,0.03)'; ctx.beginPath();
      for (let i = 0; i < data.length; i++) { if (bb.upper[i] != null) { i === 0 ? ctx.moveTo(toX(i), toY(bb.upper[i])) : ctx.lineTo(toX(i), toY(bb.upper[i])); } }
      for (let i = data.length - 1; i >= 0; i--) { if (bb.lower[i] != null) ctx.lineTo(toX(i), toY(bb.lower[i])); }
      ctx.fill();
      [bb.upper, bb.lower, bb.middle].forEach((line, li) => {
        ctx.strokeStyle = li < 2 ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.5)'; ctx.lineWidth = li < 2 ? 0.8 : 1;
        ctx.beginPath(); line.forEach((v, i) => { if (v != null) (i === 0 || line[i-1] == null) ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); }); ctx.stroke();
      });
    }

    // Candles
    data.forEach((d, i) => {
      const x = toX(i); const up = d.c >= d.o;
      const color = up ? '#10b981' : '#ef4444';
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, toY(d.h)); ctx.lineTo(x, toY(d.l)); ctx.stroke();
      const bTop = toY(Math.max(d.o, d.c)), bBot = toY(Math.min(d.o, d.c));
      const bH = Math.max(bBot - bTop, 1), bW = Math.max(barW * 0.6, 1);
      up ? ctx.strokeRect(x - bW/2, bTop, bW, bH) : ctx.fillRect(x - bW/2, bTop, bW, bH);
    });

    // Overlays
    const drawLine = (vals, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.beginPath();
      let started = false;
      vals.forEach((v, i) => { if (v != null) { started ? ctx.lineTo(toX(i), toY(v)) : ctx.moveTo(toX(i), toY(v)); started = true; } });
      ctx.stroke();
    };
    if (overlays.sma20) drawLine(calcSMA(data, 20), '#f59e0b');
    if (overlays.sma50) drawLine(calcSMA(data, 50), '#8b5cf6');
    if (overlays.sma200) drawLine(calcSMA(data, 200), '#ef4444');
    if (overlays.ema12) drawLine(calcEMA(data, 12), '#06b6d4');
    if (overlays.ema26) drawLine(calcEMA(data, 26), '#ec4899');
    if (overlays.vwap) drawLine(calcVWAP(data), '#22c55e');

    // Crosshair
    if (hover) {
      const idx = Math.floor((hover.x - pad.l) / barW);
      if (idx >= 0 && idx < data.length) {
        const d = data[idx], cx = toX(idx);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.5; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, pad.t + ch); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad.l, hover.y); ctx.lineTo(W - pad.r, hover.y); ctx.stroke();
        ctx.setLineDash([]);
        setHover(prev => ({ ...prev, candle: d }));
      }
    }
  }, [candles, overlays, chartType, hover?.x, hover?.y]);

  // Resize handler
  useEffect(() => {
    const resize = () => { if (canvasRef.current) canvasRef.current.dispatchEvent(new Event('resize')); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const chg = quote?.dp ?? 0;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '6px 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-0)' }}>{activeSymbol}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-0)' }}>{fmt(quote?.c)}</span>
        <span className={chg >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 600 }}>{chg >= 0 ? '+' : ''}{fmtPct(chg)}</span>
        <span style={{ fontSize: 9, color: 'var(--text-3)' }}>O {fmt(quote?.o)} · H {fmt(quote?.h)} · L {fmt(quote?.l)}</span>
        {hover?.candle && <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-2)' }}>
          O {fmt(hover.candle.o)} H {fmt(hover.candle.h)} L {fmt(hover.candle.l)} C {fmt(hover.candle.c)} V {fmtB(hover.candle.v)}
        </span>}
      </div>
      {/* Toolbar */}
      <div className="chart-toolbar">
        {TIMEFRAMES.map(tf => <button key={tf.key} className={`chart-tf-btn ${chartTimeframe === tf.key ? 'active' : ''}`} onClick={() => setChartTimeframe(tf.key)}>{tf.label}</button>)}
        <div className="chart-divider" />
        {[{k:'candlestick',l:'Candle'},{k:'heikinashi',l:'HA'}].map(ct => <button key={ct.k} className={`chart-tf-btn ${chartType === ct.k ? 'active' : ''}`} onClick={() => setChartType(ct.k)}>{ct.l}</button>)}
        <div className="chart-divider" />
        {[{k:'sma20',l:'SMA20',c:'#f59e0b'},{k:'sma50',l:'SMA50',c:'#8b5cf6'},{k:'sma200',l:'SMA200',c:'#ef4444'},{k:'ema12',l:'EMA12',c:'#06b6d4'},{k:'bollinger',l:'BB',c:'#6366f1'},{k:'vwap',l:'VWAP',c:'#22c55e'}].map(o =>
          <button key={o.k} className={`chart-overlay-btn ${overlays[o.k] ? 'active' : ''}`} style={overlays[o.k] ? {borderColor:o.c,color:o.c} : {}} onClick={() => toggleOverlay(o.k)}>{o.l}</button>
        )}
      </div>
      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }}
          onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); setHover({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
          onMouseLeave={() => setHover(null)} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPANY PAGE
// ═══════════════════════════════════════════════════════════
function CompanyPage() {
  const { activeSymbol, setActiveSymbol } = useStore();
  const [tab, setTab] = useState('Overview');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      const [p,f,e,r,pt,ins,pe,fil,q] = await Promise.allSettled([
        getProfile(activeSymbol), getFinancials(activeSymbol), getEarnings(activeSymbol),
        getRecommendations(activeSymbol), getPriceTarget(activeSymbol),
        getInsiderTransactions(activeSymbol), getPeers(activeSymbol),
        getSECFilings(activeSymbol), getQuote(activeSymbol),
      ]);
      setData({ profile: p.value, financials: f.value?.metric || {}, earnings: e.value || [], recs: (r.value||[]).slice(0,8), pt: pt.value, insiders: (ins.value?.data||[]).slice(0,20), peers: (pe.value||[]).slice(0,8), filings: (fil.value||[]).slice(0,15), quote: q.value });
      setLoading(false);
    };
    load();
  }, [activeSymbol]);

  const m = data.financials || {};
  const q = data.quote;
  const chg = q?.dp ?? 0;
  const TABS = ['Overview','Earnings','Insiders','Peers','Filings','Ratings'];

  if (loading) return <div className="fade-in" style={{ padding: 16 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8, borderRadius: 6 }} />)}</div>;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 14px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {data.profile?.logo && <img src={data.profile.logo} alt="" style={{ width: 26, height: 26, borderRadius: 4, background: '#fff' }} />}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)' }}>{data.profile?.name || activeSymbol}</div>
          <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{data.profile?.finnhubIndustry} · {data.profile?.exchange}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-0)' }}>{fmt(q?.c)}</div>
          <span className={chg >= 0 ? 'positive' : 'negative'} style={{ fontWeight: 600, fontSize: 11 }}>{chg >= 0 ? '+' : ''}{fmtPct(chg)}</span>
        </div>
      </div>
      <div className="tabs">{TABS.map(t => <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</div>)}</div>
      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {tab === 'Overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.profile?.description && <div className="card"><div style={{ fontSize: 10.5, color: 'var(--text-2)', lineHeight: 1.5, maxHeight: 50, overflow: 'hidden' }}>{data.profile.description}</div></div>}
            <div className="stat-grid stat-grid-4">
              {[['Mkt Cap', fmtB((data.profile?.marketCapitalization||0)*1e6)], ['P/E', fmt(m.peBasicExclExtraTTM)], ['P/B', fmt(m.pbQuarterly)], ['Div Yield', fmtPct(m.dividendYieldIndicatedAnnual)],
                ['52W High', fmt(m['52WeekHigh'])], ['52W Low', fmt(m['52WeekLow'])], ['Beta', fmt(m.beta)], ['ROE', fmtPct(m.roeTTM)],
                ['Gross Mgn', fmtPct(m.grossMarginTTM)], ['Net Mgn', fmtPct(m.netProfitMarginTTM)], ['EPS TTM', fmt(m.epsBasicExclExtraItemsTTM)], ['D/E', fmt(m['totalDebt/totalEquityQuarterly'])],
              ].map(([l,v]) => <div key={l} className="stat-item"><span className="stat-label">{l}</span><span className="stat-value">{v}</span></div>)}
            </div>
            {data.pt && <div className="card"><div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 4 }}>ANALYST PRICE TARGET</div>
              <div className="flex gap-12">{[['Low',data.pt.targetLow,'negative'],['Mean',data.pt.targetMean,'text-amber'],['High',data.pt.targetHigh,'positive'],['Median',data.pt.targetMedian,'']].map(([l,v,c]) =>
                <div key={l}><span className="stat-label">{l}</span><br/><span className={`stat-value ${c}`} style={c==='text-amber'?{color:'var(--amber)',fontSize:15}:{}}>{fmt(v)}</span></div>
              )}</div></div>}
          </div>
        )}
        {tab === 'Earnings' && <table className="data-table"><thead><tr><th>Period</th><th>EPS Actual</th><th>EPS Est</th><th>Surprise</th></tr></thead><tbody>
          {data.earnings.map((e,i) => <tr key={i}><td style={{color:'var(--text-1)'}}>{e.period}</td><td className={e.actual>e.estimate?'positive':'negative'} style={{fontWeight:600}}>{fmt(e.actual)}</td><td>{fmt(e.estimate)}</td><td className={e.surprisePercent>=0?'positive':'negative'}>{fmtPct(e.surprisePercent)}</td></tr>)}
        </tbody></table>}
        {tab === 'Insiders' && <table className="data-table"><thead><tr><th>Name</th><th>Date</th><th>Type</th><th>Shares</th><th>Price</th></tr></thead><tbody>
          {data.insiders.map((t,i) => <tr key={i}><td style={{color:'var(--text-1)'}}>{t.name}</td><td>{t.transactionDate}</td><td><span className={`badge ${t.change>0?'badge-green':'badge-red'}`}>{t.change>0?'BUY':'SELL'}</span></td><td className="tabular">{Math.abs(t.change||0).toLocaleString()}</td><td className="tabular">{fmt(t.transactionPrice)}</td></tr>)}
        </tbody></table>}
        {tab === 'Peers' && <div className="flex gap-4" style={{flexWrap:'wrap'}}>{data.peers.map(p => <div key={p} className="card" style={{cursor:'pointer',minWidth:70,textAlign:'center'}} onClick={()=>setActiveSymbol(p)}><span style={{fontWeight:600,color:'var(--amber)'}}>{p}</span></div>)}</div>}
        {tab === 'Filings' && <table className="data-table"><thead><tr><th>Type</th><th>Date</th><th>Link</th></tr></thead><tbody>
          {data.filings.map((f,i) => <tr key={i}><td><span className="badge badge-blue">{f.form}</span></td><td>{f.filedDate||f.acceptedDate}</td><td><a href={f.reportUrl||f.filingUrl} target="_blank" rel="noopener noreferrer" style={{color:'var(--amber)'}}>View →</a></td></tr>)}
        </tbody></table>}
        {tab === 'Ratings' && data.recs.length > 0 && <div>
          <table className="data-table"><thead><tr><th>Period</th><th style={{color:'var(--green)'}}>Strong Buy</th><th>Buy</th><th>Hold</th><th>Sell</th><th style={{color:'var(--red)'}}>Strong Sell</th></tr></thead><tbody>
            {data.recs.map((r,i) => <tr key={i}><td style={{color:'var(--text-1)'}}>{r.period}</td><td className="positive" style={{fontWeight:600}}>{r.strongBuy}</td><td>{r.buy}</td><td>{r.hold}</td><td>{r.sell}</td><td className="negative">{r.strongSell}</td></tr>)}
          </tbody></table>
        </div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// NEWS PAGE
// ═══════════════════════════════════════════════════════════
function NewsPage() {
  const { activeSymbol } = useStore();
  const [news, setNews] = useState([]);
  const [filter, setFilter] = useState('company');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      const d = filter === 'company' ? await getCompanyNews(activeSymbol) : await getMarketNews('general');
      setNews((d || []).slice(0, 40));
      setLoading(false);
    };
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, [activeSymbol, filter]);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '6px 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span className="panel-title">News Feed</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {['company','market'].map(f => <button key={f} className={`chart-tf-btn ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>{f==='company'?activeSymbol:'Market'}</button>)}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? <div style={{padding:12}}>{[1,2,3,4,5].map(i=><div key={i} className="skeleton" style={{height:48,marginBottom:4,borderRadius:4}}/>)}</div>
        : news.map((n,i) => {
          const sent = analyzeSentiment(n.headline, n.source);
          return (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.1s' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg-3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div className="flex items-center gap-4" style={{ marginBottom: 2 }}>
                  <span className="badge" style={{ background: sent.bg, color: sent.color }}>{sent.label}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-4)', marginLeft: 'auto' }}>{n.source} · {timeAgo(n.datetime)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-1)', lineHeight: 1.4 }}>{n.headline}</div>
                {n.summary && <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.3, maxHeight: 26, overflow: 'hidden' }}>{n.summary}</div>}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// AI RESEARCH PAGE
// ═══════════════════════════════════════════════════════════
function AIPage() {
  const { activeSymbol } = useStore();
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('research');

  const generate = async () => {
    setLoading(true); setResult('');
    const [q,p,f,e] = await Promise.allSettled([getQuote(activeSymbol), getProfile(activeSymbol), getFinancials(activeSymbol), getEarnings(activeSymbol)]);
    const ctx = `${activeSymbol}: $${fmt(q.value?.c)} (${fmtPct(q.value?.dp)}). ${p.value?.name || ''}, ${p.value?.finnhubIndustry || ''}. P/E: ${fmt(f.value?.metric?.peBasicExclExtraTTM)}, Mkt Cap: ${fmtB((p.value?.marketCapitalization||0)*1e6)}.`;
    const prompts = {
      research: `Write an equity research brief for ${activeSymbol}. Include: Investment Thesis, Key Catalysts, Risk Factors, Valuation, Rating (BUY/HOLD/SELL). Data: ${ctx}`,
      bullbear: `Write a Bull Case and Bear Case for ${activeSymbol}. Each 150 words with specific catalysts. Data: ${ctx}`,
      earnings: `Analyze recent earnings for ${activeSymbol}. Data: ${ctx}`,
    };
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1200, messages: [{ role: 'user', content: prompts[mode] }] }),
      });
      const data = await res.json();
      setResult(data.content?.[0]?.text || 'Unable to generate.');
    } catch (e) { setResult('AI analysis requires Claude API access. The API call could not be completed from this environment.'); }
    setLoading(false);
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '6px 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span className="panel-title">AI Research Lab</span>
        <span style={{ fontSize: 10, color: 'var(--amber)' }}>◈ {activeSymbol}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {['research','bullbear','earnings'].map(m => <button key={m} className={`chart-tf-btn ${mode===m?'active':''}`} onClick={()=>{setMode(m);setResult('');}}>{m==='bullbear'?'Bull/Bear':m.charAt(0).toUpperCase()+m.slice(1)}</button>)}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        <button className="btn btn-primary" onClick={generate} disabled={loading} style={{ marginBottom: 12 }}>
          {loading ? '◌ Generating...' : '◈ Generate Analysis'}
        </button>
        {loading && !result && <div style={{display:'flex',flexDirection:'column',gap:6}}>{[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:14,borderRadius:3,width:`${100-i*10}%`}}/>)}</div>}
        {result && <div className="ai-report card" style={{ whiteSpace: 'pre-wrap' }}>
          {result.split('\n').map((line,i) => {
            if (line.startsWith('##') || line.startsWith('**')) return <h3 key={i}>{line.replace(/^[#*\s]+/, '').replace(/\*\*/g,'')}</h3>;
            if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} style={{marginLeft:16}}>{line.replace(/^[-*]\s/,'')}</li>;
            if (line.trim()==='') return <br key={i}/>;
            return <p key={i}>{line}</p>;
          })}
        </div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MACRO PAGE
// ═══════════════════════════════════════════════════════════
function MacroPage() {
  const { setActiveSymbol, setActivePage } = useStore();
  const [tab, setTab] = useState('earnings');
  const [earnings, setEarnings] = useState([]);
  const [econCal, setEconCal] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [e, ec] = await Promise.allSettled([getEarningsCalendar(), getEconomicCalendar()]);
      setEarnings((e.value?.earningsCalendar || []).slice(0, 30));
      setEconCal((ec.value?.economicCalendar?.result || []).slice(0, 20));
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="tabs">
        {['earnings','economic'].map(t => <div key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>)}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? <div style={{padding:12}}>{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:28,marginBottom:4,borderRadius:4}}/>)}</div>
        : tab === 'earnings' ? (
          <table className="data-table"><thead><tr><th>Symbol</th><th>Date</th><th>Time</th><th>EPS Est</th></tr></thead><tbody>
            {earnings.map((e,i) => <tr key={i} onClick={()=>{setActiveSymbol(e.symbol);setActivePage('chart');}}><td style={{fontWeight:600,color:'var(--amber)'}}>{e.symbol}</td><td>{e.date}</td><td><span className="badge badge-amber" style={{fontSize:8}}>{e.hour==='bmo'?'BMO':e.hour==='amc'?'AMC':'—'}</span></td><td className="tabular">{e.epsEstimate??'—'}</td></tr>)}
          </tbody></table>
        ) : (
          <table className="data-table"><thead><tr><th>Event</th><th>Country</th><th>Date</th><th>Impact</th><th>Prev</th><th>Est</th><th>Actual</th></tr></thead><tbody>
            {econCal.map((e,i) => <tr key={i}><td style={{color:'var(--text-1)',maxWidth:180}} className="truncate">{e.event}</td><td>{e.country}</td><td style={{fontSize:9}}>{e.date}</td><td><span className={`badge ${e.impact==='high'?'badge-red':e.impact==='medium'?'badge-amber':'badge-gray'}`}>{(e.impact||'low').toUpperCase()}</span></td><td className="tabular">{e.prev??'—'}</td><td className="tabular">{e.estimate??'—'}</td><td className="tabular" style={{fontWeight:600}}>{e.actual??'—'}</td></tr>)}
          </tbody></table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PORTFOLIO PAGE
// ═══════════════════════════════════════════════════════════
function PortfolioPage() {
  const { portfolio, addPosition, removePosition, alerts, addAlert, removeAlert, setActiveSymbol, setActivePage } = useStore();
  const [quotes, setQuotes] = useState({});
  const [form, setForm] = useState({ symbol: '', shares: '', price: '' });
  const [alertForm, setAlertForm] = useState({ symbol: '', price: '', type: 'above' });
  const [tab, setTab] = useState('positions');

  const syms = [...new Set(portfolio.map(p => p.symbol))];
  useEffect(() => {
    if (syms.length === 0) return;
    const load = async () => { setQuotes(await getBulkQuotes(syms) || {}); };
    load(); const i = setInterval(load, 10000); return () => clearInterval(i);
  }, [syms.join(',')]);

  const addPos = () => {
    if (!form.symbol || !form.shares || !form.price) return;
    addPosition({ symbol: form.symbol.toUpperCase(), shares: parseFloat(form.shares), entryPrice: parseFloat(form.price) });
    setForm({ symbol: '', shares: '', price: '' });
  };

  let totalValue = 0, totalCost = 0;
  const positions = portfolio.map(p => {
    const cur = quotes[p.symbol]?.c ?? p.entryPrice;
    const mv = cur * p.shares, cost = p.entryPrice * p.shares;
    totalValue += mv; totalCost += cost;
    return { ...p, cur, mv, cost, pnl: mv - cost, pnlPct: cost > 0 ? ((mv - cost) / cost) * 100 : 0 };
  });

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="tabs">
        {['positions','alerts'].map(t => <div key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>)}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {tab === 'positions' && <>
          <div className="stat-grid stat-grid-3" style={{ marginBottom: 10 }}>
            <div className="stat-item"><span className="stat-label">Total Value</span><span className="stat-value">${fmtB(totalValue)}</span></div>
            <div className="stat-item"><span className="stat-label">Total Cost</span><span className="stat-value">${fmtB(totalCost)}</span></div>
            <div className="stat-item"><span className="stat-label">P&L</span><span className={`stat-value ${totalValue-totalCost>=0?'positive':'negative'}`}>{totalValue-totalCost>=0?'+':''}{fmtB(totalValue-totalCost)}</span></div>
          </div>
          <div className="card flex items-center gap-4" style={{ marginBottom: 8 }}>
            <input placeholder="Symbol" value={form.symbol} onChange={e=>setForm({...form,symbol:e.target.value.toUpperCase()})} style={{width:65}}/>
            <input placeholder="Shares" type="number" value={form.shares} onChange={e=>setForm({...form,shares:e.target.value})} style={{width:65}}/>
            <input placeholder="Price" type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} style={{width:75}}/>
            <button className="btn btn-primary btn-sm" onClick={addPos}>Add</button>
          </div>
          <table className="data-table"><thead><tr><th>Symbol</th><th>Shares</th><th>Entry</th><th>Current</th><th>P&L</th><th>Return</th><th></th></tr></thead><tbody>
            {positions.map(p => <tr key={p.id} onClick={()=>{setActiveSymbol(p.symbol);setActivePage('chart');}}>
              <td style={{fontWeight:600,color:'var(--amber)'}}>{p.symbol}</td><td className="tabular">{p.shares}</td><td className="tabular">{fmt(p.entryPrice)}</td><td className="tabular" style={{fontWeight:600}}>{fmt(p.cur)}</td>
              <td className={`tabular ${p.pnl>=0?'positive':'negative'}`} style={{fontWeight:600}}>{p.pnl>=0?'+':''}{fmtB(p.pnl)}</td><td className={`tabular ${p.pnlPct>=0?'positive':'negative'}`}>{fmtPct(p.pnlPct)}</td>
              <td><button className="btn btn-sm" style={{color:'var(--red)',fontSize:9}} onClick={e=>{e.stopPropagation();removePosition(p.id);}}>✕</button></td>
            </tr>)}
          </tbody></table>
          {positions.length===0 && <div style={{padding:20,textAlign:'center',color:'var(--text-3)',fontSize:10}}>No positions yet. Add one above.</div>}
        </>}
        {tab === 'alerts' && <>
          <div className="card flex items-center gap-4" style={{ marginBottom: 8 }}>
            <input placeholder="Symbol" value={alertForm.symbol} onChange={e=>setAlertForm({...alertForm,symbol:e.target.value.toUpperCase()})} style={{width:65}}/>
            <select value={alertForm.type} onChange={e=>setAlertForm({...alertForm,type:e.target.value})}><option value="above">Above</option><option value="below">Below</option></select>
            <input placeholder="Price" type="number" value={alertForm.price} onChange={e=>setAlertForm({...alertForm,price:e.target.value})} style={{width:75}}/>
            <button className="btn btn-primary btn-sm" onClick={()=>{if(alertForm.symbol&&alertForm.price){addAlert({symbol:alertForm.symbol.toUpperCase(),targetPrice:parseFloat(alertForm.price),type:alertForm.type});setAlertForm({symbol:'',price:'',type:'above'});}}}>Set</button>
          </div>
          <table className="data-table"><thead><tr><th>Symbol</th><th>Type</th><th>Target</th><th></th></tr></thead><tbody>
            {alerts.map(a => <tr key={a.id}><td style={{fontWeight:600,color:'var(--amber)'}}>{a.symbol}</td><td><span className={`badge ${a.type==='above'?'badge-green':'badge-red'}`}>{a.type==='above'?'▲ Above':'▼ Below'}</span></td><td className="tabular">{fmt(a.targetPrice)}</td><td><button className="btn btn-sm" onClick={()=>removeAlert(a.id)} style={{color:'var(--red)',fontSize:9}}>✕</button></td></tr>)}
          </tbody></table>
          {alerts.length===0 && <div style={{padding:20,textAlign:'center',color:'var(--text-3)',fontSize:10}}>No active alerts.</div>}
        </>}
      </div>
    </div>
  );
}
