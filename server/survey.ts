// Talks to the self-hosted Formbricks. The API key never leaves the server.
export type Env = { url: string; apiKey: string; environmentId: string; surveyId: string };

export const REASONS = ['Taste', 'Freshness', 'Delivery speed', 'Price', 'Packaging'] as const;

export type Answer = { nps: number; reason: string; comment: string };

export function validate(input: unknown): Answer | string {
  const b = (input ?? {}) as Record<string, unknown>;
  const nps = Number(b.nps);
  if (!Number.isInteger(nps) || nps < 0 || nps > 10) return 'Please pick a score from 0 to 10.';
  const reason = String(b.reason ?? '');
  if (!(REASONS as readonly string[]).includes(reason)) return 'Please pick what mattered most.';
  const comment = String(b.comment ?? '').replace(/\s+/g, ' ').trim().slice(0, 280);
  return { nps, reason, comment };
}

async function call(env: Env, path: string, init?: RequestInit, auth = true) {
  const res = await fetch(new URL(path, env.url), {
    ...init,
    headers: { 'content-type': 'application/json', ...(auth ? { 'x-api-key': env.apiKey } : {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Formbricks ${res.status}`);
  return res.json();
}

/** Sends one answer through Formbricks' public client API, like the survey widget does. */
export async function submit(env: Env, a: Answer) {
  const r = (await call(
    env,
    `/api/v1/client/${env.environmentId}/responses`,
    { method: 'POST', body: JSON.stringify({ surveyId: env.surveyId, finished: true, data: { nps: a.nps, reason: a.reason, comment: a.comment } }) },
    false,
  )) as { data: { id: string } };
  return { id: r.data.id };
}

type Row = { id: string; createdAt: string; data: { nps?: number; reason?: string; comment?: string } };

/** Reads every response from the management API and turns it into chart numbers. */
export async function results(env: Env) {
  const rows: Row[] = [];
  for (let skip = 0; skip < 5000; skip += 250) {
    const r = (await call(env, `/api/v1/management/responses?surveyId=${env.surveyId}&limit=250&skip=${skip}`)) as { data: Row[] };
    rows.push(...r.data);
    if (r.data.length < 250) break;
  }
  const scored = rows.filter(r => typeof r.data.nps === 'number');
  const promoters = scored.filter(r => r.data.nps! >= 9).length;
  const detractors = scored.filter(r => r.data.nps! <= 6).length;
  const passives = scored.length - promoters - detractors;
  const n = scored.length;
  const reasons = REASONS.map(label => ({ label, value: rows.filter(r => r.data.reason === label).length }));
  const scores = Array.from({ length: 11 }, (_, s) => scored.filter(r => r.data.nps === s).length);
  const comments = rows
    .filter(r => r.data.comment)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map(r => ({ id: r.id, nps: r.data.nps ?? null, reason: r.data.reason ?? '', text: r.data.comment!, at: r.createdAt }));
  return {
    total: rows.length,
    nps: n ? Math.round(((promoters - detractors) / n) * 100) : null,
    split: { promoters, passives, detractors },
    scores,
    reasons,
    comments,
  };
}
