// ═══════════════════════════════════════════════════════════════
// SIGMA TERMINAL PRO — Data Engine
// Finnhub + Alpha Vantage unified API layer with caching & rate limiting
// ═══════════════════════════════════════════════════════════════

const FH = process.env.NEXT_PUBLIC_FINNHUB_KEY;
const AV = process.env.NEXT_PUBLIC_AV_KEY;
const FH_BASE = 'https://finnhub.io/api/v1';
const AV_BASE = 'https://www.alphavantage.co/query';

// ── Cache ────────────────────────────────────────────────────
const cache = new Map();
const TTL = { quote: 8000, profile: 86400000, news: 300000, financials: 3600000, calendar: 1800000, general: 60000 };

function cached(key, ttl, fetcher) {
  const c = cache.get(key);
  if (c && Date.now() - c.ts < ttl) return Promise.resolve(c.data);
  return fetcher().then(data => { cache.set(key, { data, ts: Date.now() }); return data; }).catch(err => {
    const stale = cache.get(key);
    if (stale) return { ...stale.data, _stale: true };
    console.error(`API Error [${key}]:`, err);
    return null;
  });
}

// ── Rate Limiter (60 calls/min for Finnhub) ──────────────────
let fhQueue = [];
let fhCallCount = 0;
let fhResetTime = Date.now() + 60000;

async function fhFetch(endpoint, params = {}) {
  const now = Date.now();
  if (now > fhResetTime) { fhCallCount = 0; fhResetTime = now + 60000; }
  if (fhCallCount >= 55) {
    await new Promise(r => setTimeout(r, fhResetTime - now + 100));
    fhCallCount = 0; fhResetTime = Date.now() + 60000;
  }
  fhCallCount++;
  const qs = new URLSearchParams({ ...params, token: FH }).toString();
  const res = await fetch(`${FH_BASE}${endpoint}?${qs}`);
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 2000));
    return fhFetch(endpoint, params);
  }
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  return res.json();
}

