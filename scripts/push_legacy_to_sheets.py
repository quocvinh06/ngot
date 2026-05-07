"""One-shot direct push of legacy data into the live Google Sheet.

Reads .streamlit/secrets.toml for the service account + Sheets URL.
Action plan:
  1. Connect to the sheet, list current tabs.
  2. For each tab in data/schema.yaml: ensure tab exists with correct headers.
  3. For each LEGACY tab (Dishes/Customers/Orders/OrderItems): clear existing data, write legacy CSV.
  4. For each independent tab (Settings/Ingredients/Equipment/Campaigns/AssistantSkills): write only if empty.
  5. Skip recipe-style tabs that depend on dish IDs from synthetic seed.
  6. Report row counts.

Run from apps/ngot_pastry:
    .venv/bin/python scripts/push_legacy_to_sheets.py
    .venv/bin/python scripts/push_legacy_to_sheets.py --confirm-overwrite  # required if any target tab already has data
"""
from __future__ import annotations

import csv
import sys
import time
from pathlib import Path

import gspread
import yaml
from google.oauth2.service_account import Credentials

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

# Tabs to OVERWRITE with legacy data (clear + insert)
LEGACY_TABS = [
    ("Dishes", "_legacy/dishes.csv"),
    ("Customers", "_legacy/customers.csv"),
    ("Orders", "_legacy/orders.csv"),
    ("OrderItems", "_legacy/order_items.csv"),
]
# Tabs to SEED only if empty (synthetic stays — independent of legacy)
SEED_IF_EMPTY_TABS = [
    ("Settings", "settings.csv"),
    ("Ingredients", "ingredients.csv"),
    ("Equipment", "equipment.csv"),
    ("Campaigns", "campaigns.csv"),
    ("AssistantSkills", "assistant_skills.csv"),
]
# Tabs to LEAVE EMPTY (header only — depend on real recipes/movements/audit)
LEAVE_EMPTY = [
    "Recipes",
    "InventoryMovements",
    "AuditLog",
    "TelegramMessages",
    "AssistantCallLog",
    "_telegram_offset",
    "_locks",
    "_notifications",
]
SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]


def load_secrets() -> dict:
    import tomllib
    p = REPO_ROOT / ".streamlit" / "secrets.toml"
    with open(p, "rb") as f:
        return tomllib.load(f)


def connect(secrets: dict) -> gspread.Spreadsheet:
    creds = Credentials.from_service_account_info(secrets["gcp_service_account"], scopes=SCOPES)
    gc = gspread.authorize(creds)
    return gc.open_by_url(secrets["SHEETS_URL"])


def read_csv_rows(path: Path) -> tuple[list[str], list[list[str]]]:
    with path.open("r", encoding="utf-8") as f:
        reader = csv.reader(f)
        rows = list(reader)
    if not rows:
        return [], []
    return rows[0], rows[1:]


def ensure_tab(ss: gspread.Spreadsheet, name: str, headers: list[str]) -> gspread.Worksheet:
    """Create the tab if missing; ensure headers in row 1; return the worksheet."""
    try:
        ws = ss.worksheet(name)
    except gspread.exceptions.WorksheetNotFound:
        ws = ss.add_worksheet(title=name, rows=100, cols=max(10, len(headers) + 2))
        if headers:
            ws.update("A1", [headers])
        print(f"  + created tab '{name}' ({len(headers)} cols)")
        return ws
    # Tab exists — check headers
    existing_headers = ws.row_values(1) if ws.row_count >= 1 else []
    if not existing_headers and headers:
        ws.update("A1", [headers])
        print(f"  ~ wrote header to existing empty tab '{name}'")
    return ws


def main() -> int:
    confirm_overwrite = "--confirm-overwrite" in sys.argv

    secrets = load_secrets()
    print(f"Connecting to {secrets['SHEETS_URL']}…")
    ss = connect(secrets)
    print(f"Opened spreadsheet: '{ss.title}' (id={ss.id})")

    # Load schema for all required tabs + their headers
    with open(REPO_ROOT / "data" / "schema.yaml", "r", encoding="utf-8") as f:
        schema = yaml.safe_load(f)
    schema_tabs = schema.get("tabs", {})

    # Step 1: ensure ALL schema tabs exist
    print("\n── Step 1: ensure all schema tabs exist ──")
    for tab_name, spec in schema_tabs.items():
        ensure_tab(ss, tab_name, spec.get("headers", []))
        time.sleep(0.3)  # gentle on API

    # Step 2: push legacy tabs (clear-then-insert)
    print("\n── Step 2: push legacy tabs (Dishes/Customers/Orders/OrderItems) ──")
    seed_dir = REPO_ROOT / "data" / "seed"
    blocked = []
    for tab_name, csv_path in LEGACY_TABS:
        ws = ss.worksheet(tab_name)
        existing = ws.get_all_values()
        existing_data_rows = max(0, len(existing) - 1)  # minus header
        if existing_data_rows > 0 and not confirm_overwrite:
            blocked.append(f"{tab_name} has {existing_data_rows} existing data rows")
            continue
        # Clear data rows (keep header)
        if existing_data_rows > 0:
            ws.batch_clear([f"A2:Z{len(existing)}"])
            print(f"  - cleared {existing_data_rows} rows from '{tab_name}'")
        headers, data = read_csv_rows(seed_dir / csv_path)
        # Ensure headers match (write fresh)
        ws.update("A1", [headers])
        if data:
            # gspread expects list-of-lists
            ws.update(f"A2", data, value_input_option="USER_ENTERED")
            print(f"  + wrote {len(data)} rows to '{tab_name}'")
        time.sleep(0.5)

    if blocked:
        print("\n!! BLOCKED — tab(s) already have data. Re-run with --confirm-overwrite to wipe + replace:")
        for b in blocked:
            print(f"   - {b}")
        return 1

    # Step 3: seed independent tabs only if empty
    print("\n── Step 3: seed independent tabs (only if empty) ──")
    for tab_name, csv_path in SEED_IF_EMPTY_TABS:
        ws = ss.worksheet(tab_name)
        existing = ws.get_all_values()
        if len(existing) > 1:
            print(f"  SKIP '{tab_name}' (has {len(existing)-1} rows)")
            continue
        headers, data = read_csv_rows(seed_dir / csv_path)
        if data:
            ws.update("A1", [headers])
            ws.update(f"A2", data, value_input_option="USER_ENTERED")
            print(f"  + wrote {len(data)} rows to '{tab_name}'")
        time.sleep(0.5)

    # Step 4: verify final row counts
    print("\n── Step 4: verify ──")
    summary = {}
    for tab_name in list(schema_tabs.keys()):
        try:
            ws = ss.worksheet(tab_name)
            n = max(0, len(ws.get_all_values()) - 1)
            summary[tab_name] = n
        except Exception as e:  # noqa: BLE001
            summary[tab_name] = f"ERROR: {e}"
    for k, v in summary.items():
        print(f"  {k:>22}: {v}")

    print(f"\n✓ Sheet ready: {secrets['SHEETS_URL']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
