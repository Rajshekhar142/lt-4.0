# lifetracker

Thin time tracker: 3 domains, one running timer at a time, 30-day history.
Single-user, no auth.

## Stack

- Next.js (App Router) — one app, no separate backend service
- Node's built-in `node:sqlite` module — no ORM, no native compile step
  (this is why `better-sqlite3` isn't used: it needs to compile against
  Node headers, and `node:sqlite` ships in Node 22+ for free)
- Tailwind for styling, no component library

Requires **Node 22+** (for `node:sqlite`).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The sqlite file is created automatically at
`data/lifetracker.db` on first run, seeded with 3 domains.

## Editing your domains

Open `lib/db.ts` and edit the `DEFAULT_DOMAINS` array — this only runs once,
on first boot when the domains table is empty. If you've already run the
app and want to rename domains, either edit the `domains` table directly
(any sqlite client, or `sqlite3 data/lifetracker.db`) or delete
`data/lifetracker.db` and restart to reseed.

## Deploying

**Important:** this app writes to a local sqlite file on disk. Deploy it
as **one long-running service with a persistent volume** — Fly.io, Render
(as a single Web Service, not split frontend/backend), or a small VPS all
work. It will **not** work correctly on Vercel or other stateless
serverless platforms, since the sqlite file won't persist between
invocations there.

Steps for Render (single service):
1. New Web Service -> connect this repo
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Add a persistent disk mounted wherever `process.cwd()/data` resolves
   in their environment, so the sqlite file survives deploys/restarts.

## Project shape

```
app/
  page.tsx               # tracker screen (server component, fetches initial state)
  tracker-client.tsx      # live timer + domain toggle rows (client component)
  history/page.tsx        # last 30 days, one row per day with a proportional bar
lib/
  db.ts                   # schema, seeding, all queries -- the whole data layer
  actions.ts               # server actions wrapping db.ts for the client
  format.ts                # duration/date formatting helpers
components/
  Nav.tsx                  # Today / History nav
```

Deliberately left out of this version: auth, multi-user, configurable
domains via UI, tests, empty-day gap visualization. Add them if/when you
actually need them.
