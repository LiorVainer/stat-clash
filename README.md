# ⚽ StatClash

A mobile‑first football knowledge game. Play 10 fast rounds guessing which player or team leads on a given stat. Questions are built from daily‑ingested data, frozen for fairness, and balanced for difficulty and replayability.

> Backend: Convex. Frontend: Next.js App Router. Data: API‑Football (generated client). Animations: Framer Motion.

---

## 🚀 Vision

Make football stats trivia fast, engaging, and repeatable. Deliver a delightful 3‑minute game with daily‑refreshed, deterministic questions, anti‑cheat protections, and optional Pro mode.

---

## 🎮 Gameplay Overview

- 10 rounds per game
- A stat pill is shown (e.g., “Goals — Season”)
- Two or more cards (players or teams) are presented
- Tap to highlight → Confirm → Reveal the correct leader with an explanation
- Score is based on difficulty and speed; streak bonuses apply

Scoring (from spec):

```ts
function scoreAnswer(base=100, difficulty, responseMs, streak) {
  const speedBonus = responseMs < 5000 ? Math.max(0, (5000 - responseMs)/50) : 0;
  return Math.round(base * difficulty + speedBonus + streak*10);
}
```

Difficulty factor (from spec):

```ts
function computeDifficulty(values) {
  const sorted = [...values].sort((a,b)=>b-a);
  const gap = sorted[0] - sorted[1];
  return Math.min(1.0, Math.max(0.2, 1 - gap/Math.max(sorted[0],1)));
}
```

---

## 🧭 UX: Screens & Flow

- Landing: Tagline “Who’s in better form?” + Play Now; footer (Leaderboard | Pro | About); banner ad
- Game: Stat pill, cards, highlight → Confirm → Reveal with explanation
- Results: Score, streak, leaderboard preview; CTAs (Play Again, Upgrade to Pro, Share)
- Leaderboard: daily/weekly tabs with tie‑breaks; banner ad
- Pro page: benefits and Stripe Checkout (planned)

---

## 🏗️ Architecture

- Frontend: Next.js (App Router), Tailwind CSS, shadcn/ui, Framer Motion
- Backend: Convex database + functions + crons
- CDN: Cloudflare R2/S3 (for mirrored player/team images)
- APIs: Football stats providers (API‑Football now; Opta/SofaScore later)
- Payments: Stripe Checkout + webhooks (planned)
- Ads: AdSense/Ezoic (planned)

Why Convex
- Real‑time queries, built‑in auth integration
- CRON scheduling for ingestion
- Simplified data + function deployment

---

## 🔁 Session Lifecycle

1) User taps Play Now
2) `sessions.start` creates session: selects pools, excludes repeat keys, enforces difficulty mix (3E / 4M / 3H)
3) `questions.getRound` issues a per‑round token (TTL 30s)
4) `questions.answer` validates token, scores, saves attempt (idempotent)
5) After 10 rounds: finalize score and update leaderboard

Tokens
- 30s TTL per round; one reissue allowed
- Prevents replaying the same round

Tie‑breaks
1) Score 2) Total response time 3) Finish time 4) UserId (deterministic)

---

## 🛡️ Security & Anti‑Cheat

- Frozen questions (built daily; not live queries)
- One‑use round tokens (TTL 30s)
- Idempotent attempts (no double‑submit)
- Cheat detection signals:
  - Median response < 200ms
  - > 3 token reissues
  - Excessive sessions/hour
  - IP churn
- Flags logged to `gameplay_log`

---

## 💸 Monetization

Ads (planned)
- Banner under cards; interstitial after round 5
- Hidden for Pro users
- Optional `ad_impressions` for slot analytics

Pro (planned)
- Stripe Checkout + webhooks
- Webhook idempotency via `stripe_events`
- Unlocks advanced stats (xG, xA, Pass %, etc.)

---

## 📊 Metrics Strategy

Tier 1 (Launch): Goals, Assists, Shots on target, Clean sheets, Rank

Tier 2 (Expansion): Big chances, Dribbles, Tackles, Interceptions, Goals conceded

Tier 3 (Pro): xG, xA, Pass %, Progressive passes, Form rating, Possession %

Storage estimate: ~30MB (Tier 1) → ~90MB (all tiers)

---

## 🧱 Data & Ingestion Pipeline

- Generated API client from `spec/api/swagger.yaml` → `football-api/api.ts`
- Ingestion Orchestrator and modules under `convex/ingestion/`
  - `initialize.ts`, `leagues.ts`, `teams.ts`, `players.ts`, `playerStats.ts`, `teamStats.ts`, `orchestrator.ts`
- Tables defined in `convex/tables/`
- Services under `convex/services/` (queries/mutations per domain)

Type‑safety
- The generated client is used directly (see `convex/api/football/`)
- Ingestion mappers normalize provider nulls → `undefined` to match Convex schemas

Logging
- Ingestion and API usage logs in `convex/logs/` and `convex/usage_tracking/`

Further reading
- `spec/statclash_spec.md` (product + system)
- `spec/statclash_schema_reference.md`
- `spec/statclash_ingestion_pipeline.md`
- `spec/ingestion_implementation_guide.md`

---

## 🧰 Tech Stack (from package.json)

- Next.js 15 (App Router), React 19
- Tailwind CSS 4, shadcn/ui
- Convex 1.x
- Framer Motion 12
- Zod, AI SDK (@ai‑sdk/react) [internal usage]
- Clerk (optional auth)
- Bluebird (concurrency), Axios, qs

---

## ⚙️ Setup & Development

Prerequisites
- Node.js 20+
- pnpm (recommended)
- Convex project (cloud or local), API‑Football key

Environment variables (minimum)
- `CONVEX_CLOUD_URL` – Convex deployment URL (if using cloud)
- `FOOTBALL_API_KEY` – API‑Football key (used by FootballService)
- `SOCCER_API_KEY` – API‑Football key (used by a separate client instance)
- Clerk/Stripe/Ads keys as applicable (if/when enabled)

Install dependencies

```bat
pnpm install
```

Generate API client (optional; regenerates from spec)

```bat
pnpm run generate:football-api-client
```

Run dev servers

```bat
pnpm dev
```

Build & start

```bat
pnpm build
pnpm start
```

Lint

```bat
pnpm lint
```

---

## 📁 Project Structure (high‑level)

```
convex/
  api/football/        # API client + service wrappers
  ingestion/           # ingestion orchestrator & domain modules
  tables/              # Convex table definitions
  services/            # domain queries/mutations
  logs/, usage_tracking/
football-api/          # generated API client (swagger-typescript-api)
spec/                  # product/system specs and schema references
src/                   # Next.js app (App Router)
```

---

## 🗺️ Roadmap (from spec)

- Launch (Tier 1 metrics, guest play, daily questions)
- Leaderboards, replay‑prevention, difficulty balancing
- Pro mode (Stripe), ad integration
- Expanded metrics (Tier 2, Tier 3)
- Image CDN mirroring, advanced anti‑cheat

---

## 📜 License

TBD.
