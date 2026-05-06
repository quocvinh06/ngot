"""Inventory module — Ingredient + InventoryMovement."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

import pandas as pd

from lib import sheets_client
from lib.audit import log_action
from lib.models import Ingredient, InventoryMovement


def list_ingredients() -> pd.DataFrame:
    return sheets_client.read_tab("Ingredients")


def get_ingredient(ingredient_id: int) -> Optional[Ingredient]:
    df = list_ingredients()
    if df.empty:
        return None
    matches = df[pd.to_numeric(df["id"], errors="coerce") == int(ingredient_id)]
    if matches.empty:
        return None
    return Ingredient.from_row(matches.iloc[0])


def upsert_ingredient(ing: Ingredient, actor_role: str = "staff") -> int:
    if ing.id:
        sheets_client.update_row("Ingredients", ing.id, ing.to_row())
        log_action(actor_role, "ingredient.update", target_kind="Ingredient", target_id=ing.id)
        return ing.id
    new_id = sheets_client.append_row("Ingredients", ing.to_row())
    log_action(actor_role, "ingredient.create", target_kind="Ingredient", target_id=new_id)
    return new_id


def list_movements(ingredient_id: Optional[int] = None) -> pd.DataFrame:
    df = sheets_client.read_tab("InventoryMovements")
    if df.empty:
        return df
    if ingredient_id is not None and "ingredient_id" in df.columns:
        return df[pd.to_numeric(df["ingredient_id"], errors="coerce") == int(ingredient_id)]
    return df


def current_stock(ingredient_id: int) -> Decimal:
    """Compute current stock from movements (purchase + adjustment - consumption - waste)."""
    df = list_movements(ingredient_id)
    if df.empty:
        ing = get_ingredient(ingredient_id)
        return ing.current_stock if ing else Decimal("0")
    total = Decimal("0")
    for _, row in df.iterrows():
        kind = str(row.get("kind", ""))
        try:
            qty = Decimal(str(row.get("quantity") or 0))
        except Exception:
            qty = Decimal("0")
        if kind == "purchase" or kind == "adjustment":
            total += qty
        elif kind == "consumption" or kind == "waste":
            total -= qty
    return total


def low_stock_ingredients() -> pd.DataFrame:
    df = list_ingredients()
    if df.empty:
        return df
    df = df.copy()
    df["current_stock_num"] = pd.to_numeric(df["current_stock"], errors="coerce").fillna(0)
    df["reorder_threshold_num"] = pd.to_numeric(df["reorder_threshold"], errors="coerce").fillna(0)
    return df[df["current_stock_num"] < df["reorder_threshold_num"]]


def record_purchase(
    *,
    ingredient_id: int,
    quantity: float,
    unit_price_vnd: float,
    notes: str = "",
    actor_role: str = "staff",
) -> int:
    """Append a purchase movement; update ingredient last_price + stock."""
    qty = Decimal(str(quantity))
    price = Decimal(str(unit_price_vnd))
    total = qty * price
    mv = InventoryMovement(
        occurred_at=datetime.now(),
        ingredient_id=ingredient_id,
        kind="purchase",
        quantity=qty,
        unit_price_vnd=price,
        total_vnd=total,
        related_order_id=None,
        notes=notes or None,
        recorded_by=actor_role,
    )
    new_id = sheets_client.append_row("InventoryMovements", mv.to_row())

    # Update ingredient current_stock + weighted avg + last price
    ing = get_ingredient(ingredient_id)
    if ing is not None:
        prev_stock = ing.current_stock or Decimal("0")
        prev_avg = ing.weighted_avg_cost_vnd or price
        new_stock = prev_stock + qty
        if new_stock > 0:
            new_avg = ((prev_stock * prev_avg) + (qty * price)) / new_stock
        else:
            new_avg = price
        sheets_client.update_row(
            "Ingredients",
            ingredient_id,
            {
                "current_stock": str(new_stock),
                "last_purchase_price_vnd": str(price),
                "weighted_avg_cost_vnd": f"{new_avg:.2f}",
            },
        )
    log_action(
        actor_role,
        "inventory.purchase",
        target_kind="Ingredient",
        target_id=ingredient_id,
        diff={"qty": str(qty), "unit_price_vnd": str(price), "movement_id": new_id},
    )
    return new_id


def consume_for_order(order_id: int, actor_role: str = "system") -> list[int]:
    """For each OrderItem, look up Recipe lines, write consumption movements,
    decrement Ingredient.current_stock. Returns list of movement ids written."""
    items = sheets_client.read_tab("OrderItems")
    if items.empty or "order_id" not in items.columns:
        return []
    matches = items[pd.to_numeric(items["order_id"], errors="coerce") == int(order_id)]
    if matches.empty:
        return []

    recipes = sheets_client.read_tab("Recipes")
    if recipes.empty:
        return []

    movements_written: list[int] = []
    stock_deltas: dict[int, Decimal] = {}

    with sheets_client.with_lock("inventory_write", actor_role):
        for _, item in matches.iterrows():
            try:
                dish_id = int(float(item["dish_id"]))
                qty_units = int(float(item["quantity"]))
            except (ValueError, TypeError):
                continue
            recipe_lines = recipes[
                pd.to_numeric(recipes["dish_id"], errors="coerce") == dish_id
            ]
            for _, rl in recipe_lines.iterrows():
                try:
                    ing_id = int(float(rl["ingredient_id"]))
                    per_unit = Decimal(str(rl.get("quantity") or 0))
                except (ValueError, TypeError):
                    continue
                consume_qty = per_unit * Decimal(qty_units)
                mv = InventoryMovement(
                    occurred_at=datetime.now(),
                    ingredient_id=ing_id,
                    kind="consumption",
                    quantity=consume_qty,
                    unit_price_vnd=None,
                    total_vnd=None,
                    related_order_id=order_id,
                    notes=f"order #{order_id}",
                    recorded_by=actor_role,
                )
                mv_id = sheets_client.append_row("InventoryMovements", mv.to_row())
                movements_written.append(mv_id)
                stock_deltas[ing_id] = stock_deltas.get(ing_id, Decimal("0")) + consume_qty

        # Apply stock deltas
        for ing_id, delta in stock_deltas.items():
            ing = get_ingredient(ing_id)
            if ing is None:
                continue
            new_stock = (ing.current_stock or Decimal("0")) - delta
            sheets_client.update_row(
                "Ingredients", ing_id, {"current_stock": str(new_stock)}
            )
    log_action(
        actor_role,
        "inventory.consume",
        target_kind="Order",
        target_id=order_id,
        diff={"movements_written": len(movements_written)},
    )
    return movements_written
