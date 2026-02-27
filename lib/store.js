// ═══════════════════════════════════════════════════════════════
// SIGMA TERMINAL PRO — Global State (Zustand)
// Persistent: watchlist, portfolio, alerts, preferences
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand';

const isBrowser = typeof window !== 'undefined';
function load(key, fallback) {
  if (!isBrowser) return fallback;
  try { const v = localStorage.getItem(`sigma:${key}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) { if (isBrowser) localStorage.setItem(`sigma:${key}`, JSON.stringify(val)); }

const DEFAULT_WATCHLIST = ['AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','JPM','V','WMT','UNH','JNJ'];
const DEFAULT_INDICES = [
  { symbol: '^GSPC', label: 'S&P 500' }, { symbol: '^DJI', label: 'DOW' },
  { symbol: '^IXIC', label: 'NASDAQ' }, { symbol: '^RUT', label: 'Russell' },
  { symbol: '^VIX', label: 'VIX' },
];

export const useStore = create((set, get) => ({
  // ── Active Symbol ───────────────────────────
  activeSymbol: load('activeSymbol', 'AAPL'),
  setActiveSymbol: (s) => { set({ activeSymbol: s }); save('activeSymbol', s); },

  // ── Active Page ─────────────────────────────
  activePage: 'dashboard',
  setActivePage: (p) => set({ activePage: p }),

  // ── Sidebar ─────────────────────────────────
  sidebarCollapsed: load('sidebarCollapsed', false),
  toggleSidebar: () => set(s => { const v = !s.sidebarCollapsed; save('sidebarCollapsed', v); return { sidebarCollapsed: v }; }),

  // ── Command Palette ─────────────────────────
  commandPaletteOpen: false,
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),

  // ── Watchlist ───────────────────────────────
  watchlists: load('watchlists', { Main: DEFAULT_WATCHLIST, Crypto: ['BINANCE:BTCUSDT','BINANCE:ETHUSDT'] }),
  activeWatchlist: load('activeWatchlist', 'Main'),
  setActiveWatchlist: (name) => { set({ activeWatchlist: name }); save('activeWatchlist', name); },
  addToWatchlist: (symbol, list) => set(s => {
    const wl = { ...s.watchlists };
    const target = list || s.activeWatchlist;
    if (!wl[target]) wl[target] = [];
    if (!wl[target].includes(symbol)) wl[target] = [...wl[target], symbol];
    save('watchlists', wl);
    return { watchlists: wl };
  }),
  removeFromWatchlist: (symbol, list) => set(s => {
    const wl = { ...s.watchlists };
    const target = list || s.activeWatchlist;
    if (wl[target]) wl[target] = wl[target].filter(x => x !== symbol);
    save('watchlists', wl);
    return { watchlists: wl };
  }),
  createWatchlist: (name) => set(s => {
    const wl = { ...s.watchlists, [name]: [] };
    save('watchlists', wl);
    return { watchlists: wl, activeWatchlist: name };
  }),

  // ── Portfolio ───────────────────────────────
  portfolio: load('portfolio', []),
  addPosition: (pos) => set(s => {
    const p = [...s.portfolio, { ...pos, id: Date.now().toString(36) }];
    save('portfolio', p); return { portfolio: p };
  }),
  removePosition: (id) => set(s => {
    const p = s.portfolio.filter(x => x.id !== id);
    save('portfolio', p); return { portfolio: p };
  }),

  // ── Alerts ──────────────────────────────────
  alerts: load('alerts', []),
  alertHistory: load('alertHistory', []),
  addAlert: (alert) => set(s => {
    const a = [...s.alerts, { ...alert, id: Date.now().toString(36), active: true }];
    save('alerts', a); return { alerts: a };
  }),
  removeAlert: (id) => set(s => {
    const a = s.alerts.filter(x => x.id !== id);
    save('alerts', a); return { alerts: a };
  }),
  triggerAlert: (id) => set(s => {
    const alert = s.alerts.find(x => x.id === id);
    const alerts = s.alerts.filter(x => x.id !== id);
    const history = [{ ...alert, triggeredAt: Date.now() }, ...s.alertHistory].slice(0, 50);
    save('alerts', alerts); save('alertHistory', history);
    return { alerts, alertHistory: history };
  }),

  // ── Live Prices (from WebSocket + polling) ──
  livePrices: {},
  updatePrice: (symbol, data) => set(s => ({
    livePrices: { ...s.livePrices, [symbol]: { ...s.livePrices[symbol], ...data, ts: Date.now() } }
  })),
  
  // ── Previous prices for flash effect ────────
  prevPrices: {},
  setPrevPrice: (symbol, price) => set(s => ({
    prevPrices: { ...s.prevPrices, [symbol]: price }
  })),

  // ── Chart Settings ──────────────────────────
  chartType: load('chartType', 'candlestick'),
  setChartType: (t) => { set({ chartType: t }); save('chartType', t); },
  chartTimeframe: load('chartTimeframe', 'D'),
  setChartTimeframe: (tf) => { set({ chartTimeframe: tf }); save('chartTimeframe', tf); },
  overlays: load('overlays', { sma20: false, sma50: true, ema12: false, ema26: false, bollinger: false, vwap: false, ichimoku: false }),
  toggleOverlay: (key) => set(s => {
    const o = { ...s.overlays, [key]: !s.overlays[key] };
    save('overlays', o); return { overlays: o };
  }),
  oscillators: load('oscillators', { rsi: true, macd: false, stochastic: false, adx: false, cci: false, williamsR: false, atr: false, obv: false, mfi: false, roc: false }),
  toggleOscillator: (key) => set(s => {
    const o = { ...s.oscillators, [key]: !s.oscillators[key] };
    save('oscillators', o); return { oscillators: o };
  }),

  // ── Theme ───────────────────────────────────
  theme: load('theme', 'dark'),
  toggleTheme: () => set(s => { const t = s.theme === 'dark' ? 'light' : 'dark'; save('theme', t); return { theme: t }; }),

  // ── Notifications ───────────────────────────
  notifications: [],
  addNotification: (msg, type = 'info') => set(s => ({
    notifications: [{ id: Date.now(), msg, type, ts: Date.now() }, ...s.notifications].slice(0, 20)
  })),
  dismissNotification: (id) => set(s => ({
    notifications: s.notifications.filter(n => n.id !== id)
  })),
}));
