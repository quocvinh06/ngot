# Ngọt — Patissiere & More

Vietnamese pastry shop admin panel (online order management).

**Stack**: Next.js 15 (App Router) · Drizzle ORM · NextAuth v5 · Tailwind v4 · shadcn/ui · next-intl · Postgres (Neon in prod, Docker locally)

**Roles**: `owner` (full access) · `staff` (orders + inventory only)

**Locale**: Tiếng Việt primary · English fallback

## Local development

```bash
# 1. Install deps
npm install

# 2. Start local Postgres (requires Docker Desktop)
docker compose up -d postgres

# 3. Configure env
cp .env.local.example .env.local
# edit .env.local — set NEXTAUTH_SECRET to `openssl rand -hex 32`

# 4. Initialize schema + seed
npm run db:push
npm run db:seed

# 5. Run
npm run dev   # http://localhost:3070
```

Default seed accounts (passwords from env vars `OWNER1_PASSWORD` / `OWNER2_PASSWORD` / `STAFF_PASSWORD`, default `ngot1234` — **change after first sign-in via `/settings/staff`**):

| Email | Default password | Role |
|---|---|---|
| taquocvinhbk10@gmail.com | `$OWNER1_PASSWORD` (default `ngot1234`) | owner |
| hnlanh2910@gmail.com | `$OWNER2_PASSWORD` (default `ngot1234`) | owner |
| staff@ngot.local | `$STAFF_PASSWORD` (default `ngot1234`) | staff |

## Production deploy (Vercel + Neon)

### 1. Neon Postgres

1. Sign in at https://neon.tech
2. New Project → name `ngot` → region closest to your users (Singapore for Vietnam)
3. Dashboard → **Connection string** → copy the `postgresql://...` URL (this is your `DATABASE_URL`)

### 2. Vercel

1. Sign in at https://vercel.com → Add New → Project → Import this repo
2. Framework: Next.js (auto-detected)
3. Add environment variables:

| Name | Value |
|---|---|
| `DATABASE_URL` | from Neon (step 1) |
| `NEXTAUTH_SECRET` | `openssl rand -hex 32` |
| `NEXTAUTH_URL` | leave empty for first deploy; set to your Vercel URL after |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `TELEGRAM_BOT_TOKEN` | optional — from @BotFather |
| `TELEGRAM_CHAT_ID` | optional — your group/channel chat id |
| `GOOGLE_SHEETS_ID` | optional |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | optional |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | optional — paste full PEM, Vercel handles `\n` |

4. Deploy. First build will succeed; the app will land empty (no schema).
5. From your local terminal, run schema push + seed against Neon:

```bash
DATABASE_URL='postgresql://...neon.tech/...' npm run db:push -- --force
DATABASE_URL='postgresql://...neon.tech/...' npm run db:seed
```

6. Update `NEXTAUTH_URL` env var in Vercel to your deployed URL (e.g. `https://ngot.vercel.app`) and redeploy.

### 3. Cron — order deadline alerts (GitHub Actions, free)

Vercel Hobby caps cron at once-per-day. We use GitHub Actions cron instead — `*/15 * * * *` is fine on the free tier.

The workflow lives at `.github/workflows/cron-order-deadlines.yml` and POSTs to `/api/cron/order-deadlines` (auth via `CRON_SECRET`).

Configure once after deploy:

1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `APP_URL` = your live Vercel URL (e.g. `https://ngot.vercel.app`)
   - `CRON_SECRET` = same value as in Vercel env

The workflow then fires every 15 min automatically. Manually trigger via **Actions → cron-order-deadlines → Run workflow**.

### 4. Telegram bot (optional)

1. Open Telegram → search `@BotFather` → `/newbot` → follow prompts → copy the bot token
2. Create a group, add the bot, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` after sending a message in the group → copy the negative `chat.id`
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in Vercel → redeploy

### 5. Google Sheets backup (optional, one-way mirror)

1. Create a new Google Sheet → copy the ID from the URL (between `/d/` and `/edit`)
2. https://console.cloud.google.com → Create Project → IAM → Service Accounts → New
3. Create JSON key → save locally
4. Share the Google Sheet with the service account's email (Editor)
5. In Vercel:
   - `GOOGLE_SHEETS_ID` = the sheet ID
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = `*@*.iam.gserviceaccount.com`
   - `GOOGLE_SERVICE_ACCOUNT_KEY` = full PEM private key including `-----BEGIN ...END PRIVATE KEY-----` (Vercel handles `\n` literals automatically)

## Architecture

This app was built via the AppDroid v0.7 5-phase pipeline. Source-of-truth design lives in `../ngot.appdroid/design.md` (sibling to this repo). To add a feature, run `/new-feature ngot "..."` from the AppDroid root — it enforces the 7-constraint additive-only check against `.contracts.lock.json`.

## License

Private — © 2026 Ngọt Patissiere & More
