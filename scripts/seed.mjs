// Fills the demo survey with 60 made-up answers so the charts are not empty.
// Usage: node scripts/seed.mjs   (reads .env.local)
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => /^FORMBRICKS_[A-Z_]+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const url = env.FORMBRICKS_URL || 'http://localhost:3100';

// Weighted like a healthy small coffee brand: mostly 8–10, a few unhappy.
const SCORES = [10, 10, 10, 9, 9, 9, 9, 8, 8, 8, 7, 7, 6, 5, 3];
const REASONS = { Taste: 5, Freshness: 4, 'Delivery speed': 2, Price: 1, Packaging: 1 };
const COMMENTS = {
  pro: ['Best Huila I have had all year.', 'Arrived two days after roasting. Lovely.', 'The brew card on the bag helped a lot.', 'Ordering again next month.'],
  pas: ['Good beans, shipping took a while.', 'A smaller bag size would be nice.'],
  det: ['The bag arrived torn.', 'Too pricey for 250 g.', 'Courier missed me twice.'],
};
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = a => a[Math.floor(rnd() * a.length)];
const weighted = w => { let r = rnd() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) if ((r -= v) < 0) return k; };

for (let i = 0; i < 60; i++) {
  const nps = pick(SCORES);
  const t = nps >= 9 ? 'pro' : nps >= 7 ? 'pas' : 'det';
  const reason = t === 'det' ? pick(['Price', 'Packaging', 'Delivery speed']) : weighted(REASONS);
  const comment = rnd() < 0.3 ? pick(COMMENTS[t]) : '';
  const r = await fetch(`${url}/api/v1/client/${env.FORMBRICKS_ENVIRONMENT_ID}/responses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ surveyId: env.FORMBRICKS_SURVEY_ID, finished: true, data: { nps, reason, comment } }),
  });
  if (!r.ok) throw new Error(`Seed failed: ${r.status} ${await r.text()}`);
}
console.log('Added 60 answers.');
