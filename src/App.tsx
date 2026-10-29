import { useCallback, useEffect, useState } from 'react';

const REASONS = ['Taste', 'Freshness', 'Delivery speed', 'Price', 'Packaging'];

type Results = {
  total: number;
  nps: number | null;
  split: { promoters: number; passives: number; detractors: number };
  scores: number[];
  reasons: { label: string; value: number }[];
  comments: { id: string; nps: number | null; reason: string; text: string; at: string }[];
};

const tone = (s: number) => (s >= 9 ? 'pro' : s >= 7 ? 'pas' : 'det');

function Survey({ onSent }: { onSent: () => void }) {
  const [nps, setNps] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (nps === null) return setError('Please pick a score from 0 to 10.');
    if (!reason) return setError('Please pick what mattered most.');
    setError('');
    setState('sending');
    try {
      const r = await fetch('/api/respond', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nps, reason, comment }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? 'Could not save your answer.');
      setState('sent');
      onSent();
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Could not save your answer.');
    }
  }

  if (state === 'sent') {
    return (
      <div className="card done" role="status">
        <p className="eyebrow">Saved in Formbricks</p>
        <h2>Thank you. Your answer is in the chart.</h2>
        <button className="ghost" onClick={() => { setNps(null); setReason(''); setComment(''); setState('idle'); }}>Answer again</button>
      </div>
    );
  }

  return (
    <form className="card form" onSubmit={send}>
      <p className="eyebrow">Your order arrived · 2 questions</p>
      <fieldset>
        <legend>How likely are you to recommend Kiln to a friend?</legend>
        <div className="scale" role="radiogroup">
          {Array.from({ length: 11 }, (_, s) => (
            <button type="button" key={s} role="radio" aria-checked={nps === s} className={`dot t-${tone(s)} ${nps === s ? 'on' : ''}`} onClick={() => setNps(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="ends"><span>Not likely</span><span>Very likely</span></div>
      </fieldset>
      <fieldset>
        <legend>What mattered most?</legend>
        <div className="chips">
          {REASONS.map(r => (
            <button type="button" key={r} aria-pressed={reason === r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        Anything we should change? <span className="muted">(optional)</span>
        <textarea rows={2} maxLength={280} value={comment} onChange={e => setComment(e.target.value)} placeholder="One line is plenty." />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={state === 'sending'}>{state === 'sending' ? 'Saving…' : 'Send answer'}</button>
      <p className="fine">Anonymous. Goes straight to a self-hosted Formbricks.</p>
    </form>
  );
}

function Gauge({ value }: { value: number | null }) {
  // NPS runs from -100 to 100; draw it as a half circle.
  const v = value ?? 0;
  const p = (v + 100) / 200;
  const r = 80;
  const len = Math.PI * r;
  return (
    <svg viewBox="0 0 200 116" className="gauge" aria-label={`NPS ${value ?? 'no answers yet'}`}>
      <path d="M20 100 A80 80 0 0 1 180 100" className="track" />
      <path d="M20 100 A80 80 0 0 1 180 100" className="fill" style={{ strokeDasharray: `${len * p} ${len}` }} />
      <text x="100" y="92" textAnchor="middle" className="big">{value === null ? '–' : value > 0 ? `+${value}` : value}</text>
    </svg>
  );
}

function Dashboard({ data, error }: { data: Results | null; error: string }) {
  if (error) return <div className="card"><p className="error">{error}</p></div>;
  if (!data) return <div className="card"><p className="muted">Loading results…</p></div>;
  const { split, total } = data;
  const n = split.promoters + split.passives + split.detractors || 1;
  const maxScore = Math.max(...data.scores, 1);
  const maxReason = Math.max(...data.reasons.map(r => r.value), 1);
  return (
    <div className="card dash">
      <div className="dash-head">
        <div>
          <p className="eyebrow">Live from Formbricks</p>
          <h2>Net Promoter Score</h2>
        </div>
        <span className="live"><i /> {total} answers</span>
      </div>
      <Gauge value={data.nps} />
      <div className="split" aria-label="Promoters, passives and detractors">
        <span className="pro" style={{ flexGrow: split.promoters }} />
        <span className="pas" style={{ flexGrow: split.passives }} />
        <span className="det" style={{ flexGrow: split.detractors }} />
      </div>
      <div className="legend">
        <span><i className="pro" />Promoters {Math.round((split.promoters / n) * 100)}%</span>
        <span><i className="pas" />Passives {Math.round((split.passives / n) * 100)}%</span>
        <span><i className="det" />Detractors {Math.round((split.detractors / n) * 100)}%</span>
      </div>

      <h3>Scores</h3>
      <div className="cols">
        {data.scores.map((c, s) => (
          <div key={s} className="col">
            <span className={`bar ${tone(s)}`} style={{ height: `${(c / maxScore) * 100}%` }} title={`${c} × ${s}`} />
            <small>{s}</small>
          </div>
        ))}
      </div>

      <h3>What mattered most</h3>
      <ul className="bars">
        {data.reasons.map(r => (
          <li key={r.label}>
            <span>{r.label}</span>
            <div><i style={{ width: `${(r.value / maxReason) * 100}%` }} /></div>
            <b>{r.value}</b>
          </li>
        ))}
      </ul>

      {data.comments.length > 0 && (
        <>
          <h3>Latest comments</h3>
          <ul className="quotes">
            {data.comments.map(c => (
              <li key={c.id}>
                {c.nps !== null && <span className={`pill ${tone(c.nps)}`}>{c.nps}</span>}
                <p>{c.text}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function App() {
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/results');
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Results unavailable.');
      setData(body);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Results unavailable.');
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <>
      <header className="top">
        <a className="logo" href="/">Kiln<span>.</span></a>
        <span className="tag">Formbricks demo</span>
      </header>
      <main className="wrap">
        <section className="intro">
          <p className="eyebrow">Customer feedback</p>
          <h1>Ask after delivery. <em>See it live.</em></h1>
          <p className="lead">A two-question survey stored in a self-hosted Formbricks, and the scores it adds up to, refreshed every 5 seconds.</p>
        </section>
        <div className="grid">
          <Survey onSent={load} />
          <Dashboard data={data} error={error} />
        </div>
      </main>
    </>
  );
}
