"""Financials module — Equipment depreciation + P&L roll-ups."""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

import pandas as pd

from lib import sheets_client
from lib.audit import log_action
from lib.models import Equipment


def list_equipment() -> pd.DataFrame:
    return sheets_client.read_tab("Equipment")


def upsert_equipment(eq: Equipment, actor_role: str = "admin") -> int:
    # auto-compute monthly_depreciation_vnd
    if eq.useful_life_months and eq.purchase_price_vnd is not None:
        salv = eq.salvage_value_vnd or Decimal("0")
        eq.monthly_depreciation_vnd = (eq.purchase_price_vnd - salv) / Decimal(eq.useful_life_months)
    if eq.id:
        sheets_client.update_row("Equipment", eq.id, eq.to_row())
        log_action(actor_role, "equipment.update", target_kind="Equipment", target_id=eq.id)
        return eq.id
    new_id = sheets_client.append_row("Equipment", eq.to_row())
    log_action(actor_role, "equipment.create", target_kind="Equipment", target_id=new_id)
    return new_id


def monthly_depreciation_total() -> Decimal:
    df = list_equipment()
    if df.empty:
        return Decimal("0")
    active = df[df["is_active"].astype(str).str.upper().isin(["TRUE", "1", "YES"])]
    if active.empty:
        return Decimal("0")
    total = pd.to_numeric(active["monthly_depreciation_vnd"], errors="coerce").fillna(0).sum()
    return Decimal(str(total))


def _month_window(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1)
    if month == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, month + 1, 1)
    return start, end


def pnl_per_dish(year: int, month: int) -> pd.DataFrame:
    """Per-dish revenue, cogs, gross profit for the given month."""
    orders = sheets_client.read_tab("Orders")
    items = sheets_client.read_tab("OrderItems")
    recipes = sheets_client.read_tab("Recipes")
    ingredients = sheets_client.read_tab("Ingredients")
    dishes = sheets_client.read_tab("Dishes")

    if orders.empty or items.empty:
        return pd.DataFrame(
            columns=["dish_id", "name_vi", "units", "revenue_vnd", "cogs_vnd", "gross_profit_vnd", "margin_pct"]
        )

    start, end = _month_window(year, month)
    # filter relevant orders
    orders = orders.copy()
    orders["order_date_dt"] = pd.to_datetime(orders["order_date"], errors="coerce")
    valid = orders[
        orders["status"].astype(str).isin(["confirmed", "in_progress", "ready", "delivered"])
        & (orders["order_date_dt"] >= start)
        & (orders["order_date_dt"] < end)
    ]
    if valid.empty:
        return pd.DataFrame(
            columns=["dish_id", "name_vi", "units", "revenue_vnd", "cogs_vnd", "gross_profit_vnd", "margin_pct"]
        )

    items = items.copy()
    items["order_id"] = pd.to_numeric(items["order_id"], errors="coerce")
    items["dish_id"] = pd.to_numeric(items["dish_id"], errors="coerce")
    items["quantity"] = pd.to_numeric(items["quantity"], errors="coerce").fillna(0)
    items["subtotal_vnd"] = pd.to_numeric(items["subtotal_vnd"], errors="coerce").fillna(0)
    items_in_window = items[items["order_id"].isin(pd.to_numeric(valid["id"], errors="coerce"))]

    # COGS per unit per dish from recipes × ingredient weighted_avg_cost
    if not recipes.empty and not ingredients.empty:
        recipes = recipes.copy()
        recipes["dish_id"] = pd.to_numeric(recipes["dish_id"], errors="coerce")
        recipes["ingredient_id"] = pd.to_numeric(recipes["ingredient_id"], errors="coerce")
        recipes["quantity"] = pd.to_numeric(recipes["quantity"], errors="coerce").fillna(0)
        ingredients = ingredients.copy()
        ingredients["id"] = pd.to_numeric(ingredients["id"], errors="coerce")
        ingredients["weighted_avg_cost_vnd"] = pd.to_numeric(
            ingredients["weighted_avg_cost_vnd"], errors="coerce"
        ).fillna(0)
        merged = recipes.merge(
            ingredients[["id", "weighted_avg_cost_vnd"]],
            left_on="ingredient_id",
            right_on="id",
            how="left",
        )
        merged["line_cost"] = merged["quantity"] * merged["weighted_avg_cost_vnd"].fillna(0)
        unit_cost = merged.groupby("dish_id")["line_cost"].sum().reset_index()
        unit_cost.columns = ["dish_id", "unit_cogs"]
    else:
        unit_cost = pd.DataFrame(columns=["dish_id", "unit_cogs"])

    items_with_cogs = items_in_window.merge(unit_cost, on="dish_id", how="left")
    items_with_cogs["unit_cogs"] = items_with_cogs["unit_cogs"].fillna(0)
    items_with_cogs["line_cogs"] = items_with_cogs["unit_cogs"] * items_with_cogs["quantity"]

    grouped = (
        items_with_cogs.groupby("dish_id")
        .agg(
            units=("quantity", "sum"),
            revenue_vnd=("subtotal_vnd", "sum"),
            cogs_vnd=("line_cogs", "sum"),
        )
        .reset_index()
    )
    grouped["gross_profit_vnd"] = grouped["revenue_vnd"] - grouped["cogs_vnd"]
    grouped["margin_pct"] = grouped.apply(
        lambda r: round((r["gross_profit_vnd"] / r["revenue_vnd"] * 100), 1)
        if r["revenue_vnd"]
        else 0,
        axis=1,
    )
    if not dishes.empty:
        dishes_named = dishes[["id", "name_vi"]].copy()
        dishes_named["id"] = pd.to_numeric(dishes_named["id"], errors="coerce")
        grouped = grouped.merge(dishes_named, left_on="dish_id", right_on="id", how="left").drop(
            columns=["id"], errors="ignore"
        )
    grouped = grouped.sort_values("revenue_vnd", ascending=False)
    return grouped


