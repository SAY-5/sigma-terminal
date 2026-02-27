# Σ Sigma Terminal Pro

**Institutional-grade real-time financial intelligence platform**

Built with Next.js 14, Canvas-rendered charts, Finnhub WebSocket, and Claude AI.

## Features
- Real-time streaming quotes via Finnhub WebSocket
- Canvas-rendered candlestick charts (no chart libraries)
- 15+ technical indicators (SMA, EMA, RSI, MACD, Bollinger, Stochastic, ADX, ATR, OBV, CCI, VWAP, etc.)
- AI-powered equity research (Claude API)
- Company deep analysis with financials, earnings, insider transactions, peers, SEC filings
- Sentiment-tagged news with source quality weighting
- Portfolio tracker with P&L
- Price alerts
- Economic, Earnings, and IPO calendars
- Forex dashboard
- Command palette (⌘K) with keyboard shortcuts
- Bloomberg Terminal dark aesthetic

## Deploy
```bash
npm install
npm run build
```

Set environment variables:
- `NEXT_PUBLIC_FINNHUB_KEY`
- `NEXT_PUBLIC_AV_KEY`
