'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { getCandles, getQuote, getSupportResistance, fmt, fmtPct, fmtB, unixToDate, unixToDateTime } from '@/lib/api';
import { calcSMA, calcEMA, calcRSI, calcMACD, calcBollinger, calcStochastic, calcATR, calcOBV, calcVWAP, calcCCI, calcWilliamsR, toHeikinAshi } from '@/lib/indicators';

const TIMEFRAMES = [
  { key: '5', label: '5m' }, { key: '15', label: '15m' }, { key: '60', label: '1H' },
  { key: 'D', label: '1D' }, { key: 'W', label: '1W' }, { key: 'M', label: '1M' },
];

const OVERLAY_LIST = [
  { key: 'sma20', label: 'SMA 20', color: '#f59e0b' }, { key: 'sma50', label: 'SMA 50', color: '#8b5cf6' },
  { key: 'sma200', label: 'SMA 200', color: '#ef5350' }, { key: 'ema12', label: 'EMA 12', color: '#06b6d4' },
  { key: 'ema26', label: 'EMA 26', color: '#ec4899' }, { key: 'bollinger', label: 'BB', color: '#6366f1' },
  { key: 'vwap', label: 'VWAP', color: '#22c55e' },
];

const OSC_LIST = [
  { key: 'rsi', label: 'RSI' }, { key: 'macd', label: 'MACD' },
  { key: 'stochastic', label: 'STOCH' }, { key: 'atr', label: 'ATR' },
  { key: 'obv', label: 'OBV' }, { key: 'cci', label: 'CCI' },
];