def pnl_summary(year: int, month: int) -> dict:
    per_dish = pnl_per_dish(year, month)
    revenue = float(per_dish["revenue_vnd"].sum()) if not per_dish.empty else 0
    cogs = float(per_dish["cogs_vnd"].sum()) if not per_dish.empty else 0
    gross = revenue - cogs
    depreciation = float(monthly_depreciation_total())
    net = gross - depreciation
    return {
        "revenue_vnd": int(revenue),
        "cogs_vnd": int(cogs),
        "gross_profit_vnd": int(gross),
        "depreciation_vnd": int(depreciation),
        "net_profit_vnd": int(net),
        "gross_margin_pct": round((gross / revenue * 100), 1) if revenue else 0,
    }


def export_pnl_csv(year: int, month: int) -> bytes:
    df = pnl_per_dish(year, month)
    return df.to_csv(index=False).encode("utf-8")


def revenue_by_day(days: int = 7) -> pd.DataFrame:
    """Revenue grouped by day for the past N days."""
    orders = sheets_client.read_tab("Orders")
    if orders.empty:
        return pd.DataFrame(columns=["day", "revenue_vnd"])
    orders = orders.copy()
    orders["order_date_dt"] = pd.to_datetime(orders["order_date"], errors="coerce")
    cutoff = datetime.now() - timedelta(days=days)
    valid = orders[
        orders["status"].astype(str).isin(["confirmed", "in_progress", "ready", "delivered"])
        & (orders["order_date_dt"] >= cutoff)
    ].copy()
    if valid.empty:
        return pd.DataFrame(columns=["day", "revenue_vnd"])
    valid["day"] = valid["order_date_dt"].dt.date
    valid["total_vnd"] = pd.to_numeric(valid["total_vnd"], errors="coerce").fillna(0)
    return valid.groupby("day")["total_vnd"].sum().reset_index().rename(
        columns={"total_vnd": "revenue_vnd"}
    )
