"""One-shot importer for legacy Tổng-hợp-đơn-hàng.xlsx into staging CSVs.

Reads the historical xlsx (5 order sheets + 1 Menu sheet), normalizes the data,
and writes 4 CSVs to data/seed/_legacy/. These are STAGING files — review them,
then either replace data/seed/*.csv with them OR push directly via gspread.

Run from apps/ngot_pastry:
    .venv/bin/python scripts/import_legacy_xlsx.py
"""
from __future__ import annotations

import csv
import re
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

XLSX_PATH = Path("/Users/vinhta/Desktop/AppDroid/AppDroid1.05/Tổng-hợp-đơn-hàng.xlsx")
OUT_DIR = Path("data/seed/_legacy")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Per-sheet column layout. The 2024 sheet has CAKE at col 8 (no NOTE column in
# the first 12 cols). All 2025 sheets have NOTE at col 8 and CAKE at col 9.
SHEET_COLMAPS = {
    "2024 orders": {  # cols 0-11: date,time,deliv,no,status,name,phone,add,DISH,qty,unit_price,TOTAL
        "ncols": 12,
        "names": ["order_date","time","delivery_date","order_no","status","name","phone","address","dish","qty","unit_price","total"],
    },
    "2025 orders": {  # cols 0-11: date,time,deliv,no,status,name,phone,add,note,DISH,qty,unit_price
        "ncols": 12,
        "names": ["order_date","time","delivery_date","order_no","status","name","phone","address","note","dish","qty","unit_price"],
    },
    "Tết 2025 campaign": {
        "ncols": 12,
        "names": ["order_date","time","delivery_date","order_no","status","name","phone","address","note","dish","qty","unit_price"],
    },
    "83 event": {
        "ncols": 12,
        "names": ["order_date","time","delivery_date","order_no","status","name","phone","address","note","dish","qty","unit_price"],
    },
    "Valinetine 2025": {
        "ncols": 12,
        "names": ["order_date","time","delivery_date","order_no","status","name","phone","address","note","dish","qty","unit_price"],
    },
}
ORDER_SHEET_IDS = {
    "2024 orders": "2024",
    "2025 orders": "2025",
    "Tết 2025 campaign": "TET25",
    "83 event": "EVT83",
    "Valinetine 2025": "VAL25",
}

STATUS_MAP = {
    "Done": "delivered",
    "Hoàn/Huỷ": "cancelled",
    "Thanh toán trước - đang xử lý": "in_progress",
}


def normalize_phone(raw) -> str:
    """Normalize a Vietnamese phone to +84xxxxxxxxx; empty if invalid."""
    if pd.isna(raw):
        return ""
    s = str(raw).strip()
    if s.endswith(".0"):
        s = s[:-2]
    digits = re.sub(r"\D", "", s)
    if not digits:
        return ""
    if digits.startswith("84"):
        digits = digits[2:]
    if digits.startswith("0"):
        digits = digits[1:]
    if 9 <= len(digits) <= 10:
        return f"+84{digits}"
    return ""


def to_iso(value) -> str:
    if pd.isna(value):
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(value, str):
        return value.strip()
    return str(value)


def parse_money(v) -> int:
    if pd.isna(v):
        return 0
    try:
        return int(round(float(v)))
    except (ValueError, TypeError):
        return 0


def parse_qty(v) -> int:
    if pd.isna(v):
        return 1
    try:
        return max(1, int(round(float(v))))
    except (ValueError, TypeError):
        return 1


def main() -> int:
    if not XLSX_PATH.exists():
        print(f"ERROR: {XLSX_PATH} not found", file=sys.stderr)
        return 1

    print(f"Reading {XLSX_PATH}…")
    xls = pd.ExcelFile(XLSX_PATH, engine="calamine")

    # ── 1. Menu → dishes.csv ────────────────────────────────────
    menu_df = pd.read_excel(xls, "Menu").iloc[:, :4]
    menu_df.columns = ["category_raw", "name", "price_vnd", "cost_vnd"]
    menu_df["category_raw"] = menu_df["category_raw"].ffill()
    menu_df = menu_df.dropna(subset=["name", "price_vnd"]).copy()
    menu_df["name"] = menu_df["name"].astype(str).str.strip()

    cat_map = {
        "Panna cotta": "other", "Tiramisu": "cake", "Madeleine": "cookie",
        "Fraisier": "cake", "Black forest": "cake", "Bánh Chuối": "pastry",
        "Burn Cheese": "cake", "Tết campaign": "other", "Macaron": "cookie",
        "Matcha strawberry": "cake", "8/3 event": "pastry",
    }
    dish_rows = []
    name_to_id: dict[str, int] = {}
    for i, r in enumerate(menu_df.itertuples(index=False), start=1):
        category = cat_map.get(str(r.category_raw).strip(), "other")
        dish_rows.append({
            "id": i,
            "name_vi": r.name,
            "name_en": "",
            "category": category,
            "price_vnd": parse_money(r.price_vnd),
            "size": "",
            "description_vi": "",
            "image_url": "",
            "is_active": "TRUE",
            "retired_at": "",
            "display_order": i,
            "allergens": "[]",
        })
        name_to_id[r.name.lower()] = i
    write_csv(OUT_DIR / "dishes.csv",
              ["id","name_vi","name_en","category","price_vnd","size","description_vi","image_url","is_active","retired_at","display_order","allergens"],
              dish_rows)
    print(f"  dishes.csv: {len(dish_rows)} rows")

    # ── 2. Read all order sheets, build order index + customer index ──
    all_orders = []  # list of (sheet_id, order_no, items)
    customers: dict[tuple[str, str], dict] = {}  # (name, phone) -> dict
    next_customer_id = 1
    next_order_id = 1
    next_item_id = 1

    order_rows = []
    item_rows = []

    for sheet_name, colmap in SHEET_COLMAPS.items():
        sheet_id = ORDER_SHEET_IDS[sheet_name]
        df = pd.read_excel(xls, sheet_name).iloc[:, :colmap["ncols"]]
        df.columns = colmap["names"]
        # Add empty 'note' column if absent (2024 sheet)
        if "note" not in df.columns:
            df["note"] = ""
        df = df.dropna(subset=["dish"], how="all")  # only keep rows with a dish
        if df.empty:
            continue
        # Forward-fill order_no + customer info for multi-item rows
        for col in ("order_no","order_date","name","phone","address","note","delivery_date","status","time"):
            if col in df.columns:
                df[col] = df[col].ffill()

        # Group by order_no — each group is one order
        for order_no, group in df.groupby("order_no", sort=True):
            first = group.iloc[0]
            name = str(first["name"]).strip() if not pd.isna(first["name"]) else "Khách lẻ"
            phone = normalize_phone(first["phone"])
            cust_key = (name, phone)
            if cust_key not in customers:
                customers[cust_key] = {
                    "id": next_customer_id,
                    "phone": phone,
                    "name": name,
                    "default_address": str(first["address"]).strip() if not pd.isna(first["address"]) else "",
                }
                next_customer_id += 1
            customer_id = customers[cust_key]["id"]

            status_raw = str(first["status"]).strip() if not pd.isna(first["status"]) else "Done"
            status = STATUS_MAP.get(status_raw, "delivered")

            order_date = to_iso(first["order_date"])
            delivery_date = to_iso(first["delivery_date"]) or order_date

            subtotal = sum(parse_money(r["unit_price"]) * parse_qty(r["qty"]) for _, r in group.iterrows())
            order_id = next_order_id
            next_order_id += 1

            order_rows.append({
                "id": order_id,
                "customer_id": customer_id,
                "status": status,
                "order_date": order_date,
                "delivery_date": delivery_date,
                "delivery_address": str(first["address"]).strip() if not pd.isna(first["address"]) else "",
                "subtotal_vnd": subtotal,
                "discount_kind": "none",
                "discount_value": 0,
                "campaign_id": "",
                "total_vnd": subtotal,
                "paid_at": order_date if status == "delivered" else "",
                "payment_method": "bank_transfer" if status == "delivered" else "",
                "notes": (str(first["note"]).strip() if not pd.isna(first["note"]) else "") + (f" [legacy {sheet_id}#{int(order_no)}]"),
                "source": "manual",
                "confirmed_at": order_date if status in ("delivered","in_progress") else "",
                "created_by": "admin",
            })

            for _, r in group.iterrows():
                dish_name = str(r["dish"]).strip()
                # Find matching dish (case-insensitive); fallback to first dish if no match
                dish_id = name_to_id.get(dish_name.lower())
                if dish_id is None:
                    # Try fuzzy: strip size / standardize
                    norm = dish_name.lower().replace("  ", " ")
                    dish_id = name_to_id.get(norm, 1)  # fallback dish_id=1
                qty = parse_qty(r["qty"])
                up = parse_money(r["unit_price"])
                item_rows.append({
                    "id": next_item_id,
                    "order_id": order_id,
                    "dish_id": dish_id,
                    "dish_name_snapshot": dish_name,
                    "quantity": qty,
                    "unit_price_vnd": up,
                    "subtotal_vnd": qty * up,
                    "notes": "",
                })
                next_item_id += 1

    # ── 3. Customers CSV ────────────────────────────────────────
    cust_rows = []
    for (name, phone), c in sorted(customers.items(), key=lambda x: x[1]["id"]):
        cust_rows.append({
            "id": c["id"],
            "phone": phone,
            "name": name,
            "default_address": c["default_address"],
            "ward": "",
            "district": "",
            "city": "",
            "notes": "Imported from legacy xlsx",
            "consent_pdpl": "TRUE",
            "consent_at": "2024-04-19 00:00:00",
            "created_at": "2024-04-19 00:00:00",
            "created_by": "admin",
        })
    write_csv(OUT_DIR / "customers.csv",
              ["id","phone","name","default_address","ward","district","city","notes","consent_pdpl","consent_at","created_at","created_by"],
              cust_rows)
    print(f"  customers.csv: {len(cust_rows)} rows")

    # ── 4. Orders CSV ───────────────────────────────────────────
    write_csv(OUT_DIR / "orders.csv",
              ["id","customer_id","status","order_date","delivery_date","delivery_address","subtotal_vnd","discount_kind","discount_value","campaign_id","total_vnd","paid_at","payment_method","notes","source","confirmed_at","created_by"],
              order_rows)
    print(f"  orders.csv: {len(order_rows)} rows")

    # ── 5. OrderItems CSV ───────────────────────────────────────
    write_csv(OUT_DIR / "order_items.csv",
              ["id","order_id","dish_id","dish_name_snapshot","quantity","unit_price_vnd","subtotal_vnd","notes"],
              item_rows)
    print(f"  order_items.csv: {len(item_rows)} rows")

    # ── 6. Stats ────────────────────────────────────────────────
    print()
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    df_orders = pd.DataFrame(order_rows)
    df_orders["month"] = pd.to_datetime(df_orders["order_date"], errors="coerce").dt.to_period("M")
    by_month = df_orders.groupby(["month","status"]).size().unstack(fill_value=0)
    print("\nOrders by Month × Status:")
    print(by_month.to_string())
    print(f"\nTotal revenue (delivered orders): {df_orders[df_orders['status']=='delivered']['total_vnd'].sum():,} VND")
    print(f"Unique customers: {len(cust_rows)}")
    print(f"Total items: {len(item_rows)}")
    print(f"\nFiles written under {OUT_DIR.resolve()}")
    return 0


def write_csv(path: Path, fields: list[str], rows: list[dict]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow(r)


if __name__ == "__main__":
    sys.exit(main())
