// ═══════════════════════════════════════════════════════════════
// SIGMA TERMINAL PRO — Technical Indicators Engine
// All calculations run client-side on OHLCV arrays
// ═══════════════════════════════════════════════════════════════

// ── Helpers ──────────────────────────────────────────────────
function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function stddev(arr) { const m = avg(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length); }

// ═══════════════════════════════════════════════════════════════
// MOVING AVERAGES
// ═══════════════════════════════════════════════════════════════

export function calcSMA(data, period, key = 'c') {
  const src = data.map(d => typeof d === 'number' ? d : d[key] ?? d.close ?? d);
  const result = new Array(src.length).fill(null);
  for (let i = period - 1; i < src.length; i++) {
    result[i] = avg(src.slice(i - period + 1, i + 1));
  }
  return result;
}

export function calcEMA(data, period, key = 'c') {
  const src = data.map(d => typeof d === 'number' ? d : d[key] ?? d.close ?? d);
  const result = new Array(src.length).fill(null);
  const k = 2 / (period + 1);
  let ema = avg(src.slice(0, period));
  result[period - 1] = ema;
  for (let i = period; i < src.length; i++) {
    ema = src[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// RSI (Wilder's Smoothing)
// ═══════════════════════════════════════════════════════════════

export function calcRSI(data, period = 14, key = 'c') {
  const src = data.map(d => typeof d === 'number' ? d : d[key] ?? d.close ?? d);
  const result = new Array(src.length).fill(null);
  if (src.length < period + 1) return result;

  let gainSum = 0, lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = src[i] - src[i - 1];
    if (diff > 0) gainSum += diff; else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < src.length; i++) {
    const diff = src[i] - src[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// MACD (12, 26, 9)
// ═══════════════════════════════════════════════════════════════

export function calcMACD(data, fast = 12, slow = 26, signal = 9, key = 'c') {
  const emaFast = calcEMA(data, fast, key);
  const emaSlow = calcEMA(data, slow, key);
  const macdLine = emaFast.map((v, i) => (v != null && emaSlow[i] != null) ? v - emaSlow[i] : null);
  
  const validMacd = macdLine.filter(v => v !== null);
  const signalEma = calcEMA(validMacd, signal);
  
  const signalLine = new Array(macdLine.length).fill(null);
  let idx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) {
      signalLine[i] = signalEma[idx] ?? null;
      idx++;
    }
  }
  
  const histogram = macdLine.map((v, i) => (v != null && signalLine[i] != null) ? v - signalLine[i] : null);
  return { macd: macdLine, signal: signalLine, histogram };
}

// ═══════════════════════════════════════════════════════════════
// BOLLINGER BANDS
// ═══════════════════════════════════════════════════════════════

export function calcBollinger(data, period = 20, mult = 2, key = 'c') {
  const src = data.map(d => typeof d === 'number' ? d : d[key] ?? d.close ?? d);
  const upper = new Array(src.length).fill(null);
  const middle = new Array(src.length).fill(null);
  const lower = new Array(src.length).fill(null);

  for (let i = period - 1; i < src.length; i++) {
    const slice = src.slice(i - period + 1, i + 1);
    const m = avg(slice);
    const sd = stddev(slice);
    middle[i] = m;
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { upper, middle, lower };
}

// ═══════════════════════════════════════════════════════════════
// STOCHASTIC OSCILLATOR
// ═══════════════════════════════════════════════════════════════

export function calcStochastic(data, kPeriod = 14, dPeriod = 3) {
  const kValues = new Array(data.length).fill(null);
  const dValues = new Array(data.length).fill(null);

  for (let i = kPeriod - 1; i < data.length; i++) {
    const slice = data.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map(d => d.h ?? d.high ?? d));
    const low = Math.min(...slice.map(d => d.l ?? d.low ?? d));
    const close = data[i].c ?? data[i].close ?? data[i];
    kValues[i] = high === low ? 50 : ((close - low) / (high - low)) * 100;
  }

  for (let i = kPeriod - 1 + dPeriod - 1; i < data.length; i++) {
    const slice = kValues.slice(i - dPeriod + 1, i + 1).filter(v => v !== null);
    if (slice.length === dPeriod) dValues[i] = avg(slice);
  }

  return { k: kValues, d: dValues };
}

// ═══════════════════════════════════════════════════════════════
// ATR (Average True Range)
// ═══════════════════════════════════════════════════════════════

export function calcATR(data, period = 14) {
  const result = new Array(data.length).fill(null);
  const tr = data.map((d, i) => {
    if (i === 0) return (d.h ?? d.high) - (d.l ?? d.low);
    const prev = data[i - 1].c ?? data[i - 1].close;
    return Math.max(
      (d.h ?? d.high) - (d.l ?? d.low),
      Math.abs((d.h ?? d.high) - prev),
      Math.abs((d.l ?? d.low) - prev)
    );
  });

  if (tr.length >= period) {
    result[period - 1] = avg(tr.slice(0, period));
    for (let i = period; i < tr.length; i++) {
      result[i] = (result[i - 1] * (period - 1) + tr[i]) / period;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// OBV (On Balance Volume)
// ═══════════════════════════════════════════════════════════════

export function calcOBV(data) {
  const result = new Array(data.length).fill(null);
  result[0] = data[0]?.v ?? data[0]?.volume ?? 0;
  for (let i = 1; i < data.length; i++) {
    const close = data[i].c ?? data[i].close;
    const prevClose = data[i - 1].c ?? data[i - 1].close;
    const vol = data[i].v ?? data[i].volume ?? 0;
    if (close > prevClose) result[i] = result[i - 1] + vol;
    else if (close < prevClose) result[i] = result[i - 1] - vol;
    else result[i] = result[i - 1];
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// CCI (Commodity Channel Index)
// ═══════════════════════════════════════════════════════════════

export function calcCCI(data, period = 20) {
  const result = new Array(data.length).fill(null);
  const tp = data.map(d => ((d.h ?? d.high) + (d.l ?? d.low) + (d.c ?? d.close)) / 3);

  for (let i = period - 1; i < tp.length; i++) {
    const slice = tp.slice(i - period + 1, i + 1);
    const m = avg(slice);
    const md = avg(slice.map(v => Math.abs(v - m)));
    result[i] = md === 0 ? 0 : (tp[i] - m) / (0.015 * md);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// WILLIAMS %R
// ═══════════════════════════════════════════════════════════════

export function calcWilliamsR(data, period = 14) {
  const result = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map(d => d.h ?? d.high));
    const low = Math.min(...slice.map(d => d.l ?? d.low));
    const close = data[i].c ?? data[i].close;
    result[i] = high === low ? -50 : ((high - close) / (high - low)) * -100;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// ADX / DMI
// ═══════════════════════════════════════════════════════════════

export function calcADX(data, period = 14) {
  const len = data.length;
  const plusDI = new Array(len).fill(null);
  const minusDI = new Array(len).fill(null);
  const adx = new Array(len).fill(null);

  const tr = [], plusDM = [], minusDM = [];
  for (let i = 1; i < len; i++) {
    const h = data[i].h ?? data[i].high, l = data[i].l ?? data[i].low;
    const ph = data[i - 1].h ?? data[i - 1].high, pl = data[i - 1].l ?? data[i - 1].low;
    const pc = data[i - 1].c ?? data[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    const up = h - ph, down = pl - l;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }

  if (tr.length < period) return { plusDI, minusDI, adx };

  let sTR = avg(tr.slice(0, period)) * period;
  let sPDM = avg(plusDM.slice(0, period)) * period;
  let sNDM = avg(minusDM.slice(0, period)) * period;

  for (let i = period; i < tr.length; i++) {
    sTR = sTR - sTR / period + tr[i];
    sPDM = sPDM - sPDM / period + plusDM[i];
    sNDM = sNDM - sNDM / period + minusDM[i];
    plusDI[i + 1] = sTR === 0 ? 0 : (sPDM / sTR) * 100;
    minusDI[i + 1] = sTR === 0 ? 0 : (sNDM / sTR) * 100;
    const sum = plusDI[i + 1] + minusDI[i + 1];
    const dx = sum === 0 ? 0 : Math.abs(plusDI[i + 1] - minusDI[i + 1]) / sum * 100;
    if (i === period) adx[i + 1] = dx;
    else if (adx[i] != null) adx[i + 1] = (adx[i] * (period - 1) + dx) / period;
  }

  return { plusDI, minusDI, adx };
}

// ═══════════════════════════════════════════════════════════════
// VWAP (Volume Weighted Average Price)
// ═══════════════════════════════════════════════════════════════

export function calcVWAP(data) {
  const result = new Array(data.length).fill(null);
  let cumTPV = 0, cumVol = 0;
  for (let i = 0; i < data.length; i++) {
    const tp = ((data[i].h ?? data[i].high) + (data[i].l ?? data[i].low) + (data[i].c ?? data[i].close)) / 3;
    const vol = data[i].v ?? data[i].volume ?? 0;
    cumTPV += tp * vol;
    cumVol += vol;
    result[i] = cumVol === 0 ? tp : cumTPV / cumVol;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// RATE OF CHANGE (ROC)
// ═══════════════════════════════════════════════════════════════

export function calcROC(data, period = 12, key = 'c') {
  const src = data.map(d => typeof d === 'number' ? d : d[key] ?? d.close ?? d);
  const result = new Array(src.length).fill(null);
  for (let i = period; i < src.length; i++) {
    result[i] = src[i - period] === 0 ? 0 : ((src[i] - src[i - period]) / src[i - period]) * 100;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// MFI (Money Flow Index)
// ═══════════════════════════════════════════════════════════════

export function calcMFI(data, period = 14) {
  const result = new Array(data.length).fill(null);
  const tp = data.map(d => ((d.h ?? d.high) + (d.l ?? d.low) + (d.c ?? d.close)) / 3);
  const mf = tp.map((v, i) => v * (data[i].v ?? data[i].volume ?? 0));

  for (let i = period; i < data.length; i++) {
    let posMF = 0, negMF = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) posMF += mf[j];
      else negMF += mf[j];
    }
    result[i] = negMF === 0 ? 100 : 100 - 100 / (1 + posMF / negMF);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// HEIKIN-ASHI CANDLE TRANSFORM
// ═══════════════════════════════════════════════════════════════

export function toHeikinAshi(data) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    const o = data[i].o ?? data[i].open;
    const h = data[i].h ?? data[i].high;
    const l = data[i].l ?? data[i].low;
    const c = data[i].c ?? data[i].close;
    const haC = (o + h + l + c) / 4;
    const haO = i === 0 ? (o + c) / 2 : (result[i - 1].o + result[i - 1].c) / 2;
    const haH = Math.max(h, haO, haC);
    const haL = Math.min(l, haO, haC);
    result.push({ ...data[i], o: haO, h: haH, l: haL, c: haC });
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// PIVOT POINTS
// ═══════════════════════════════════════════════════════════════

export function calcPivotPoints(high, low, close) {
  const pp = (high + low + close) / 3;
  return {
    pp,
    r1: 2 * pp - low, s1: 2 * pp - high,
    r2: pp + (high - low), s2: pp - (high - low),
    r3: high + 2 * (pp - low), s3: low - 2 * (high - pp),
  };
}
