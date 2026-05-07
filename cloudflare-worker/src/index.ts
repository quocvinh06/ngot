/**
 * Telegram → GitHub Actions repository_dispatch webhook bridge.
 *
 * Receives Telegram updates as POST, validates a shared secret, fires a
 * `repository_dispatch` event at the ngot repo with the full message payload.
 * GitHub Actions handler (Python) writes to Sheets + runs the autopilot.
 *
 * Latency budget:
 *   Telegram → Worker:           ~50ms (worldwide edge)
 *   Worker → GitHub dispatch:    ~200-500ms
 *   GH Actions cold start:       10-30s
 *   Python script execution:     5-15s
 *   ─────────────────────────────────────
 *   Total user-visible:          ~15-45s
 *
 * Failure mode: if GH dispatch fails, returns 500 so Telegram retries (up to 24h).
 *
 * Set the following env vars via `wrangler secret put`:
 *   - GH_PAT              GitHub fine-grained PAT with Actions read+write on this repo
 *   - WEBHOOK_SECRET      Random string; included in the Telegram webhook URL as ?secret=...
 *                         to prevent random POSTs from triggering workflows.
 *   - GH_REPO             "owner/repo" — e.g. "quocvinh06/ngot"
 */

export interface Env {
  GH_PAT: string;
  WEBHOOK_SECRET: string;
  GH_REPO: string;
}

interface TelegramMessage {
  message_id: number;
  date: number;
  chat: { id: number; type: string };
  from?: { first_name?: string; username?: string };
  text?: string;
  contact?: { phone_number?: string };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Health check
    const url = new URL(request.url);
    if (request.method === "GET") {
      return new Response("ngot-telegram-webhook OK\n", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Verify shared secret (URL query param ?secret=... or header X-Telegram-Bot-Api-Secret-Token)
    const headerSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
    const querySecret = url.searchParams.get("secret") || "";
    if (headerSecret !== env.WEBHOOK_SECRET && querySecret !== env.WEBHOOK_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }

    let update: TelegramUpdate;
    try {
      update = await request.json();
    } catch (e) {
      return new Response("Bad JSON", { status: 400 });
    }

    const msg = update.message || update.edited_message;
    if (!msg || !msg.text) {
      // Non-text update (sticker, photo, etc.) — ack so Telegram doesn't retry
      return new Response("OK (non-text)", { status: 200 });
    }

    // Fire repository_dispatch
    const payload = {
      event_type: "telegram_message",
      client_payload: {
        telegram_msg_id: msg.message_id,
        chat_id: msg.chat.id,
        sender_name: msg.from?.first_name || "",
        sender_username: msg.from?.username || "",
        text: msg.text,
        date: msg.date,
      },
    };

    const ghResp = await fetch(`https://api.github.com/repos/${env.GH_REPO}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GH_PAT}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ngot-telegram-webhook",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!ghResp.ok) {
      const body = await ghResp.text();
      console.error(`GH dispatch failed (${ghResp.status}): ${body}`);
      // Return 500 so Telegram retries
      return new Response(`GH dispatch failed: ${ghResp.status}`, { status: 500 });
    }

    return new Response("OK", { status: 200 });
  },
};
