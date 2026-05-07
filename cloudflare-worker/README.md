# Cloudflare Worker — Telegram webhook bridge

Receives Telegram updates in real-time and forwards them to GitHub Actions via `repository_dispatch`. The Python autopilot in this repo then writes to Sheets + replies via Telegram.

End-to-end latency: **~15–45 seconds** (vs 5+ min on the cron-polling fallback).

## Architecture

```
Telegram → CF Worker (~1s) → GitHub repository_dispatch (~10-30s GH cold start) → Python autopilot (~5-15s) → Telegram reply
```

## One-time setup (≈20 minutes)

### Prerequisites

- A Cloudflare account (free, no credit card) — sign up at https://dash.cloudflare.com/sign-up
- The Wrangler CLI:
  ```bash
  brew install cloudflare-wrangler
  # OR
  npm install -g wrangler
  ```

### Step 1 — Create a GitHub Personal Access Token

The Worker needs to fire `repository_dispatch` on your repo, which requires a PAT with Actions write permission.

1. Go to https://github.com/settings/personal-access-tokens/new
2. Pick **"Fine-grained personal access tokens"**
3. Token name: `ngot-cf-worker`
4. Expiration: **1 year** (or longer if you prefer)
5. Repository access: **"Only select repositories"** → pick `quocvinh06/ngot`
6. Permissions → Repository permissions:
   - **Actions**: **Read and write**
   - **Contents**: **Read** (required to enumerate the repo)
   - **Metadata**: **Read** (auto)
7. Click **Generate token** → **copy the value** (starts with `github_pat_…`)

### Step 2 — Generate a webhook secret

This stops random POSTs from triggering your workflow. Pick anything random, e.g.:

```bash
WEBHOOK_SECRET=$(openssl rand -hex 24)
echo "$WEBHOOK_SECRET"
# Save this — you'll need it for both Worker and the setWebhook call
```

### Step 3 — Deploy the Worker

```bash
cd apps/ngot_pastry/cloudflare-worker
npm install                       # one-time install of wrangler
wrangler login                    # opens browser for OAuth — approve
wrangler deploy                   # deploys to <name>.workers.dev
```

After deploy, Wrangler prints your Worker URL — something like:
```
https://ngot-telegram-webhook.<your-subdomain>.workers.dev
```

**Save this URL** — you need it in step 5.

### Step 4 — Set the Worker secrets

```bash
wrangler secret put GH_PAT
# paste the github_pat_… token from Step 1, hit Enter

wrangler secret put WEBHOOK_SECRET
# paste the random hex string from Step 2

wrangler secret put GH_REPO
# paste: quocvinh06/ngot
```

### Step 5 — Point Telegram at the Worker

Replace `<TOKEN>`, `<WORKER_URL>`, and `<WEBHOOK_SECRET>` below with your real values:

```bash
TOKEN="8272476461:AAE0_N-F4jtdfCwAwnTgoYiPE7_tc02RknE"
WORKER_URL="https://ngot-telegram-webhook.<your-subdomain>.workers.dev"
WEBHOOK_SECRET="<the secret from step 2>"

# Set the webhook
curl -s "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -d "url=${WORKER_URL}?secret=${WEBHOOK_SECRET}" \
  -d "secret_token=${WEBHOOK_SECRET}" \
  -d "drop_pending_updates=false" \
  -d "max_connections=10" \
  -d "allowed_updates=[\"message\"]"

# Verify
curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | jq
```

The `getWebhookInfo` response should show `url` matching your Worker URL and `pending_update_count: 0`.

### Step 6 — Send a test message

Send any message to your Telegram bot. Within ~30 seconds you should:

1. See a new run on https://github.com/quocvinh06/ngot/actions named "Telegram Poll" with event `repository_dispatch`
2. Receive a reply on Telegram from Trợ lý Ngọt

If the run fails, click into it to see the log.

## Operations

### View live logs

```bash
wrangler tail
# Stream Worker logs in real-time. Send a Telegram message and watch.
```

### Disable the webhook (revert to cron polling)

```bash
TOKEN="..."  # your bot token
curl -s "https://api.telegram.org/bot${TOKEN}/deleteWebhook"
```

After this, the 5-min cron polling resumes (no code change needed).

### Update Worker code

After editing `src/index.ts`:

```bash
wrangler deploy
```

### Rotate the webhook secret

```bash
NEW_SECRET=$(openssl rand -hex 24)
wrangler secret put WEBHOOK_SECRET   # paste $NEW_SECRET
# Then re-run the setWebhook curl from Step 5 with the new secret in the URL
```

## Trouble-shooting

| Symptom | Cause | Fix |
|---|---|---|
| Telegram shows `last_error_message: "Wrong response from the webhook: 500 Internal Server Error"` in `getWebhookInfo` | GH dispatch failed (PAT expired or wrong scopes) | Regenerate PAT with Actions write scope; `wrangler secret put GH_PAT` |
| `last_error_message: "403 Forbidden"` | `WEBHOOK_SECRET` mismatch between Worker and Telegram | Re-run setWebhook curl with the same secret as `wrangler secret put WEBHOOK_SECRET` |
| GH Actions runs fire but no Telegram reply | `GEMINI_API_KEY` quota exhausted, OR Sheets write failed | Check the run log; usually a 429 or PERMISSION_DENIED |
| `pending_update_count` keeps growing | Worker is returning non-200 → Telegram queues retries | `wrangler tail` to see why |
| Multiple identical replies | Telegram retried because Worker took >60s to ack | Should not happen with the dispatch pattern, but if it does, switch GH_PAT to a faster region |

## Costs

- **Cloudflare Workers** free plan: 100,000 requests/day; we use ~1 per Telegram message
- **GitHub Actions** on a public repo: unlimited (~2,000 free minutes for private)
- **Gemini API** free tier: ~1000 RPD on `gemini-2.5-flash-lite`

For a small bakery (≤200 customer messages/day) — all comfortably free.
