"""Idempotent: create missing tabs in target Google Sheet from data/schema.yaml.

Dry-run mode (default when SHEETS_URL or service account is missing): print
plan + count, exit 0. Real mode runs ensure_tab() for each missing tab.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


def main() -> int:
    schema_path = REPO_ROOT / "data" / "schema.yaml"
    if not schema_path.exists():
        print(f"FAIL: schema not found at {schema_path}")
        return 1
    with schema_path.open("r", encoding="utf-8") as f:
        schema = yaml.safe_load(f)
    tabs = schema.get("tabs", {})
    print(f"Schema declares {len(tabs)} tabs.")

    # Detect dry-run conditions
    sheets_url = os.environ.get("SHEETS_URL", "")
    sa_json = os.environ.get("GCP_SERVICE_ACCOUNT_JSON", "")
    has_secrets_file = (REPO_ROOT / ".streamlit" / "secrets.toml").exists()

    if not (sheets_url or has_secrets_file) or not (sa_json or has_secrets_file):
        print("DRY-RUN: SHEETS_URL or service account not configured in env.")
        print("Would create the following tabs (if missing):")
        for name, spec in tabs.items():
            cols = spec.get("headers", [])
            print(f"  - {name} ({len(cols)} cols)")
        print(f"DRY-RUN: would create up to {len(tabs)} tabs.")
        return 0

    # Real mode
    from lib import sheets_client  # noqa: E402

    try:
        existing = sheets_client.list_tabs()
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: cannot list tabs ({e})")
        return 1
    missing = [n for n in tabs.keys() if n not in existing]
    print(f"{len(missing)} tabs missing — creating...")
    created = []
    for name in missing:
        spec = tabs[name]
        try:
            if sheets_client.ensure_tab(name, spec.get("headers", [])):
                created.append(name)
                print(f"  + {name}")
        except Exception as e:  # noqa: BLE001
            print(f"  ! {name} failed: {e}")
    print(f"DONE: created {len(created)} tabs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
