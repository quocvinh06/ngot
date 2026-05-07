"""Process a single Telegram message from a GH Actions repository_dispatch payload.

Invoked by .github/workflows/telegram-poll.yml when event_name == 'repository_dispatch'
with event_type 'telegram_message'. Reads MSG_PAYLOAD env var (JSON string) emitted
by the Cloudflare Worker.

Side effects:
  - Append row to TelegramMessages tab (parse_status='pending')
  - Run the autopilot (classify → execute → reply via Telegram)
  - Update the row with parse_status / parsed_json / related_order_id

Idempotent: if a row with the same telegram_msg_id already exists, skip insert
and only re-process. (Handles Telegram retries gracefully.)
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


def main() -> int:
    payload_str = os.environ.get("MSG_PAYLOAD", "{}")
    try:
        payload = json.loads(payload_str)
    except json.JSONDecodeError as e:
        print(f"FAIL: bad MSG_PAYLOAD JSON: {e}")
        return 1

    text = (payload.get("text") or "").strip()
    if not text:
        print("SKIP: payload has no text")
        return 0

    msg_id = int(payload.get("telegram_msg_id", 0))
    chat_id = int(payload.get("chat_id", 0))
    sender = payload.get("sender_name") or ""
    msg_date = payload.get("date", 0)

    print(f"Webhook payload: msg#{msg_id} chat={chat_id} from='{sender}' text='{text[:80]}'")

    # Verify required env
    for k in ("TELEGRAM_BOT_TOKEN", "SHEETS_URL", "GCP_SERVICE_ACCOUNT_JSON", "GEMINI_API_KEY"):
        if not os.environ.get(k):
            print(f"FAIL: missing env {k}")
            return 1

    from lib import sheets_client
    from lib.modules import assistant as assistant_mod

    # Idempotency: skip insert if already present (Telegram may retry)
    df = sheets_client.read_tab("TelegramMessages")
    already = False
    if not df.empty and "telegram_msg_id" in df.columns:
        import pandas as pd

        matches = df[pd.to_numeric(df["telegram_msg_id"], errors="coerce") == msg_id]
        if not matches.empty:
            already = True
            print(f"SKIP-INSERT: msg#{msg_id} already in TelegramMessages")

    if not already:
        try:
            sheets_client.append_row(
                "TelegramMessages",
                {
                    "telegram_msg_id": msg_id,
                    "chat_id": chat_id,
                    "sender_name": sender,
                    "sender_phone": "",
                    "received_at": datetime.fromtimestamp(msg_date).isoformat(timespec="seconds")
                    if msg_date
                    else datetime.now().isoformat(timespec="seconds"),
                    "raw_text": text,
                    "parse_status": "pending",
                },
            )
            print(f"INSERT: appended TelegramMessage row for msg#{msg_id}")
        except Exception as e:  # noqa: BLE001
            print(f"WARN: append failed ({e}); proceeding to autopilot anyway")

    # Run autopilot (classify + execute + reply via Telegram)
    try:
        result = assistant_mod.process_inbound_message(
            telegram_msg_id=msg_id,
            chat_id=chat_id,
            sender_name=sender,
            raw_text=text,
            actor="webhook",
        )
        order = f" → order #{result['related_order_id']}" if result.get("related_order_id") else ""
        print(f"DONE: intent={result['intent']} status={result['status']}{order}")
        return 0
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: autopilot raised {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