async function avFetch(fn, params = {}) {
  const qs = new URLSearchParams({ function: fn, ...params, apikey: AV }).toString();
  const res = await fetch(`${AV_BASE}?${qs}`);
  if (!res.ok) throw new Error(`AV ${res.status}`);
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// QUOTES & PRICES
// ═══════════════════════════════════════════════════════════════

export function getQuote(symbol) {
  return cached(`quote:${symbol}`, TTL.quote, () => fhFetch('/quote', { symbol }));
}

export function getCandles(symbol, resolution = 'D', from, to) {
  if (!from) { from = Math.floor(Date.now() / 1000) - (resolution === 'D' ? 365 * 86400 : resolution === 'W' ? 730 * 86400 : 30 * 86400); }
  if (!to) to = Math.floor(Date.now() / 1000);
  return cached(`candles:${symbol}:${resolution}:${from}`, TTL.general, () =>
    fhFetch('/stock/candle', { symbol, resolution, from, to })
  );
}

export function getIntradayCandles(symbol, interval = '5min') {
  return cached(`intraday:${symbol}:${interval}`, TTL.general, () =>
    avFetch('TIME_SERIES_INTRADAY', { symbol, interval, outputsize: 'full' })
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPANY DATA
// ═══════════════════════════════════════════════════════════════

export function getProfile(symbol) {
  return cached(`profile:${symbol}`, TTL.profile, () => fhFetch('/stock/profile2', { symbol }));
}

export function getPeers(symbol) {
  return cached(`peers:${symbol}`, TTL.profile, () => fhFetch('/stock/peers', { symbol }));
}

export function getFinancials(symbol) {
  return cached(`financials:${symbol}`, TTL.financials, () =>
    fhFetch('/stock/metric', { symbol, metric: 'all' })
  );
}

export function getEarnings(symbol, limit = 12) {
  return cached(`earnings:${symbol}`, TTL.financials, () =>
    fhFetch('/stock/earnings', { symbol, limit })
  );
}

export function getRecommendations(symbol) {
  return cached(`recs:${symbol}`, TTL.financials, () =>
    fhFetch('/stock/recommendation', { symbol })
  );
}

export function getPriceTarget(symbol) {
  return cached(`pt:${symbol}`, TTL.financials, () =>
    fhFetch('/stock/price-target', { symbol })
  );
}

export function getInsiderTransactions(symbol) {
  return cached(`insiders:${symbol}`, TTL.financials, () =>
    fhFetch('/stock/insider-transactions', { symbol })
  );
}

export function getInsiderSentiment(symbol, from, to) {
  if (!from) from = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
  if (!to) to = new Date().toISOString().split('T')[0];
  return cached(`insider-sent:${symbol}`, TTL.financials, () =>
    fhFetch('/stock/insider-sentiment', { symbol, from, to })
  );
}

export function getSECFilings(symbol) {
  return cached(`filings:${symbol}`, TTL.financials, () =>
    fhFetch('/stock/filings', { symbol })
  );
}

export function getFinancialsReported(symbol, freq = 'quarterly') {
  return cached(`fin-reported:${symbol}:${freq}`, TTL.financials, () =>
    fhFetch('/stock/financials-reported', { symbol, freq })
  );
}

// ═══════════════════════════════════════════════════════════════
// NEWS
// ═══════════════════════════════════════════════════════════════

export function getCompanyNews(symbol, from, to) {
  if (!from) from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  if (!to) to = new Date().toISOString().split('T')[0];
  return cached(`news:${symbol}:${from}`, TTL.news, () =>
    fhFetch('/company-news', { symbol, from, to })
  );
}

export function getMarketNews(category = 'general') {
  return cached(`mnews:${category}`, TTL.news, () =>
    fhFetch('/news', { category })
  );
}

// ═══════════════════════════════════════════════════════════════
// CALENDARS
// ═══════════════════════════════════════════════════════════════

export function getEarningsCalendar(from, to) {
  if (!from) from = new Date().toISOString().split('T')[0];
  if (!to) to = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  return cached(`ecal:${from}`, TTL.calendar, () =>
    fhFetch('/calendar/earnings', { from, to })
  );
}

export function getIPOCalendar(from, to) {
  if (!from) from = new Date().toISOString().split('T')[0];
  if (!to) to = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  return cached(`ipo:${from}`, TTL.calendar, () =>
    fhFetch('/calendar/ipo', { from, to })
  );
}

export function getEconomicCalendar() {
  const from = new Date().toISOString().split('T')[0];
  const to = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  return cached('econ-cal', TTL.calendar, () =>
    fhFetch('/calendar/economic', { from, to })
  );
}

// ═══════════════════════════════════════════════════════════════
// FOREX & CRYPTO
// ═══════════════════════════════════════════════════════════════

export function getForexRates() {
  return cached('fx-rates', TTL.quote, () => fhFetch('/forex/rates', { base: 'USD' }));
}

export function getForexCandles(symbol, resolution = 'D', from, to) {
  if (!from) from = Math.floor(Date.now() / 1000) - 90 * 86400;
  if (!to) to = Math.floor(Date.now() / 1000);
  return cached(`fxc:${symbol}:${resolution}`, TTL.general, () =>
    fhFetch('/forex/candle', { symbol, resolution, from, to })
  );
}

export function getCryptoCandles(symbol, resolution = 'D', from, to) {
  if (!from) from = Math.floor(Date.now() / 1000) - 90 * 86400;
  if (!to) to = Math.floor(Date.now() / 1000);
  return cached(`crypto:${symbol}:${resolution}`, TTL.general, () =>
    fhFetch('/crypto/candle', { symbol, resolution, from, to })
  );
}

// ═══════════════════════════════════════════════════════════════
// TECHNICAL — Pattern Recognition & Support/Resistance
// ═══════════════════════════════════════════════════════════════

export function getPatternRecognition(symbol, resolution = 'D') {
  return cached(`patterns:${symbol}:${resolution}`, TTL.general, () =>
    fhFetch('/scan/pattern', { symbol, resolution })
  );
}

export function getSupportResistance(symbol, resolution = 'D') {
  return cached(`sr:${symbol}:${resolution}`, TTL.general, () =>
    fhFetch('/scan/support-resistance', { symbol, resolution })
  );
}

export function getAggregateIndicator(symbol, resolution = 'D') {
  return cached(`agg:${symbol}:${resolution}`, TTL.general, () =>
    fhFetch('/scan/technical-indicator', { symbol, resolution })
  );
}

// ═══════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════

export function searchSymbol(q) {
  if (!q || q.length < 1) return Promise.resolve({ result: [] });
  return cached(`search:${q}`, 30000, () => fhFetch('/search', { q }));
}

// ═══════════════════════════════════════════════════════════════
// BULK QUOTES (for watchlist / ticker bar)
// ═══════════════════════════════════════════════════════════════

export async function getBulkQuotes(symbols) {
  const results = {};
  const promises = symbols.map(s => getQuote(s).then(q => { results[s] = q; }));
  await Promise.allSettled(promises);
  return results;
}

// ═══════════════════════════════════════════════════════════════
// WEBSOCKET (Finnhub real-time trades)
// ═══════════════════════════════════════════════════════════════

let ws = null;
let wsSubscriptions = new Set();
let wsCallbacks = [];
let wsReconnectTimer = null;

export function connectWebSocket() {
  if (ws && ws.readyState <= 1) return;
  if (typeof window === 'undefined') return;

  ws = new WebSocket(`wss://ws.finnhub.io?token=${FH}`);

  ws.onopen = () => {
    wsSubscriptions.forEach(s => {
      ws.send(JSON.stringify({ type: 'subscribe', symbol: s }));
    });
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'trade' && msg.data) {
        wsCallbacks.forEach(cb => cb(msg.data));
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => ws.close();
}

export function subscribeSymbol(symbol) {
  wsSubscriptions.add(symbol);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'subscribe', symbol }));
  }
}

