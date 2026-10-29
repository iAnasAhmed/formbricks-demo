# Kiln Feedback: Formbricks demo

A standalone demo of a post-delivery survey stored in a **self-hosted Formbricks**.

- A two-question survey: an NPS score (0–10) and what mattered most, plus an optional comment.
- Answers go through Formbricks' client API, the same way its survey widget sends them.
- A live panel reads every response from the management API and draws the NPS gauge, the promoter / passive / detractor split, the score spread, top reasons and latest comments. It refreshes every 5 seconds.
- The API key stays on the server (`/api/respond`, `/api/results`); input is validated and rate-limited.

## Run

1. Run Formbricks locally (`formbricks/docker`, on http://localhost:3100). Create an organization, a link survey with questions `nps` (NPS), `reason` (single choice: Taste, Freshness, Delivery speed, Price, Packaging) and `comment` (open text), and a management API key with Write access.
2. Copy `.env.example` to `.env.local` and fill in the URL, key, environment ID and survey ID.
3. Optional: `npm run seed` adds 60 made-up answers so the charts start full.
4. `npm install` then `npm run dev`. Open http://127.0.0.1:5182.

Demo only: Kiln is a made-up coffee brand.