export default function ChartPage() {
  const { activeSymbol, chartTimeframe, setChartTimeframe, overlays, toggleOverlay, oscillators, toggleOscillator, chartType, setChartType } = useStore();
  const canvasRef = useRef(null);
  const oscCanvasRef = useRef(null);
  const [candles, setCandles] = useState([]);
  const [quote, setQuote] = useState(null);
  const [hover, setHover] = useState(null);
  const [srLevels, setSrLevels] = useState(null);

  // ── Fetch Data ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [candleData, quoteData, sr] = await Promise.allSettled([
        getCandles(activeSymbol, chartTimeframe),
        getQuote(activeSymbol),
        getSupportResistance(activeSymbol, chartTimeframe),
      ]);
      const cd = candleData.value;
      if (cd && cd.s === 'ok' && cd.c) {
        const arr = cd.t.map((t, i) => ({ t, o: cd.o[i], h: cd.h[i], l: cd.l[i], c: cd.c[i], v: cd.v[i] }));
        setCandles(arr);
      }
      setQuote(quoteData.value || null);
      setSrLevels(sr.value || null);
    };
    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, [activeSymbol, chartTimeframe]);

  // ── Draw Main Chart ─────────────────────────────────────
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const pad = { t: 10, r: 65, b: 24, l: 5 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;

    let data = chartType === 'heikinashi' ? toHeikinAshi(candles) : candles;
    const visibleCount = Math.min(data.length, Math.floor(cw / 5));
    data = data.slice(-visibleCount);

    const highs = data.map(d => d.h), lows = data.map(d => d.l);
    let priceMax = Math.max(...highs), priceMin = Math.min(...lows);
    const pPad = (priceMax - priceMin) * 0.05;
    priceMax += pPad; priceMin -= pPad;
    const barW = cw / data.length;
    const toX = (i) => pad.l + i * barW + barW / 2;
    const toY = (p) => pad.t + ch * (1 - (p - priceMin) / (priceMax - priceMin));

    // Clear
    ctx.fillStyle = '#07070c';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(26,26,37,0.6)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = pad.t + (ch / 5) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      const price = priceMax - (priceMax - priceMin) * (i / 5);
      ctx.fillStyle = '#666675';
      ctx.font = '9px JetBrains Mono';
      ctx.textAlign = 'left';
      ctx.fillText(fmt(price), W - pad.r + 4, y + 3);
    }

    // Time labels
    ctx.fillStyle = '#444450'; ctx.font = '8px JetBrains Mono'; ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(data.length / 8));
    for (let i = 0; i < data.length; i += step) {
      ctx.fillText(unixToDate(data[i].t), toX(i), H - 4);
    }

    // Support/Resistance
    if (srLevels?.levels) {
      ctx.setLineDash([4, 4]);
      srLevels.levels.forEach(level => {
        if (level >= priceMin && level <= priceMax) {
          ctx.strokeStyle = 'rgba(139,92,246,0.3)';
          ctx.beginPath(); ctx.moveTo(pad.l, toY(level)); ctx.lineTo(W - pad.r, toY(level)); ctx.stroke();
        }
      });
      ctx.setLineDash([]);
    }

    // Bollinger Bands
    if (overlays.bollinger) {
      const bb = calcBollinger(data, 20, 2);
      ctx.fillStyle = 'rgba(99,102,241,0.04)';
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        if (bb.upper[i] != null) { i === 0 ? ctx.moveTo(toX(i), toY(bb.upper[i])) : ctx.lineTo(toX(i), toY(bb.upper[i])); }
      }
      for (let i = data.length - 1; i >= 0; i--) {
        if (bb.lower[i] != null) ctx.lineTo(toX(i), toY(bb.lower[i]));
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(99,102,241,0.5)'; ctx.lineWidth = 1;
      [bb.upper, bb.lower].forEach(line => {
        ctx.beginPath();
        line.forEach((v, i) => { if (v != null) { i === 0 || line[i-1] == null ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); }});
        ctx.stroke();
      });
    }

    // Volume bars
    const maxVol = Math.max(...data.map(d => d.v || 0));
    const volH = ch * 0.15;
    data.forEach((d, i) => {
      const vol = d.v || 0;
      const h = (vol / maxVol) * volH;
      const up = d.c >= d.o;
      ctx.fillStyle = up ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)';
      ctx.fillRect(toX(i) - barW * 0.35, pad.t + ch - h, barW * 0.7, h);
    });

    // Candlesticks
    data.forEach((d, i) => {
      const x = toX(i);
      const up = d.c >= d.o;
      const color = up ? 'rgba(38,166,154,0.9)' : 'rgba(239,83,80,0.9)';
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1;
      // Wick
      ctx.beginPath(); ctx.moveTo(x, toY(d.h)); ctx.lineTo(x, toY(d.l)); ctx.stroke();
      // Body
      const bodyTop = toY(Math.max(d.o, d.c));
      const bodyBot = toY(Math.min(d.o, d.c));
      const bodyH = Math.max(bodyBot - bodyTop, 1);
      const bodyW = Math.max(barW * 0.6, 1);
      if (up) { ctx.strokeRect(x - bodyW/2, bodyTop, bodyW, bodyH); }
      else { ctx.fillRect(x - bodyW/2, bodyTop, bodyW, bodyH); }
    });

    // Overlays
    const drawLine = (values, color, width = 1.2) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      let started = false;
      values.forEach((v, i) => {
        if (v != null) { started ? ctx.lineTo(toX(i), toY(v)) : ctx.moveTo(toX(i), toY(v)); started = true; }
      });
      ctx.stroke();
    };

    if (overlays.sma20) drawLine(calcSMA(data, 20), '#f59e0b');
    if (overlays.sma50) drawLine(calcSMA(data, 50), '#8b5cf6');
    if (overlays.sma200) drawLine(calcSMA(data, 200), '#ef5350');
    if (overlays.ema12) drawLine(calcEMA(data, 12), '#06b6d4');
    if (overlays.ema26) drawLine(calcEMA(data, 26), '#ec4899');
    if (overlays.vwap) drawLine(calcVWAP(data), '#22c55e');

    // Crosshair
    if (hover && hover.idx >= 0 && hover.idx < data.length) {
      const d = data[hover.idx];
      const x = toX(hover.idx);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.5; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ch); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.l, hover.y); ctx.lineTo(W - pad.r, hover.y); ctx.stroke();
      ctx.setLineDash([]);
      // Price label
      const hoverPrice = priceMin + (1 - (hover.y - pad.t) / ch) * (priceMax - priceMin);
      ctx.fillStyle = '#1a1a25'; ctx.fillRect(W - pad.r, hover.y - 8, pad.r, 16);
      ctx.fillStyle = '#e0e0e8'; ctx.font = '9px JetBrains Mono'; ctx.textAlign = 'left';
      ctx.fillText(fmt(hoverPrice), W - pad.r + 3, hover.y + 3);
    }

    // Store mapping for mouse handler
    canvas._chartData = { data, toX, toY, pad, barW, priceMin, priceMax, W, H, ch };
  }, [candles, overlays, chartType, hover, srLevels]);

  // ── Draw Oscillator Chart ───────────────────────────────
  const drawOscillator = useCallback(() => {
    const canvas = oscCanvasRef.current;
    if (!canvas || candles.length === 0) return;
    const activeOsc = Object.entries(oscillators).filter(([_, v]) => v).map(([k]) => k);
    if (activeOsc.length === 0) { canvas.style.display = 'none'; return; }
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const pad = { t: 4, r: 65, b: 4, l: 5 };
    const cw = W - pad.l - pad.r;
    const sliceH = (H - pad.t - pad.b) / activeOsc.length;

    let data = chartType === 'heikinashi' ? toHeikinAshi(candles) : candles;
    const visibleCount = Math.min(data.length, Math.floor(cw / 5));
    data = data.slice(-visibleCount);
    const barW = cw / data.length;
    const toX = (i) => pad.l + i * barW + barW / 2;

    ctx.fillStyle = '#07070c'; ctx.fillRect(0, 0, W, H);

    activeOsc.forEach((osc, oscIdx) => {
      const top = pad.t + oscIdx * sliceH;
      const bot = top + sliceH - 2;
      const oscH = bot - top;
      ctx.strokeStyle = 'rgba(26,26,37,0.6)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, bot); ctx.lineTo(W - pad.r, bot); ctx.stroke();

      // Label
      ctx.fillStyle = '#666675'; ctx.font = '8px JetBrains Mono'; ctx.textAlign = 'left';
      ctx.fillText(osc.toUpperCase(), pad.l + 2, top + 10);

      if (osc === 'rsi') {
        const rsi = calcRSI(data, 14);
        const toY = (v) => top + oscH * (1 - v / 100);
        // Zones
        ctx.fillStyle = 'rgba(239,83,80,0.05)'; ctx.fillRect(pad.l, toY(100), cw, toY(70) - toY(100));
        ctx.fillStyle = 'rgba(38,166,154,0.05)'; ctx.fillRect(pad.l, toY(30), cw, toY(0) - toY(30));
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.setLineDash([2,2]);
        [70, 50, 30].forEach(lv => { ctx.beginPath(); ctx.moveTo(pad.l, toY(lv)); ctx.lineTo(W-pad.r, toY(lv)); ctx.stroke(); });
        ctx.setLineDash([]);
        // Line
        ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 1.2; ctx.beginPath();
        rsi.forEach((v, i) => { if (v != null) ctx.lineTo(toX(i), toY(v)); });
        ctx.stroke();
        // Labels
        ctx.fillStyle = '#444450'; ctx.font = '8px JetBrains Mono'; ctx.textAlign = 'left';
        [70, 30].forEach(lv => ctx.fillText(lv.toString(), W - pad.r + 3, toY(lv) + 3));
      }

      if (osc === 'macd') {
        const { macd, signal, histogram } = calcMACD(data);
        const vals = [...macd, ...signal, ...histogram].filter(v => v != null);
        const max = Math.max(...vals.map(Math.abs), 0.01);
        const toY = (v) => top + oscH / 2 - (v / max) * (oscH / 2 - 4);
        // Zero line
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath();
        ctx.moveTo(pad.l, toY(0)); ctx.lineTo(W - pad.r, toY(0)); ctx.stroke();
        // Histogram
        histogram.forEach((v, i) => {
          if (v != null) {
            ctx.fillStyle = v >= 0 ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)';
            const h = Math.abs(toY(v) - toY(0));
            ctx.fillRect(toX(i) - barW * 0.35, v >= 0 ? toY(v) : toY(0), barW * 0.7, h);
          }
        });
        // MACD line
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.2; ctx.beginPath();
        macd.forEach((v, i) => { if (v != null) ctx.lineTo(toX(i), toY(v)); }); ctx.stroke();
        // Signal line
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1; ctx.beginPath();
        signal.forEach((v, i) => { if (v != null) ctx.lineTo(toX(i), toY(v)); }); ctx.stroke();
      }

      if (osc === 'stochastic') {
        const { k, d } = calcStochastic(data);
        const toY = (v) => top + oscH * (1 - (v ?? 50) / 100);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.setLineDash([2,2]);
        [80, 20].forEach(lv => { ctx.beginPath(); ctx.moveTo(pad.l, toY(lv)); ctx.lineTo(W-pad.r, toY(lv)); ctx.stroke(); });
        ctx.setLineDash([]);
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.2; ctx.beginPath();
        k.forEach((v, i) => { if (v != null) ctx.lineTo(toX(i), toY(v)); }); ctx.stroke();
        ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 1; ctx.beginPath();
        d.forEach((v, i) => { if (v != null) ctx.lineTo(toX(i), toY(v)); }); ctx.stroke();
      }

      if (osc === 'atr') {
        const atr = calcATR(data);
        const max = Math.max(...atr.filter(v => v != null));
        const toY = (v) => bot - ((v ?? 0) / max) * (oscH - 8);
        ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 1.2; ctx.beginPath();
        atr.forEach((v, i) => { if (v != null) ctx.lineTo(toX(i), toY(v)); }); ctx.stroke();
      }

      if (osc === 'obv') {
        const obv = calcOBV(data);
        const max = Math.max(...obv.map(Math.abs));
        const toY = (v) => top + oscH / 2 - ((v ?? 0) / max) * (oscH / 2 - 4);
        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1.2; ctx.beginPath();
        obv.forEach((v, i) => { if (v != null) ctx.lineTo(toX(i), toY(v)); }); ctx.stroke();
      }

      if (osc === 'cci') {
        const cci = calcCCI(data);
        const max = Math.max(...cci.filter(v => v != null).map(Math.abs), 100);
        const toY = (v) => top + oscH / 2 - ((v ?? 0) / max) * (oscH / 2 - 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.setLineDash([2,2]);
        [100, -100].forEach(lv => { ctx.beginPath(); ctx.moveTo(pad.l, toY(lv)); ctx.lineTo(W-pad.r, toY(lv)); ctx.stroke(); });
        ctx.setLineDash([]);
        ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.2; ctx.beginPath();
        cci.forEach((v, i) => { if (v != null) ctx.lineTo(toX(i), toY(v)); }); ctx.stroke();
      }
    });
  }, [candles, oscillators, chartType]);

  useEffect(() => { drawChart(); }, [drawChart]);
  useEffect(() => { drawOscillator(); }, [drawOscillator]);
  useEffect(() => {
    const resize = () => { drawChart(); drawOscillator(); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [drawChart, drawOscillator]);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas?._chartData) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const { data, barW, pad } = canvas._chartData;
    const idx = Math.floor((x - pad.l) / barW);
    if (idx >= 0 && idx < data.length) setHover({ idx, x, y, candle: data[idx] });
  };

  const activeOscCount = Object.values(oscillators).filter(Boolean).length;
  const chg = quote?.dp ?? 0;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* Quote Header */}
      <div style={{ padding: '6px 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-0)' }}>{activeSymbol}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-0)' }}>{fmt(quote?.c)}</span>
        <span className={chg >= 0 ? 'positive' : 'negative'} style={{ fontSize: 12, fontWeight: 600 }}>{fmtPct(chg)} ({fmt(quote?.d)})</span>
        <span style={{ fontSize: 9, color: 'var(--text-3)' }}>O {fmt(quote?.o)} · H {fmt(quote?.h)} · L {fmt(quote?.l)} · PC {fmt(quote?.pc)}</span>
        {hover?.candle && (
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-2)' }}>
            {unixToDateTime(hover.candle.t)} — O {fmt(hover.candle.o)} H {fmt(hover.candle.h)} L {fmt(hover.candle.l)} C {fmt(hover.candle.c)} V {fmtB(hover.candle.v)}
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className="chart-toolbar">
        {TIMEFRAMES.map(tf => (
          <button key={tf.key} className={`chart-tf-btn ${chartTimeframe === tf.key ? 'active' : ''}`} onClick={() => setChartTimeframe(tf.key)}>{tf.label}</button>
        ))}
        <div className="chart-divider" />
        {[{ key: 'candlestick', label: 'Candle' }, { key: 'heikinashi', label: 'HA' }].map(ct => (
          <button key={ct.key} className={`chart-tf-btn ${chartType === ct.key ? 'active' : ''}`} onClick={() => setChartType(ct.key)}>{ct.label}</button>
        ))}
        <div className="chart-divider" />
        {OVERLAY_LIST.map(ov => (
          <button key={ov.key} className={`chart-overlay-btn ${overlays[ov.key] ? 'active' : ''}`}
            style={overlays[ov.key] ? { borderColor: ov.color, color: ov.color } : {}} onClick={() => toggleOverlay(ov.key)}>{ov.label}</button>
        ))}
        <div className="chart-divider" />
        {OSC_LIST.map(o => (
          <button key={o.key} className={`chart-overlay-btn ${oscillators[o.key] ? 'active' : ''}`} onClick={() => toggleOscillator(o.key)}>{o.label}</button>
        ))}
      </div>

      {/* Main Chart Canvas */}
      <div style={{ flex: activeOscCount > 0 ? '2' : '1', position: 'relative' }}>
        <canvas ref={canvasRef} className="chart-canvas" style={{ width: '100%', height: '100%' }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)} />
      </div>

      {/* Oscillator Canvas */}
      {activeOscCount > 0 && (
        <div style={{ flex: '1', maxHeight: activeOscCount * 80, borderTop: '1px solid var(--border)' }}>
          <canvas ref={oscCanvasRef} className="chart-canvas" style={{ width: '100%', height: '100%' }} />
        </div>
      )}
    </div>
  );
}
