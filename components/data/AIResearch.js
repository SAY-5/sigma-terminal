'use client';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { getQuote, getProfile, getFinancials, getEarnings, getCompanyNews, getPeers, fmt, fmtPct, fmtB } from '@/lib/api';

const AI_MODES = [
  { key: 'research', label: 'Research Brief' },
  { key: 'bullbear', label: 'Bull/Bear' },
  { key: 'whatsmoving', label: "What's Moving" },
  { key: 'earnings', label: 'Earnings Analysis' },
  { key: 'chat', label: 'AI Chat' },
];

async function callClaude(systemPrompt, userPrompt) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || 'Unable to generate analysis.';
  } catch (e) {
    return 'API Error: Unable to reach AI service. This feature requires the Claude API to be accessible from artifacts.';
  }
}

export default function AIResearch() {
  const { activeSymbol } = useStore();
  const [mode, setMode] = useState('research');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const chatRef = useRef(null);

  const gatherContext = async () => {
    const [quote, profile, financials, earnings, news, peers] = await Promise.allSettled([
      getQuote(activeSymbol), getProfile(activeSymbol), getFinancials(activeSymbol),
      getEarnings(activeSymbol, 4), getCompanyNews(activeSymbol), getPeers(activeSymbol),
    ]);
    const q = quote.value, p = profile.value, f = financials.value?.metric, e = earnings.value, n = (news.value || []).slice(0, 5);
    return `
STOCK: ${activeSymbol}
Company: ${p?.name || activeSymbol} | Industry: ${p?.finnhubIndustry || 'N/A'} | Exchange: ${p?.exchange || 'N/A'}
Price: $${fmt(q?.c)} | Change: ${fmtPct(q?.dp)} | Mkt Cap: ${fmtB((p?.marketCapitalization || 0) * 1e6)}
52W High: ${fmt(f?.['52WeekHigh'])} | 52W Low: ${fmt(f?.['52WeekLow'])} | Beta: ${fmt(f?.beta)}
P/E: ${fmt(f?.peBasicExclExtraTTM)} | P/B: ${fmt(f?.pbQuarterly)} | P/S: ${fmt(f?.psTTM)}
ROE: ${fmtPct(f?.roeTTM)} | Net Margin: ${fmtPct(f?.netProfitMarginTTM)} | D/E: ${fmt(f?.['totalDebt/totalEquityQuarterly'])}
EPS TTM: ${fmt(f?.epsBasicExclExtraItemsTTM)} | Div Yield: ${fmtPct(f?.dividendYieldIndicatedAnnual)}
Revenue Growth: ${fmtPct(f?.revenueGrowthQuarterlyYoy)} | EPS Growth: ${fmtPct(f?.epsGrowthQuarterlyYoy)}
Peers: ${(peers.value || []).slice(0, 5).join(', ')}
Recent Earnings: ${(e || []).slice(0, 3).map(x => `Q: EPS ${x.actual} vs Est ${x.estimate} (${fmtPct(x.surprisePercent)} surprise)`).join(' | ')}
Recent Headlines: ${n.map(x => x.headline).join(' | ')}
    `.trim();
  };

  const generate = async () => {
    setLoading(true); setResult('');
    const ctx = await gatherContext();

    const prompts = {
      research: {
        system: 'You are an institutional equity research analyst at a top-tier bank. Write concise, data-driven research briefs. Use markdown. Be specific with numbers.',
        user: `Generate a comprehensive equity research brief for the following stock. Include: 1) Investment Thesis (2-3 sentences), 2) Key Catalysts & Drivers (4-5 specific points with numbers), 3) Risk Factors (3-4 bullets), 4) Valuation Assessment (relative to peers + fair value estimate), 5) Technical Setup, 6) Final Rating: STRONG BUY / BUY / HOLD / SELL / STRONG SELL with 12-month price target.\n\n${ctx}`,
      },
      bullbear: {
        system: 'You are a balanced equity strategist. Present both sides of the investment case with specific evidence and catalysts.',
        user: `Generate a structured Bull Case (250 words) and Bear Case (250 words) for this stock. Each case should include specific catalysts, numbers, and timelines. Use markdown with ## BULL CASE and ## BEAR CASE headers.\n\n${ctx}`,
      },
      whatsmoving: {
        system: 'You are a market analyst explaining stock movements. Be concise and specific.',
        user: `Based on the recent price action, news, and fundamentals below, explain what is driving this stock right now. Synthesize the news headlines, earnings data, and price movement into a clear narrative. 200-300 words.\n\n${ctx}`,
      },
      earnings: {
        system: 'You are an earnings analyst. Provide structured earnings analysis with clear beat/miss assessment.',
        user: `Analyze the recent earnings for this stock. Include: 1) EPS & Revenue beat/miss, 2) Key takeaways, 3) Guidance outlook, 4) Market reaction assessment, 5) Forward implications. Use the data below.\n\n${ctx}`,
      },
    };

    const p = prompts[mode];
    if (p) {
      const text = await callClaude(p.system, p.user);
      setResult(text);
    }
    setLoading(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatHistory(h => [...h, { role: 'user', content: msg }]);
    setLoading(true);
    const ctx = await gatherContext();
    const text = await callClaude(
      'You are a financial AI assistant with access to real-time market data. Answer questions about stocks, markets, and investing. Be concise and data-driven.',
      `Context:\n${ctx}\n\nUser question: ${msg}`
    );
    setChatHistory(h => [...h, { role: 'assistant', content: text }]);
    setLoading(false);
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '6px 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="panel-title">AI Research Lab</span>
        <span style={{ fontSize: 10, color: 'var(--amber)' }}>◈ {activeSymbol}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {AI_MODES.map(m => (
            <button key={m.key} className={`chart-tf-btn ${mode === m.key ? 'active' : ''}`} onClick={() => { setMode(m.key); setResult(''); }}>{m.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {mode !== 'chat' ? (
          <>
            <div className="flex items-center gap-8" style={{ marginBottom: 12 }}>
              <button className="btn btn-primary" onClick={generate} disabled={loading}>
                {loading ? '◌ Generating...' : '◈ Generate Analysis'}
              </button>
              {result && <button className="btn" onClick={generate} disabled={loading}>↻ Regenerate</button>}
            </div>
            {loading && !result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 14, borderRadius: 3, width: `${100 - i * 8}%` }} />)}
              </div>
            )}
            {result && (
              <div className="ai-report card" style={{ whiteSpace: 'pre-wrap' }}>
                {result.split('\n').map((line, i) => {
                  if (line.startsWith('## ') || line.startsWith('### ')) return <h3 key={i}>{line.replace(/^#+\s/, '')}</h3>;
                  if (line.startsWith('**') && line.endsWith('**')) return <h3 key={i}>{line.replace(/\*\*/g, '')}</h3>;
                  if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} style={{ marginLeft: 16 }}>{line.replace(/^[-*]\s/, '')}</li>;
                  if (line.includes('STRONG BUY') || line.includes('BUY')) return <p key={i}><span className="ai-rating buy">{line}</span></p>;
                  if (line.includes('SELL') || line.includes('STRONG SELL')) return <p key={i}><span className="ai-rating sell">{line}</span></p>;
                  if (line.includes('HOLD')) return <p key={i}><span className="ai-rating hold">{line}</span></p>;
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i}>{line}</p>;
                })}
              </div>
            )}
          </>
        ) : (
          /* CHAT MODE */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div ref={chatRef} style={{ flex: 1, overflow: 'auto', marginBottom: 8 }}>
              {chatHistory.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>
                  Ask any question about {activeSymbol} or the markets. Claude has context of current price, fundamentals, news, and earnings.
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} style={{ marginBottom: 8, padding: 8, borderRadius: 6, background: msg.role === 'user' ? 'var(--amber-dim)' : 'var(--bg-3)' }}>
                  <div style={{ fontSize: 9, color: msg.role === 'user' ? 'var(--amber)' : 'var(--text-3)', marginBottom: 3 }}>{msg.role === 'user' ? 'You' : 'AI Analyst'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-1)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                </div>
              ))}
              {loading && <div className="skeleton" style={{ height: 40, borderRadius: 6 }} />}
            </div>
            <div className="flex gap-4">
              <input style={{ flex: 1 }} placeholder={`Ask about ${activeSymbol}...`} value={chatInput}
                onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendChat(); }} />
              <button className="btn btn-primary" onClick={sendChat} disabled={loading}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
