import { defineConfig, loadEnv, type Connect } from 'vite';
import react from '@vitejs/plugin-react';
import { results, submit, validate, type Env } from './server/survey';

// Serves /api/* from the dev and preview servers. The Formbricks key stays here.
function surveyApi(mode: string) {
  const raw = loadEnv(mode, process.cwd(), 'FORMBRICKS_');
  const env: Env = {
    url: raw.FORMBRICKS_URL || 'http://localhost:3100',
    apiKey: raw.FORMBRICKS_API_KEY,
    environmentId: raw.FORMBRICKS_ENVIRONMENT_ID,
    surveyId: raw.FORMBRICKS_SURVEY_ID,
  };
  const last = new Map<string, number>(); // simple per-IP rate limit
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/api/')) return next();
    const send = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.setHeader('cache-control', 'no-store');
      res.end(JSON.stringify(body));
    };
    if (!env.apiKey || !env.environmentId || !env.surveyId) return send(503, { error: 'Formbricks is not configured.' });

    if (url.pathname === '/api/respond' && req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 4000) req.destroy(); });
      req.on('end', () => {
        let parsed: unknown;
        try { parsed = JSON.parse(body); } catch { return send(400, { error: 'Invalid request.' }); }
        const a = validate(parsed);
        if (typeof a === 'string') return send(400, { error: a });
        const ip = req.socket.remoteAddress ?? '';
        const now = Date.now();
        if (now - (last.get(ip) ?? 0) < 5000) return send(429, { error: 'Please wait a few seconds.' });
        last.set(ip, now);
        submit(env, a).then(r => send(200, r), () => send(502, { error: 'Could not save your answer.' }));
      });
      return;
    }
    if (url.pathname === '/api/results' && req.method === 'GET') {
      return void results(env).then(r => send(200, r), () => send(502, { error: 'Results unavailable.' }));
    }
    send(404, { error: 'Not found.' });
  };
  return {
    name: 'demo-survey-api',
    configureServer: (server: { middlewares: Connect.Server }) => { server.middlewares.use(handler); },
    configurePreviewServer: (server: { middlewares: Connect.Server }) => { server.middlewares.use(handler); },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), surveyApi(mode)],
  server: { host: '127.0.0.1', port: 5182, strictPort: true },
  preview: { host: '127.0.0.1', port: 5182, strictPort: true },
}));
