"""Telegram polling — runs from GH Actions cron OR Streamlit "Sync now" button.

Idempotent: re-running with same offset is a no-op. Uses Sheets tab _telegram_offset
to persist the cursor.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


def main() -> int:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        print("SKIP: TELEGRAM_BOT_TOKEN not set.")
        return 0
    sheets_url = os.environ.get("SHEETS_URL", "")
    sa_json = os.environ.get("GCP_SERVICE_ACCOUNT_JSON", "")
    if not sheets_url or not sa_json:
        print("SKIP: SHEETS_URL or GCP_SERVICE_ACCOUNT_JSON not set.")
        return 0
    try:
        from lib.modules import assistant as assistant_mod
        n = assistant_mod.poll_telegram(actor="system")
        print(f"OK: fetched {n} new messages.")
        return 0
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
