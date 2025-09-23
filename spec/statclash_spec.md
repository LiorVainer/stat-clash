# StatClash — Extended Product & System Specification
_Last updated: 2025‑09‑21 (UTC)_

---

## 0) Executive Summary
StatClash is a **mobile-first football knowledge game**. Users play **10 fast rounds** guessing which player or team leads on a given stat.  
- Data is **ingested daily**, frozen into **deterministic questions**, and surfaced with difficulty balancing and repeat prevention.  
- **Monetization**: ads + Pro subscription.  
- **Security**: per-round tokens, idempotent scoring, anti-cheat checks.  
- **Tech**: Convex backend, Next.js frontend, CDN for images, Stripe for billing.

---

## 1) User Experience

### 1.1 Goals
- ⚡ **Fast**: each game <3 minutes.  
- 🎮 **Engaging**: highlight → confirm → reveal.  
- 🌍 **Accessible**: guest play, no login needed.  
- 🔁 **Replayable**: daily refresh, difficulty balance.  
- ⭐ **Pro value**: advanced stats, ad-free.

### 1.2 Screens & Flow
- **Landing**: Tagline “Who’s in better form?”, big Play Now button, footer (Leaderboard | Pro | About). Banner ad.  
- **Game**: Stat pill (“Goals — Season”), two or more cards. Tap → highlight → Confirm button appears → reveal stats + explanation.  
- **Results**: Score, streak, leaderboard preview. CTA: Play Again, Upgrade to Pro, Share.  
- **Leaderboard**: daily/weekly tabs, sorted with tie-breaks. Banner ad.  
- **Pro page**: benefits list, Stripe Checkout button.  

### 1.3 Example Round
Stat = “Goals this season”  
- Cards: Haaland (12), Kane (9).  
- User selects Kane → confirm → reveal: “Haaland leads with 12 goals; Kane has 9.”  
- Score awarded: base 100 × difficulty × speed bonus.

---

## 2) Architecture

### Components
- **Frontend**: Next.js 14, Tailwind, shadcn/ui, Framer Motion.  
- **Backend**: Convex DB + functions, CRON jobs.  
- **CDN**: Cloudflare R2/S3 for mirrored player/team images.  
- **APIs**: football stats providers (API-Football, Opta, SofaScore).  
- **Payments**: Stripe Checkout + webhooks.  
- **Ads**: AdSense/Ezoic (canonical counts from provider).  

### Why Convex?
- Built-in real-time queries.  
- CRON scheduling for ingestion.  
- Simplifies auth + data + function deployment.

---

## 3) Session Lifecycle

### Step-by-step
1. User taps “Play Now”.  
2. **sessions.start** creates session: selects pools, excludes repeatKeys, enforces difficulty mix (3E/4M/3H).  
3. Round begins: **questions.getRound** issues short-lived token (30s).  
4. User answers: **questions.answer** validates token, scores, saves attempt.  
5. Game ends after 10 rounds → leaderboard updated.  

### Tokens
- Round tokens expire after 30s.  
- One reissue allowed if lost (e.g., bad connection).  
- Prevents replaying same round.

---

## 4) Gameplay Details

### Scoring
```ts
function scoreAnswer(base=100, difficulty, responseMs, streak) {
  const speedBonus = responseMs < 5000 ? Math.max(0, (5000 - responseMs)/50) : 0;
  return Math.round(base * difficulty + speedBonus + streak*10);
}
```

### Difficulty
```ts
function computeDifficulty(values) {
  const sorted = [...values].sort((a,b)=>b-a);
  const gap = sorted[0] - sorted[1];
  return Math.min(1.0, Math.max(0.2, 1 - gap/Math.max(sorted[0],1)));
}
```

### Tie-breaks
1. Score  
2. Total response time  
3. Finish timestamp  
4. UserId (deterministic)

---

## 5) Security & Anti-Cheat

- **Frozen questions**: built daily, not live queries.  
- **Token checks**: one use per round, TTL 30s.  
- **Idempotent attempts**: cannot submit twice.  
- **Cheat detection**:  
  - Median response <200ms.  
  - >3 token reissues.  
  - Excessive sessions/hour.  
  - IP churn.  
- Flags logged in `gameplay_log`.

---

## 6) Monetization

### Ads
- Banner under cards.  
- Interstitial after round 5.  
- Ads hidden for Pro users.  
- Internal `ad_impressions` optional for slot-level analytics.

### Pro
- Stripe Checkout.  
- Webhook updates `users.isPro`.  
- Webhook idempotency via `stripe_events`.  
- Pro unlocks Legends Mode (xG, xA, Pass %, etc).

---

## 7) Metrics Strategy

### Tier 1 (Launch)
- Goals, Assists, Shots on target, Clean sheets, Rank.

### Tier 2 (Expansion)
- Big chances, Dribbles, Tackles, Interceptions, Goals conceded.

### Tier 3 (Pro)
- xG, xA, Pass %, Progressive passes, Form rating, Possession %.

Storage estimate: 30MB (Tier 1) → 90MB (all tiers).

---

## 8) Logging & Analytics

- **api_ingest_log**: provider latency/errors.  
- **attempts**: correctness, response time.  
- **sessions**: start, finish, score.  
- **gameplay_log**: unusual events.  
- **ad_impressions**: slot, renderedAt.  
- **pro_events**: funnel analytics.  
- **stripe_events**: webhook ids.  
- **error_log**: ingestion/runtime exceptions.

**Analytics supported**: DAU, retention, conversion funnel, cheat detection, latency trends.

---

**End of Extended Spec**