export function unsubscribeSymbol(symbol) {
  wsSubscriptions.delete(symbol);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
  }
}

export function onTrade(callback) {
  wsCallbacks.push(callback);
  return () => { wsCallbacks = wsCallbacks.filter(cb => cb !== callback); };
}

// ═══════════════════════════════════════════════════════════════
// SENTIMENT ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════

const BULL_WORDS = ['surge','rally','beat','upgrade','record','gain','boost','strong','soar','bullish','outperform','buy','breakout','growth','profit','positive','optimistic','rise','raises','exceed','recovery','jumps','climbs','accelerat','expand','upbeat','rosy','boom','high','top','best','exceed','smash','crushes'];
const BEAR_WORDS = ['drop','fall','miss','downgrade','crash','loss','weak','plunge','bearish','underperform','sell','breakdown','decline','negative','pessimistic','cut','slash','fear','warn','risk','debt','layoff','recession','tumbl','sink','worst','low','concern','threat','disappoint','misses','slump','tank','slide','dump','panic'];

const SOURCE_TIERS = {
  'reuters.com': 3, 'bloomberg.com': 3, 'wsj.com': 3, 'ft.com': 3, 'cnbc.com': 2, 'marketwatch.com': 2,
  'seekingalpha.com': 2, 'barrons.com': 2, 'finance.yahoo.com': 2, 'thestreet.com': 1, 'investopedia.com': 1, 'benzinga.com': 1,
};

export function analyzeSentiment(headline, source = '') {
  if (!headline) return { label: 'NEUTRAL', score: 0, color: '#6b7280', bg: 'rgba(107,114,128,0.1)', tier: 1 };
  const h = headline.toLowerCase();
  let score = 0;
  BULL_WORDS.forEach(w => { if (h.includes(w)) score++; });
  BEAR_WORDS.forEach(w => { if (h.includes(w)) score--; });
  
  const tier = Object.entries(SOURCE_TIERS).find(([domain]) => source.includes(domain))?.[1] || 1;
  
  if (score >= 2) return { label: 'BULLISH', score, color: '#26a69a', bg: 'rgba(38,166,154,0.12)', tier };
  if (score <= -2) return { label: 'BEARISH', score, color: '#ef5350', bg: 'rgba(239,83,80,0.12)', tier };
  if (score > 0) return { label: 'BULLISH', score, color: '#26a69a', bg: 'rgba(38,166,154,0.08)', tier };
  if (score < 0) return { label: 'BEARISH', score, color: '#ef5350', bg: 'rgba(239,83,80,0.08)', tier };
  return { label: 'NEUTRAL', score: 0, color: '#6b7280', bg: 'rgba(107,114,128,0.08)', tier };
}

export function getNewsImpact(headline, source = '') {
  const s = analyzeSentiment(headline, source);
  const absScore = Math.abs(s.score);
  if (absScore >= 3 && s.tier >= 2) return 'HIGH';
  if (absScore >= 2 || s.tier >= 3) return 'MEDIUM';
  return 'LOW';
}

// ═══════════════════════════════════════════════════════════════
// FORMATTING UTILITIES
// ═══════════════════════════════════════════════════════════════

export function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtB(n) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}

export function fmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

export function timeAgo(ts) {
  if (!ts) return '';
  const d = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime();
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function unixToDate(ts) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function unixToDateTime(ts) {
  return new Date(ts * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
