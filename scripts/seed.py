"""Idempotent: load CSVs from data/seed/ into Google Sheets tabs.

Skips tabs that already have rows (header row only is OK to seed).
Dry-run mode prints intended row counts and exits 0.
"""
from __future__ import annotations

import csv
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

# Topological order: parents before children
SEED_ORDER = [
    ("Settings", "settings.csv"),
    ("Customers", "customers.csv"),
    ("Dishes", "dishes.csv"),
    ("Ingredients", "ingredients.csv"),
    ("Recipes", "recipes.csv"),
    ("Equipment", "equipment.csv"),
    ("Campaigns", "campaigns.csv"),
    ("Orders", "orders.csv"),
    ("OrderItems", "order_items.csv"),
    ("InventoryMovements", "inventory_movements.csv"),
    ("AssistantSkills", "assistant_skills.csv"),
    ("TelegramMessages", "telegram_messages.csv"),
    ("AssistantCallLog", "assistant_call_log.csv"),
    ("AuditLog", "audit_log.csv"),
]


def _read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def main() -> int:
    seed_dir = REPO_ROOT / "data" / "seed"
    if not seed_dir.exists():
        print(f"FAIL: seed dir not found at {seed_dir}")
        return 1

    counts = {}
    for tab, fname in SEED_ORDER:
        rows = _read_csv(seed_dir / fname)
        counts[tab] = len(rows)
    total = sum(counts.values())
    print(f"Seed inventory ({total} total rows across {len(counts)} tabs):")
    for tab, n in counts.items():
        print(f"  - {tab}: {n}")

    # Dry-run check
    sheets_url = os.environ.get("SHEETS_URL", "")
    sa_json = os.environ.get("GCP_SERVICE_ACCOUNT_JSON", "")
    has_secrets_file = (REPO_ROOT / ".streamlit" / "secrets.toml").exists()
    if not (sheets_url or has_secrets_file) or not (sa_json or has_secrets_file):
        print("DRY-RUN: secrets not configured in env. No writes performed.")
        print(f"DRY-RUN: would seed {total} rows.")
        return 0

    from lib import sheets_client  # noqa: E402

    written = 0
    for tab, fname in SEED_ORDER:
        rows = _read_csv(seed_dir / fname)
        if not rows:
            print(f"SKIP: {tab} (empty CSV)")
            continue
        try:
            existing = sheets_client.read_tab(tab)
            if not existing.empty and len(existing) > 0:
                print(f"SKIP: {tab} already has {len(existing)} rows")
                continue
            n = sheets_client.append_rows(tab, rows)
            written += n
            print(f"  + {tab}: inserted {n} rows")
        except Exception as e:  # noqa: BLE001
            print(f"  ! {tab} failed: {e}")
    print(f"DONE: wrote {written} rows.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
